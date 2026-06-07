"""Hybrid recommendation service — content-based + collaborative filtering.

Luồng:
1. Lọc gia sư 1-1 phù hợp (content-based filter)
2. Lọc lớp nhóm phù hợp (content-based filter)
3. Tính điểm hybrid = w_content * content_score + w_collab * collab_score
4. Sắp xếp và trả kết quả
"""

from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.course_class import CourseClass
from app.models.class_registration import ClassRegistration
from app.models.learning_need import LearningNeed
from app.models.recommendation_event import RecommendationEvent
from app.models.review import Review
from app.models.schedule_block import ScheduleBlock
from app.models.tutor_availability import TutorAvailability
from app.models.tutor_profile import TutorProfile
from app.models.tutor_subject import TutorSubject

# ── Weights ──────────────────────────────────────────────

W_SUBJECT_MATCH = 30.0
W_GRADE_MATCH = 15.0
W_FEE_MATCH = 15.0
W_SCHEDULE_MATCH = 15.0
W_MODE_MATCH = 10.0
W_RATING = 10.0
W_EXPERIENCE = 5.0


async def recommend_for_need(
    need: LearningNeed,
    db: AsyncSession,
    limit: int = 20,
) -> dict:
    """Return {tutors: [...], classes: [...]} matching a LearningNeed."""

    tutors = await _filter_and_score_tutors(need, db, limit)
    classes = await _filter_and_score_classes(need, db, limit)
    return {"tutors": tutors, "classes": classes}


# ── Tutor scoring ────────────────────────────────────────


