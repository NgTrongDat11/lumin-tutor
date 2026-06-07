"""Course classes API — CRUD, tutor applications, student registrations."""

from datetime import datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.class_registration import ClassRegistration
from app.models.course_class import CourseClass
from app.models.tutor_application import TutorApplication
from app.models.tutor_subject import TutorSubject
from app.models.teaching_contract import TeachingContract
from app.models.user_account import UserAccount
from app.schemas.common import ApiResponse
from app.schemas.course_class import (
    ClassRegistrationCreate,
    ClassRegistrationResponse,
    CourseClassCreate,
    CourseClassResponse,
    TutorApplicationCreate,
    TutorApplicationResponse,
)
from app.schemas.staff import ReviewAction
from app.services.sepay import enrich_payment_with_sepay

router = APIRouter(prefix="/classes", tags=["Course Classes"])


# ── Staff: CRUD ──────────────────────────────────────────


@router.post(
    "",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Staff tạo lớp nhóm",
)
async def create_class(
    body: CourseClassCreate,
    current_user: UserAccount = Depends(require_role("STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    cc = CourseClass(
        created_by_account_id=current_user.id,
        **body.model_dump(),
    )
    db.add(cc)
    await db.commit()
    await db.refresh(cc)
    return ApiResponse(
        data=CourseClassResponse.model_validate(cc),
        message="Tạo lớp nhóm thành công.",
    )


@router.get("", response_model=ApiResponse, summary="Danh sách lớp nhóm")
async def list_classes(
    db: AsyncSession = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    from app.models.tutor_profile import TutorProfile

    result = await db.execute(
        select(CourseClass).order_by(CourseClass.created_at.desc())
    )
    classes = result.scalars().all()

    # Enrich with tutor names
    tutor_ids = {c.primary_tutor_id for c in classes if c.primary_tutor_id}
    tutor_names: dict[int, str] = {}
    if tutor_ids:
        tp_result = await db.execute(
            select(TutorProfile.id, UserAccount.full_name)
            .join(UserAccount, TutorProfile.account_id == UserAccount.id)
            .where(TutorProfile.id.in_(tutor_ids))
        )
        tutor_names = {row[0]: row[1] for row in tp_result.all()}

    data = []
    for c in classes:
        resp = CourseClassResponse.model_validate(c)
        resp.tutor_name = tutor_names.get(c.primary_tutor_id) if c.primary_tutor_id else None
        data.append(resp)

    return ApiResponse(data=data)


@router.get("/my-registrations", response_model=ApiResponse, summary="Danh sách lớp đã đăng ký của tôi")
async def list_my_registrations(
    current_user: UserAccount = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_db),
):
    from app.models.subject import Subject
    from app.models.tutor_profile import TutorProfile

    result = await db.execute(
        select(ClassRegistration, CourseClass, Subject.name, UserAccount.full_name)
        .join(CourseClass, ClassRegistration.class_id == CourseClass.id)
        .join(Subject, CourseClass.subject_id == Subject.id)
        .outerjoin(TutorProfile, CourseClass.primary_tutor_id == TutorProfile.id)
        .outerjoin(UserAccount, TutorProfile.account_id == UserAccount.id)
        .where(ClassRegistration.student_account_id == current_user.id)
        .order_by(ClassRegistration.created_at.desc())
    )

    data = []
    for row in result.all():
        reg, course_class, subject_name, tutor_name = row
        resp = ClassRegistrationResponse.model_validate(reg)
        resp.class_title = course_class.title
        resp.tutor_name = tutor_name or "Chưa phân công"
        resp.subject_name = subject_name
        resp.total_sessions = course_class.total_sessions
        resp.fee_per_session_per_student = course_class.fee_per_session_per_student
        data.append(resp)

    return ApiResponse(data=data)


@router.get("/{class_id}", response_model=ApiResponse, summary="Chi tiết lớp nhóm")
async def get_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    result = await db.execute(
        select(CourseClass).where(CourseClass.id == class_id)
    )
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy lớp nhóm.")
    return ApiResponse(data=CourseClassResponse.model_validate(cc))


@router.put("/{class_id}/status", response_model=ApiResponse, summary="Staff cập nhật trạng thái lớp")
async def update_class_status(
    class_id: int,
    new_status: str,
    current_user: UserAccount = Depends(require_role("STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(CourseClass).where(CourseClass.id == class_id))
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy lớp nhóm.")
    cc.status = new_status
    await db.commit()
    await db.refresh(cc)
    return ApiResponse(
        data=CourseClassResponse.model_validate(cc),
        message=f"Đã cập nhật trạng thái lớp sang {new_status}.",
    )


# ── Tutor: apply ─────────────────────────────────────────


@router.post(
    "/{class_id}/apply",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Gia sư ứng tuyển vào lớp",
)
async def apply_to_class(
    class_id: int,
    body: TutorApplicationCreate,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = current_user.tutor_profile
    if not profile or profile.verification_status != "VERIFIED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Gia sư chưa được xác minh.")

    # Check class exists and is recruiting
    result = await db.execute(select(CourseClass).where(CourseClass.id == class_id))
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy lớp nhóm.")
    if cc.status != "TUTOR_RECRUITING":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lớp không ở trạng thái tuyển gia sư.")

    subject_result = await db.execute(
        select(TutorSubject).where(
            TutorSubject.tutor_id == profile.id,
            TutorSubject.subject_id == cc.subject_id,
            TutorSubject.status == "APPROVED",
        )
    )
    tutor_subject = subject_result.scalar_one_or_none()
    if not tutor_subject:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Bạn chưa có môn dạy phù hợp.")
    if cc.grade_level and tutor_subject.grade_level:
        if cc.grade_level.lower() not in tutor_subject.grade_level.lower():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Cấp lớp không phù hợp với lớp học.")

    # Check duplicate
    existing = await db.execute(
        select(TutorApplication).where(
            TutorApplication.class_id == class_id,
            TutorApplication.tutor_id == profile.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bạn đã ứng tuyển lớp này rồi.")

    app = TutorApplication(class_id=class_id, tutor_id=profile.id, message=body.message)
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return ApiResponse(
        data=TutorApplicationResponse.model_validate(app),
        message="Ứng tuyển thành công.",
    )


@router.get("/{class_id}/applications", response_model=ApiResponse, summary="Danh sách ứng tuyển")
async def list_applications(
    class_id: int,
    current_user: UserAccount = Depends(require_role("STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TutorApplication).where(TutorApplication.class_id == class_id)
    )
    apps = result.scalars().all()
    return ApiResponse(data=[TutorApplicationResponse.model_validate(a) for a in apps])


@router.post(
    "/{class_id}/applications/{app_id}/accept",
    response_model=ApiResponse,
    summary="Staff chọn gia sư cho lớp",
)
async def accept_application(
    class_id: int,
    app_id: int,
    current_user: UserAccount = Depends(require_role("STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(TutorApplication).where(
            TutorApplication.id == app_id, TutorApplication.class_id == class_id
        )
    )
    app = result.scalar_one_or_none()
    if not app:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy ứng tuyển.")
    if app.status != "APPLIED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ứng tuyển không ở trạng thái APPLIED.")

    app.status = "ACCEPTED"
    app.reviewed_by_account_id = current_user.id
    app.reviewed_at = datetime.utcnow()
    # Set primary tutor on class
    result2 = await db.execute(select(CourseClass).where(CourseClass.id == class_id))
    cc = result2.scalar_one()
    cc.primary_tutor_id = app.tutor_id

    contract_result = await db.execute(
        select(TeachingContract).where(
            TeachingContract.class_id == class_id,
            TeachingContract.tutor_id == app.tutor_id,
        )
    )
    if not contract_result.scalar_one_or_none():
        contract = TeachingContract(
            tutor_id=app.tutor_id,
            class_id=class_id,
            commission_name_snapshot="Default Commission",
            center_rate_snapshot=Decimal("30.00"),
            tutor_rate_snapshot=Decimal("70.00"),
        )
        db.add(contract)
    await db.commit()
    await db.refresh(app)
    return ApiResponse(
        data=TutorApplicationResponse.model_validate(app),
        message="Đã chọn gia sư cho lớp.",
    )


# ── Student: register ────────────────────────────────────


@router.post(
    "/{class_id}/register",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Học viên đăng ký lớp nhóm",
)
async def register_for_class(
    class_id: int,
    body: ClassRegistrationCreate,
    current_user: UserAccount = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_db),
):
    # Check class exists and is enrolling
    result = await db.execute(select(CourseClass).where(CourseClass.id == class_id))
    cc = result.scalar_one_or_none()
    if not cc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy lớp nhóm.")
    if cc.status not in ("ENROLLING", "READY"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lớp không nhận đăng ký.")

    # BD-408: check max students
    count_result = await db.execute(
        select(func.count()).where(
            ClassRegistration.class_id == class_id,
            ClassRegistration.status.in_(("PENDING", "APPROVED", "PAID")),
        )
    )
    current_count = count_result.scalar() or 0
    if current_count >= cc.max_students:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lớp đã đủ số lượng học viên.")

    # Check duplicate
    existing = await db.execute(
        select(ClassRegistration).where(
            ClassRegistration.class_id == class_id,
            ClassRegistration.student_account_id == current_user.id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Bạn đã đăng ký lớp này rồi.")

    reg = ClassRegistration(
        class_id=class_id,
        student_account_id=current_user.id,
        learning_need_id=body.learning_need_id,
    )
    db.add(reg)
    await db.commit()
    await db.refresh(reg)
    return ApiResponse(
        data=ClassRegistrationResponse.model_validate(reg),
        message="Đăng ký lớp thành công, chờ staff duyệt.",
    )


@router.get("/{class_id}/registrations", response_model=ApiResponse, summary="Danh sách đăng ký")
async def list_registrations(
    class_id: int,
    current_user: UserAccount = Depends(require_role("STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(ClassRegistration).where(ClassRegistration.class_id == class_id)
    )
    regs = result.scalars().all()
    return ApiResponse(data=[ClassRegistrationResponse.model_validate(r) for r in regs])


@router.post(
    "/{class_id}/registrations/{reg_id}/review",
    response_model=ApiResponse,
    summary="Staff duyệt đăng ký lớp",
)
async def review_registration(
    class_id: int,
    reg_id: int,
    body: ReviewAction,
    current_user: UserAccount = Depends(require_role("STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    if body.action not in ("APPROVED", "REJECTED"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Action phải là APPROVED hoặc REJECTED.")

    result = await db.execute(
        select(ClassRegistration).where(
            ClassRegistration.id == reg_id, ClassRegistration.class_id == class_id
        )
    )
    reg = result.scalar_one_or_none()
    if not reg:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy đăng ký.")
    if reg.status != "PENDING":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Đăng ký không ở trạng thái PENDING.")

    class_result = await db.execute(select(CourseClass).where(CourseClass.id == class_id))
    cc = class_result.scalar_one_or_none()
    if not cc:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy lớp nhóm.")

    if body.action == "APPROVED":
        count_result = await db.execute(
            select(func.count()).where(
                ClassRegistration.class_id == class_id,
                ClassRegistration.status.in_(("PENDING", "APPROVED", "PAID")),
            )
        )
        current_count = count_result.scalar() or 0
        if current_count >= cc.max_students:
            raise HTTPException(status.HTTP_400_BAD_REQUEST, "Lớp đã đủ số lượng học viên.")

        # Get or create TeachingContract for class tutor
        contract_id = None
        if cc.primary_tutor_id:
            contract_res = await db.execute(
                select(TeachingContract).where(
                    TeachingContract.class_id == class_id,
                    TeachingContract.tutor_id == cc.primary_tutor_id,
                )
            )
            contract = contract_res.scalar_one_or_none()
            if contract:
                contract_id = contract.id
            else:
                contract = TeachingContract(
                    tutor_id=cc.primary_tutor_id,
                    class_id=class_id,
                    commission_name_snapshot="Default Commission",
                    center_rate_snapshot=Decimal("30.00"),
                    tutor_rate_snapshot=Decimal("70.00"),
                )
                db.add(contract)
                await db.flush()
                contract_id = contract.id

        # Create Payment record automatically (status CREATED)
        from app.models.payment import Payment
        payment_res = await db.execute(
            select(Payment).where(
                Payment.target_type == "CLASS_REGISTRATION",
                Payment.target_id == reg.id,
            )
        )
        payment = payment_res.scalar_one_or_none()
        if not payment:
            amount = cc.fee_per_session_per_student * cc.total_sessions
            payment = Payment(
                student_account_id=reg.student_account_id,
                target_type="CLASS_REGISTRATION",
                target_id=reg.id,
                contract_id=contract_id,
                amount=amount,
                status="CREATED",
            )
            db.add(payment)
            await enrich_payment_with_sepay(payment, db)

    reg.status = body.action
    reg.review_note = body.review_note
    reg.reviewed_by_account_id = current_user.id
    await db.commit()
    await db.refresh(reg)
    return ApiResponse(
        data=ClassRegistrationResponse.model_validate(reg),
        message=f"Đã {body.action.lower()} đăng ký.",
    )
