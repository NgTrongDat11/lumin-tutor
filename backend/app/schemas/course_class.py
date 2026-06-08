"""Schemas for course classes, tutor applications, and student registrations."""

from decimal import Decimal

from pydantic import BaseModel, Field


# ── Course Class ─────────────────────────────────────────


class CourseClassCreate(BaseModel):
    subject_id: int
    title: str = Field(max_length=255)
    grade_level: str = Field(max_length=100)
    goal: str | None = None
    fee_per_session_per_student: Decimal = Field(gt=0)
    total_sessions: int = Field(gt=0)
    min_students: int = Field(ge=1, default=1)
    max_students: int = Field(ge=1)
    mode: str = "OFFLINE"
    location: str | None = None


class CourseClassResponse(BaseModel):
    id: int
    private_request_id: int | None = None
    subject_id: int
    primary_tutor_id: int | None
    title: str
    grade_level: str
    goal: str | None
    fee_per_session_per_student: Decimal
    total_sessions: int
    min_students: int
    max_students: int
    mode: str
    location: str | None
    status: str
    created_by_account_id: int | None

    # Enriched
    tutor_name: str | None = None

    model_config = {"from_attributes": True}


# ── Tutor Application ───────────────────────────────────


class TutorApplicationCreate(BaseModel):
    message: str | None = None


class TutorApplicationResponse(BaseModel):
    id: int
    class_id: int
    tutor_id: int
    status: str
    message: str | None

    model_config = {"from_attributes": True}


# ── Class Registration ───────────────────────────────────


class ClassRegistrationCreate(BaseModel):
    learning_need_id: int | None = None


class ClassRegistrationResponse(BaseModel):
    id: int
    class_id: int
    private_request_id: int | None = None
    student_account_id: int
    learning_need_id: int | None
    status: str
    review_note: str | None

    # Enriched
    class_title: str | None = None
    tutor_name: str | None = None
    subject_name: str | None = None
    total_sessions: int | None = None
    fee_per_session_per_student: Decimal | None = None

    model_config = {"from_attributes": True}
