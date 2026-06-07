"""Schemas for learning needs."""

from datetime import time
from decimal import Decimal

from pydantic import BaseModel, Field


class LearningNeedScheduleCreate(BaseModel):
    day_of_week: int = Field(ge=1, le=7)
    start_time: time | None = None
    end_time: time | None = None
    time_slot: str | None = None  # MORNING, AFTERNOON, EVENING


class LearningNeedCreate(BaseModel):
    subject_id: int | None = None
    grade_level: str | None = None
    goal: str | None = None
    budget_per_session_min: Decimal | None = None
    budget_per_session_max: Decimal | None = None
    preferred_mode: str = "BOTH"
    preferred_learning_type: str = "BOTH"
    preferred_area: str | None = None
    raw_text: str | None = None
    schedules: list[LearningNeedScheduleCreate] = Field(default_factory=list)


class LearningNeedScheduleResponse(BaseModel):
    id: int
    day_of_week: int
    start_time: time | None
    end_time: time | None
    time_slot: str | None

    model_config = {"from_attributes": True}


class LearningNeedResponse(BaseModel):
    id: int
    student_account_id: int
    subject_id: int | None
    grade_level: str | None
    goal: str | None
    budget_per_session_min: Decimal | None
    budget_per_session_max: Decimal | None
    preferred_mode: str
    preferred_learning_type: str
    preferred_area: str | None
    raw_text: str | None
    parsed_data: str | None
    parser_source: str
    parsed_confidence: Decimal | None
    status: str
    schedules: list[LearningNeedScheduleResponse] = Field(default_factory=list)

    model_config = {"from_attributes": True}
