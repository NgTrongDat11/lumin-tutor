"""Private tutoring request API — create, confirm, reject, list."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.learning_need import LearningNeed
from app.models.private_tutoring_request import PrivateTutoringRequest
from app.models.tutor_profile import TutorProfile
from app.models.user_account import UserAccount
from app.schemas.common import ApiResponse
from app.schemas.private_request import (
    PrivateRequestCreate,
    PrivateRequestResponse,
    TutorConfirmRequest,
    TutorRejectRequest,
)
from app.services.sepay import enrich_payment_with_sepay

router = APIRouter(prefix="/private-requests", tags=["Private Tutoring"])


# ── Student: create & list ───────────────────────────────


@router.post(
    "",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gửi yêu cầu học 1-1",
)
async def create_request(
    body: PrivateRequestCreate,
    current_user: UserAccount = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_db),
):
    # Verify tutor is VERIFIED
    result = await db.execute(
        select(TutorProfile).where(TutorProfile.id == body.tutor_id)
    )
    tutor = result.scalar_one_or_none()
    if not tutor or tutor.verification_status != "VERIFIED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Gia sư chưa được xác minh.")

    if body.learning_need_id is not None:
        need_result = await db.execute(
            select(LearningNeed).where(
                LearningNeed.id == body.learning_need_id,
                LearningNeed.student_account_id == current_user.id,
            )
        )
        if not need_result.scalar_one_or_none():
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy nhu cầu học.")

    req = PrivateTutoringRequest(
        student_account_id=current_user.id,
        **body.model_dump(),
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return ApiResponse(
        data=PrivateRequestResponse.model_validate(req),
        message="Đã gửi yêu cầu học 1-1.",
    )


@router.get("", response_model=ApiResponse, summary="Danh sách yêu cầu 1-1 của tôi")
async def list_my_requests(
    current_user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Show requests where user is student OR tutor (via tutor_profile)
    filters = [PrivateTutoringRequest.student_account_id == current_user.id]
    if current_user.role == "TUTOR" and current_user.tutor_profile:
        filters = [
            or_(
                PrivateTutoringRequest.student_account_id == current_user.id,
                PrivateTutoringRequest.tutor_id == current_user.tutor_profile.id,
            )
        ]

    result = await db.execute(
        select(PrivateTutoringRequest)
        .where(*filters)
        .order_by(PrivateTutoringRequest.created_at.desc())
    )
    reqs = result.scalars().all()

    # Enrich with names
    from app.models.tutor_profile import TutorProfile
    from app.models.subject import Subject

    tutor_ids = {r.tutor_id for r in reqs}
    student_ids = {r.student_account_id for r in reqs}
    subject_ids = {r.subject_id for r in reqs}

    tutor_names: dict[int, str] = {}
    if tutor_ids:
        tp_result = await db.execute(
            select(TutorProfile.id, UserAccount.full_name)
            .join(UserAccount, TutorProfile.account_id == UserAccount.id)
            .where(TutorProfile.id.in_(tutor_ids))
        )
        tutor_names = {row[0]: row[1] for row in tp_result.all()}

    student_names: dict[int, str] = {}
    if student_ids:
        st_result = await db.execute(
            select(UserAccount.id, UserAccount.full_name).where(UserAccount.id.in_(student_ids))
        )
        student_names = {row[0]: row[1] for row in st_result.all()}

    subject_names: dict[int, str] = {}
    if subject_ids:
        sub_result = await db.execute(
            select(Subject.id, Subject.name).where(Subject.id.in_(subject_ids))
        )
        subject_names = {row[0]: row[1] for row in sub_result.all()}

    data = []
    for r in reqs:
        resp = PrivateRequestResponse.model_validate(r)
        resp.tutor_name = tutor_names.get(r.tutor_id)
        resp.student_name = student_names.get(r.student_account_id)
        resp.subject_name = subject_names.get(r.subject_id)
        data.append(resp)

    return ApiResponse(data=data)


@router.get("/{req_id}", response_model=ApiResponse, summary="Chi tiết yêu cầu 1-1")
async def get_request(
    req_id: int,
    current_user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(PrivateTutoringRequest).where(PrivateTutoringRequest.id == req_id)

    if current_user.role == "TUTOR":
        if not current_user.tutor_profile:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Không có hồ sơ gia sư.")
        query = query.where(PrivateTutoringRequest.tutor_id == current_user.tutor_profile.id)
    elif current_user.role == "STUDENT":
        query = query.where(PrivateTutoringRequest.student_account_id == current_user.id)
    elif current_user.role not in ("STAFF", "SUPER_ADMIN"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền truy cập.")

    result = await db.execute(query)
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy yêu cầu.")
    return ApiResponse(data=PrivateRequestResponse.model_validate(req))


# ── Tutor: confirm / reject ─────────────────────────────


@router.post("/{req_id}/confirm", response_model=ApiResponse, summary="Gia sư xác nhận yêu cầu")
async def confirm_request(
    req_id: int,
    body: TutorConfirmRequest,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    req = await _get_request_for_tutor(req_id, current_user, db)
    if req.status != "SENT":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Yêu cầu không ở trạng thái SENT.")

    req.status = "TUTOR_CONFIRMED"
    req.agreed_fee_per_session = body.agreed_fee_per_session
    req.tutor_response_note = body.response_note
    req.confirmed_at = datetime.utcnow()

    # 1. Create TeachingContract automatically
    from app.models.teaching_contract import TeachingContract
    from app.models.payment import Payment
    from decimal import Decimal

    contract_res = await db.execute(
        select(TeachingContract).where(TeachingContract.private_request_id == req.id)
    )
    contract = contract_res.scalar_one_or_none()
    if not contract:
        contract = TeachingContract(
            tutor_id=req.tutor_id,
            private_request_id=req.id,
            commission_name_snapshot="Default Commission",
            center_rate_snapshot=Decimal("30.00"),
            tutor_rate_snapshot=Decimal("70.00"),
        )
        db.add(contract)
        await db.flush() # Get contract.id

    # 2. Create Payment record automatically (Q1: tự tạo record backend)
    payment_res = await db.execute(
        select(Payment).where(
            Payment.target_type == "PRIVATE_TUTORING_REQUEST",
            Payment.target_id == req.id,
        )
    )
    payment = payment_res.scalar_one_or_none()
    if not payment:
        amount = req.agreed_fee_per_session * req.requested_sessions
        payment = Payment(
            student_account_id=req.student_account_id,
            target_type="PRIVATE_TUTORING_REQUEST",
            target_id=req.id,
            contract_id=contract.id,
            amount=amount,
            status="CREATED",
        )
        db.add(payment)
        await enrich_payment_with_sepay(payment, db)

    await db.commit()
    await db.refresh(req)
    return ApiResponse(
        data=PrivateRequestResponse.model_validate(req),
        message="Đã xác nhận yêu cầu.",
    )


@router.post("/{req_id}/reject", response_model=ApiResponse, summary="Gia sư từ chối yêu cầu")
async def reject_request(
    req_id: int,
    body: TutorRejectRequest,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    req = await _get_request_for_tutor(req_id, current_user, db)
    if req.status != "SENT":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Yêu cầu không ở trạng thái SENT.")

    req.status = "TUTOR_REJECTED"
    req.tutor_response_note = body.response_note
    await db.commit()
    return ApiResponse(message="Đã từ chối yêu cầu.")


# ── Helpers ──────────────────────────────────────────────


async def _get_request_for_tutor(
    req_id: int, user: UserAccount, db: AsyncSession
) -> PrivateTutoringRequest:
    profile = user.tutor_profile
    if not profile:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Không có hồ sơ gia sư.")
    result = await db.execute(
        select(PrivateTutoringRequest).where(
            PrivateTutoringRequest.id == req_id,
            PrivateTutoringRequest.tutor_id == profile.id,
        )
    )
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy yêu cầu.")
    if profile.verification_status != "VERIFIED":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Hồ sơ của bạn chưa được duyệt. Bạn không thể thực hiện thao tác này.")
    return req
