"""Schemas for private tutoring requests."""

from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field


class PrivateRequestCreate(BaseModel):
    tutor_id: int
    learning_need_id: int | None = None
    subject_id: int
    grade_level: str = Field(max_length=100)
    goal: str | None = None
    requested_sessions: int = Field(gt=0)
    mode: str = "ONLINE"


class TutorConfirmRequest(BaseModel):
    agreed_fee_per_session: Decimal = Field(gt=0)
    agreed_sessions: int | None = Field(default=None, gt=0)
    class_title: str | None = Field(default=None, max_length=200)
    response_note: str | None = None


class TutorRejectRequest(BaseModel):
    response_note: str | None = None


class PrivateRequestResponse(BaseModel):
    id: int
    student_account_id: int
    tutor_id: int
    learning_need_id: int | None
    subject_id: int
    grade_level: str
    goal: str | None
    requested_sessions: int
    agreed_fee_per_session: Decimal | None
    mode: str
    status: str
    tutor_response_note: str | None
    confirmed_at: datetime | None

    # Enriched fields
    tutor_name: str | None = None
    student_name: str | None = None
    subject_name: str | None = None

    model_config = {"from_attributes": True}
