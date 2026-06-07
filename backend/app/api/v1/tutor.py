"""Tutor profile management API — profile, qualifications, subjects, availabilities."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.tutor_availability import TutorAvailability
from app.models.tutor_profile import TutorProfile
from app.models.tutor_qualification import TutorQualification
from app.models.tutor_subject import TutorSubject
from app.models.user_account import UserAccount
from app.schemas.common import ApiResponse
from app.schemas.tutor import (
    AvailabilityCreate,
    QualificationCreate,
    QualificationResponse,
    TutorAvailabilityResponse,
    TutorProfileResponse,
    TutorProfileUpdate,
    TutorPublicResponse,
    TutorSubjectCreate,
    TutorSubjectResponse,
)

router = APIRouter(prefix="/tutor", tags=["Tutor Profile"])


# ── Helpers ──────────────────────────────────────────────


async def _get_tutor_profile(user: UserAccount, db: AsyncSession) -> TutorProfile:
    result = await db.execute(
        select(TutorProfile).where(TutorProfile.account_id == user.id)
    )
    profile = result.scalar_one_or_none()
    if not profile:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chưa có hồ sơ gia sư.")
    return profile


# ── Public Browse ────────────────────────────────────────

@router.get("/browse", response_model=ApiResponse, summary="Browse verified tutors")
async def browse_tutors(
    db: AsyncSession = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    from sqlalchemy.orm import selectinload
    result = await db.execute(
        select(TutorProfile)
        .options(
            selectinload(TutorProfile.account),
            selectinload(TutorProfile.subjects).selectinload(TutorSubject.subject),
            selectinload(TutorProfile.availabilities),
        )
        .where(TutorProfile.verification_status == "VERIFIED")
        .order_by(TutorProfile.average_rating.desc())
    )
    profiles = result.scalars().all()
    data = []
    for p in profiles:
        data.append(
            TutorPublicResponse(
                id=p.id,
                full_name=p.account.full_name if p.account else "N/A",
                bio=p.bio,
                qualification_level=p.qualification_level,
                years_experience=p.years_experience,
                teaching_mode=p.teaching_mode,
                teaching_area=p.teaching_area,
                verification_status=p.verification_status,
                average_rating=p.average_rating,
                rating_count=p.rating_count,
                subjects=[
                    TutorSubjectResponse(
                        id=ts.id,
                        subject_id=ts.subject_id,
                        subject_name=ts.subject.name if ts.subject else None,
                        grade_level=ts.grade_level,
                        fee_per_session=ts.fee_per_session,
                        status=ts.status,
                    )
                    for ts in p.subjects
                    if ts.status == "APPROVED"
                ],
                availabilities=[
                    TutorAvailabilityResponse.model_validate(a) for a in p.availabilities
                ],
            )
        )
    return ApiResponse(data=data)

# ── Profile ──────────────────────────────────────────────


@router.get("/profile", response_model=ApiResponse, summary="Xem hồ sơ gia sư")
async def get_profile(
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    return ApiResponse(data=TutorProfileResponse.model_validate(profile))


@router.put("/profile", response_model=ApiResponse, summary="Cập nhật hồ sơ gia sư")
async def update_profile(
    body: TutorProfileUpdate,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(profile, key, value)

    # BD-203: editing after verified → back to PENDING_REVIEW
    if profile.verification_status == "VERIFIED" and update_data:
        profile.verification_status = "PENDING_REVIEW"

    await db.commit()
    await db.refresh(profile)
    return ApiResponse(
        data=TutorProfileResponse.model_validate(profile),
        message="Cập nhật hồ sơ thành công.",
    )


@router.post(
    "/profile/submit-review",
    response_model=ApiResponse,
    summary="Gửi hồ sơ để staff duyệt",
)
async def submit_for_review(
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    if profile.verification_status not in ("DRAFT", "REJECTED"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Chỉ có thể gửi duyệt khi hồ sơ ở trạng thái DRAFT hoặc REJECTED.",
        )

    # BD-201: cần ít nhất 1 qualification
    quals = await db.execute(
        select(TutorQualification).where(TutorQualification.tutor_id == profile.id)
    )
    if not quals.scalars().first():
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            "Cần ít nhất 1 minh chứng/chứng chỉ trước khi gửi duyệt.",
        )

    profile.verification_status = "PENDING_REVIEW"
    await db.commit()
    return ApiResponse(message="Đã gửi hồ sơ để duyệt.")


# ── Qualifications ───────────────────────────────────────


@router.get("/qualifications", response_model=ApiResponse, summary="Danh sách chứng chỉ")
async def list_qualifications(
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    result = await db.execute(
        select(TutorQualification).where(TutorQualification.tutor_id == profile.id)
    )
    quals = result.scalars().all()
    return ApiResponse(data=[QualificationResponse.model_validate(q) for q in quals])


@router.post(
    "/qualifications",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm chứng chỉ",
)
async def add_qualification(
    body: QualificationCreate,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    qual = TutorQualification(tutor_id=profile.id, **body.model_dump())
    db.add(qual)

    # BD-203: adding qual after verified → re-review
    if profile.verification_status == "VERIFIED":
        profile.verification_status = "PENDING_REVIEW"

    await db.commit()
    await db.refresh(qual)
    return ApiResponse(
        data=QualificationResponse.model_validate(qual),
        message="Thêm chứng chỉ thành công.",
    )


@router.delete("/qualifications/{qual_id}", response_model=ApiResponse, summary="Xoá chứng chỉ")
async def delete_qualification(
    qual_id: int,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    result = await db.execute(
        select(TutorQualification).where(
            TutorQualification.id == qual_id,
            TutorQualification.tutor_id == profile.id,
        )
    )
    qual = result.scalar_one_or_none()
    if not qual:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy chứng chỉ.")
    await db.delete(qual)
    await db.commit()
    return ApiResponse(message="Đã xoá chứng chỉ.")


# ── Tutor Subjects ───────────────────────────────────────


@router.get("/subjects", response_model=ApiResponse, summary="Danh sách môn dạy")
async def list_tutor_subjects(
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    result = await db.execute(
        select(TutorSubject).where(TutorSubject.tutor_id == profile.id)
    )
    subjects = result.scalars().all()
    data = []
    for ts in subjects:
        resp = TutorSubjectResponse.model_validate(ts)
        if ts.subject:
            resp.subject_name = ts.subject.name
        data.append(resp)
    return ApiResponse(data=data)


@router.post(
    "/subjects",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký môn dạy",
)
async def add_tutor_subject(
    body: TutorSubjectCreate,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    ts = TutorSubject(tutor_id=profile.id, **body.model_dump())
    db.add(ts)

    # BD-203: adding subject after verified → re-review
    if profile.verification_status == "VERIFIED":
        profile.verification_status = "PENDING_REVIEW"

    await db.commit()
    await db.refresh(ts)
    resp = TutorSubjectResponse.model_validate(ts)
    return ApiResponse(data=resp, message="Đăng ký môn dạy thành công.")


@router.delete("/subjects/{ts_id}", response_model=ApiResponse, summary="Xoá môn dạy")
async def delete_tutor_subject(
    ts_id: int,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    result = await db.execute(
        select(TutorSubject).where(
            TutorSubject.id == ts_id,
            TutorSubject.tutor_id == profile.id,
        )
    )
    ts = result.scalar_one_or_none()
    if not ts:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy môn dạy.")
    await db.delete(ts)
    await db.commit()
    return ApiResponse(message="Đã xoá môn dạy.")


# ── Availabilities ───────────────────────────────────────


@router.get("/availabilities", response_model=ApiResponse, summary="Danh sách lịch rảnh")
async def list_availabilities(
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    result = await db.execute(
        select(TutorAvailability).where(TutorAvailability.tutor_id == profile.id)
    )
    avails = result.scalars().all()
    return ApiResponse(data=[TutorAvailabilityResponse.model_validate(a) for a in avails])


@router.post(
    "/availabilities",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Thêm lịch rảnh",
)
async def add_availability(
    body: AvailabilityCreate,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    avail = TutorAvailability(tutor_id=profile.id, **body.model_dump())
    db.add(avail)
    await db.commit()
    await db.refresh(avail)
    return ApiResponse(
        data=TutorAvailabilityResponse.model_validate(avail),
        message="Thêm lịch rảnh thành công.",
    )


@router.delete("/availabilities/{avail_id}", response_model=ApiResponse, summary="Xoá lịch rảnh")
async def delete_availability(
    avail_id: int,
    current_user: UserAccount = Depends(require_role("TUTOR")),
    db: AsyncSession = Depends(get_db),
):
    profile = await _get_tutor_profile(current_user, db)
    result = await db.execute(
        select(TutorAvailability).where(
            TutorAvailability.id == avail_id,
            TutorAvailability.tutor_id == profile.id,
        )
    )
    avail = result.scalar_one_or_none()
    if not avail:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy lịch rảnh.")
    await db.delete(avail)
    await db.commit()
    return ApiResponse(message="Đã xoá lịch rảnh.")