async def _filter_and_score_tutors(
    need: LearningNeed,
    db: AsyncSession,
    limit: int,
) -> list[dict]:
    """Filter verified tutors and score them against the learning need."""

    # Step 1: load all verified tutors with subjects, availabilities
    query = (
        select(TutorProfile)
        .options(
            selectinload(TutorProfile.account),
            selectinload(TutorProfile.subjects).selectinload(TutorSubject.subject),
            selectinload(TutorProfile.availabilities),
        )
        .where(TutorProfile.verification_status == "VERIFIED")
    )
    result = await db.execute(query)
    all_tutors = result.scalars().all()

    tutor_ids = [tutor.id for tutor in all_tutors]
    blocks_by_tutor: dict[int, list[ScheduleBlock]] = {}
    if tutor_ids:
        blocks_result = await db.execute(
            select(ScheduleBlock).where(
                ScheduleBlock.tutor_id.in_(tutor_ids),
                ScheduleBlock.status == "ACTIVE",
            )
        )
        for block in blocks_result.scalars().all():
            blocks_by_tutor.setdefault(block.tutor_id, []).append(block)

    scored: list[dict] = []

    for tutor in all_tutors:
        score = Decimal("0")
        reasons: list[str] = []

        # ── Subject match ────────────────────────────────
        matching_subject = None
        for ts in tutor.subjects:
            if ts.status != "APPROVED":
                continue
            if need.subject_id and ts.subject_id == need.subject_id:
                matching_subject = ts
                break

        if not matching_subject and need.subject_id:
            continue  # No subject match → skip

        if matching_subject:
            score += Decimal(str(W_SUBJECT_MATCH))
            reasons.append(f"Dạy môn phù hợp")

            # ── Grade match ──────────────────────────────
            if need.grade_level and matching_subject.grade_level:
                if need.grade_level.lower() in matching_subject.grade_level.lower():
                    score += Decimal(str(W_GRADE_MATCH))
                    reasons.append(f"Cấp lớp phù hợp: {matching_subject.grade_level}")

            # ── Fee match ────────────────────────────────
            fee = matching_subject.fee_per_session
            if need.budget_per_session_min and need.budget_per_session_max:
                if need.budget_per_session_min <= fee <= need.budget_per_session_max:
                    score += Decimal(str(W_FEE_MATCH))
                    reasons.append(f"Học phí {fee:,.0f} phù hợp ngân sách")
                elif fee < need.budget_per_session_min:
                    score += Decimal(str(W_FEE_MATCH * 0.5))
                    reasons.append(f"Học phí {fee:,.0f} (thấp hơn ngân sách)")
            elif need.budget_per_session_max:
                if fee <= need.budget_per_session_max:
                    score += Decimal(str(W_FEE_MATCH))
                    reasons.append(f"Học phí {fee:,.0f} phù hợp")

        # ── Mode match ───────────────────────────────────
        if need.preferred_mode and need.preferred_mode != "BOTH":
            if tutor.teaching_mode == need.preferred_mode or tutor.teaching_mode == "BOTH":
                score += Decimal(str(W_MODE_MATCH))
                reasons.append(f"Hình thức dạy phù hợp: {tutor.teaching_mode}")
            else:
                continue  # Mode mismatch → skip
        else:
            score += Decimal(str(W_MODE_MATCH))

        # ── Schedule match ───────────────────────────────
        if hasattr(need, 'schedules') and need.schedules:
            schedule_match = _check_schedule_overlap(need.schedules, tutor.availabilities)
            if schedule_match > 0:
                score += Decimal(str(W_SCHEDULE_MATCH * min(schedule_match, 1.0)))
                reasons.append(f"Lịch khớp {schedule_match*100:.0f}%")
        else:
            score += Decimal(str(W_SCHEDULE_MATCH * 0.5))

        # ── Schedule block conflict check ────────────────
        active_blocks = blocks_by_tutor.get(tutor.id, [])

        if hasattr(need, 'schedules') and need.schedules and active_blocks:
            has_conflict = _check_block_conflict(need.schedules, active_blocks)
            if has_conflict:
                score -= Decimal("20")
                reasons.append("⚠️ Có trùng lịch đã khóa")

        # ── Rating bonus ─────────────────────────────────
        if tutor.average_rating > 0:
            rating_bonus = float(tutor.average_rating) / 5.0 * W_RATING
            score += Decimal(str(round(rating_bonus, 2)))
            reasons.append(f"Đánh giá {tutor.average_rating}/5 ({tutor.rating_count} lượt)")

        # ── Experience bonus ─────────────────────────────
        if tutor.years_experience > 0:
            exp_bonus = min(tutor.years_experience / 10.0, 1.0) * W_EXPERIENCE
            score += Decimal(str(round(exp_bonus, 2)))
            reasons.append(f"Kinh nghiệm {tutor.years_experience} năm")

        scored.append({
            "tutor": tutor,
            "score": round(score, 2),
            "reasons": reasons,
        })

    # Sort by score desc
    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


# ── Class scoring ────────────────────────────────────────


