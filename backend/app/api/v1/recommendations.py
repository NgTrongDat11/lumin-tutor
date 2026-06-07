"""Recommendation API — get recommendations based on a learning need."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.deps import get_db, require_role
from app.models.learning_need import LearningNeed
from app.models.recommendation_event import RecommendationEvent
from app.models.user_account import UserAccount
from app.schemas.common import ApiResponse
from app.schemas.course_class import CourseClassResponse
from app.schemas.tutor import TutorPublicResponse
from app.services.chat import compute_and_save_recommendation_snapshot
from app.services.recommendation import recommend_for_need

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recommendations", tags=["Recommendation"])


@router.get(
    "/for-need/{need_id}",
    response_model=ApiResponse,
    summary="Gợi ý gia sư + lớp nhóm theo nhu cầu học",
)
async def get_recommendations(
    need_id: int,
    current_user: UserAccount = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_db),
):
    # Load learning need with schedules
    result = await db.execute(
        select(LearningNeed)
        .options(selectinload(LearningNeed.schedules))
        .where(
            LearningNeed.id == need_id,
            LearningNeed.student_account_id == current_user.id,
        )
    )
    need = result.scalar_one_or_none()
    if not need:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy nhu cầu học.")

    # Run recommendation
    results = await recommend_for_need(need, db)

    # Also update the snapshot for AI chat
    try:
        await compute_and_save_recommendation_snapshot(need, db)
    except Exception:
        logger.warning("Failed to update recommendation snapshot for need %s", need_id, exc_info=True)

    # Format response
    recommended_tutors = []
    for item in results["tutors"]:
        tutor = item["tutor"]
        from app.schemas.tutor import TutorSubjectResponse, TutorAvailabilityResponse

        tutor_data = TutorPublicResponse(
            id=tutor.id,
            full_name=tutor.account.full_name if tutor.account else "N/A",
            bio=tutor.bio,
            qualification_level=tutor.qualification_level,
            years_experience=tutor.years_experience,
            teaching_mode=tutor.teaching_mode,
            teaching_area=tutor.teaching_area,
            verification_status=tutor.verification_status,
            average_rating=tutor.average_rating,
            rating_count=tutor.rating_count,
            subjects=[
                TutorSubjectResponse(
                    id=ts.id,
                    subject_id=ts.subject_id,
                    subject_name=ts.subject.name if ts.subject else None,
                    grade_level=ts.grade_level,
                    fee_per_session=ts.fee_per_session,
                    status=ts.status,
                )
                for ts in tutor.subjects
                if ts.status == "APPROVED"
            ],
            availabilities=[
                TutorAvailabilityResponse.model_validate(a)
                for a in tutor.availabilities
            ],
        )
        recommended_tutors.append({
            "tutor": tutor_data.model_dump(),
            "score": float(item["score"]),
            "reasons": item["reasons"],
        })

    recommended_classes = []
    for item in results["classes"]:
        cc = item["course_class"]
        recommended_classes.append({
            "course_class": CourseClassResponse.model_validate(cc).model_dump(),
            "score": float(item["score"]),
            "reasons": item["reasons"],
        })

    return ApiResponse(
        data={
            "recommended_tutors": recommended_tutors,
            "recommended_classes": recommended_classes,
        }
    )


@router.post(
    "/events",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Ghi log sự kiện tương tác (view/click/favorite/...)",
)
async def log_event(
    learning_need_id: int | None = None,
    target_type: str = "TUTOR",
    target_id: int = 0,
    event_type: str = "VIEW",
    current_user: UserAccount = Depends(require_role("STUDENT")),
    db: AsyncSession = Depends(get_db),
):
    if learning_need_id is not None:
        result = await db.execute(
            select(LearningNeed.id).where(
                LearningNeed.id == learning_need_id,
                LearningNeed.student_account_id == current_user.id,
            )
        )
        if result.scalar_one_or_none() is None:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy nhu cầu học.")

    event = RecommendationEvent(
        student_account_id=current_user.id,
        learning_need_id=learning_need_id,
        target_type=target_type,
        target_id=target_id,
        event_type=event_type,
    )
    db.add(event)
    await db.commit()
    return ApiResponse(message="Ghi log thành công.")
