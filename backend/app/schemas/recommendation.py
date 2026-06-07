"""Schemas for recommendation results."""

from decimal import Decimal

from pydantic import BaseModel, Field

from app.schemas.tutor import TutorPublicResponse
from app.schemas.course_class import CourseClassResponse


class RecommendedTutor(BaseModel):
    tutor: TutorPublicResponse
    score: Decimal
    reasons: list[str]


class RecommendedClass(BaseModel):
    course_class: CourseClassResponse
    score: Decimal
    reasons: list[str]


class RecommendationResponse(BaseModel):
    recommended_tutors: list[RecommendedTutor] = Field(default_factory=list)
    recommended_classes: list[RecommendedClass] = Field(default_factory=list)