async def _filter_and_score_classes(
    need: LearningNeed,
    db: AsyncSession,
    limit: int,
) -> list[dict]:
    """Filter enrolling classes and score them against the learning need."""

    query = select(CourseClass).where(
        CourseClass.status.in_(("ENROLLING", "READY", "TUTOR_RECRUITING"))
    )
    if need.subject_id:
        query = query.where(CourseClass.subject_id == need.subject_id)
    result = await db.execute(query)
    all_classes = result.scalars().all()

    class_ids = [cc.id for cc in all_classes]
    registration_counts: dict[int, int] = {}
    if class_ids:
        count_result = await db.execute(
            select(
                ClassRegistration.class_id,
                func.count().label("count"),
            )
            .where(
                ClassRegistration.class_id.in_(class_ids),
                ClassRegistration.status.in_(("PENDING", "APPROVED", "PAID")),
            )
            .group_by(ClassRegistration.class_id)
        )
        for class_id, count in count_result.all():
            registration_counts[class_id] = count

    scored: list[dict] = []

    for cc in all_classes:
        score = Decimal("0")
        reasons: list[str] = []

        # ── Subject match ────────────────────────────────
        if need.subject_id and cc.subject_id == need.subject_id:
            score += Decimal(str(W_SUBJECT_MATCH))
            reasons.append("Môn học phù hợp")
        elif need.subject_id:
            continue

        # ── Grade match ──────────────────────────────────
        if need.grade_level and cc.grade_level:
            if need.grade_level.lower() in cc.grade_level.lower():
                score += Decimal(str(W_GRADE_MATCH))
                reasons.append(f"Cấp lớp: {cc.grade_level}")

        # ── Fee match ────────────────────────────────────
        fee = cc.fee_per_session_per_student
        if need.budget_per_session_max and fee <= need.budget_per_session_max:
            score += Decimal(str(W_FEE_MATCH))
            reasons.append(f"Học phí {fee:,.0f}/buổi phù hợp")

        # ── Mode match ───────────────────────────────────
        if need.preferred_mode and need.preferred_mode != "BOTH":
            if cc.mode == need.preferred_mode or cc.mode == "BOTH":
                score += Decimal(str(W_MODE_MATCH))
                reasons.append(f"Hình thức: {cc.mode}")
            else:
                continue
        else:
            score += Decimal(str(W_MODE_MATCH))

        # ── Learning type match ──────────────────────────
        if need.preferred_learning_type in ("GROUP", "BOTH"):
            score += Decimal("5")
            reasons.append("Phù hợp hình thức học nhóm")

        # ── Slot availability ────────────────────────────
        current_count = registration_counts.get(cc.id, 0)
        if current_count < cc.max_students:
            remaining = cc.max_students - current_count
            reasons.append(f"Còn {remaining} chỗ trống")
        else:
            continue  # Full → skip

        scored.append({
            "course_class": cc,
            "score": round(score, 2),
            "reasons": reasons,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


# ── Schedule overlap helper ──────────────────────────────


def _check_schedule_overlap(
    need_schedules: list,
    tutor_availabilities: list,
) -> float:
    """Return a 0-1 overlap ratio between student's desired schedule and tutor's availability."""
    if not need_schedules or not tutor_availabilities:
        return 0.0

    matched = 0
    total = len(need_schedules)

    for ns in need_schedules:
        for ta in tutor_availabilities:
            if ns.day_of_week != ta.day_of_week:
                continue

            # time_slot based match
            if ns.time_slot:
                slot_ranges = {
                    "MORNING": (7, 12),
                    "AFTERNOON": (13, 17),
                    "EVENING": (18, 21),
                }
                slot_range = slot_ranges.get(ns.time_slot)
                if slot_range:
                    ta_start_h = ta.start_time.hour
                    ta_end_h = ta.end_time.hour
                    if ta_start_h <= slot_range[0] and ta_end_h >= slot_range[1]:
                        matched += 1
                        break
                    elif ta_start_h < slot_range[1] and ta_end_h > slot_range[0]:
                        matched += 0.5
                        break

            # Exact time match
            elif ns.start_time and ns.end_time:
                if ta.start_time <= ns.start_time and ta.end_time >= ns.end_time:
                    matched += 1
                    break

    return matched / total if total > 0 else 0.0


def _check_block_conflict(
    need_schedules: list,
    active_blocks: list,
) -> bool:
    """Check if any desired schedule slot conflicts with tutor's active blocks."""
    for ns in need_schedules:
        for block in active_blocks:
            if ns.day_of_week != block.day_of_week:
                continue

            # Check time overlap
            if ns.time_slot:
                slot_ranges = {
                    "MORNING": (7, 12),
                    "AFTERNOON": (13, 17),
                    "EVENING": (18, 21),
                }
                slot_range = slot_ranges.get(ns.time_slot)
                if slot_range:
                    block_start_h = block.start_time.hour
                    block_end_h = block.end_time.hour
                    if block_start_h < slot_range[1] and block_end_h > slot_range[0]:
                        return True  # Conflict found

            elif ns.start_time and ns.end_time:
                if block.start_time < ns.end_time and block.end_time > ns.start_time:
                    return True  # Conflict found

    return False

