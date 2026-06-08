"""Pydantic schemas for contextual user messaging."""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class MessageParticipantResponse(BaseModel):
    account_id: int
    full_name: str
    role: str


class MessageResponse(BaseModel):
    id: int
    thread_id: int
    sender_id: int
    sender_name: str | None = None
    content: str
    created_at: datetime
    is_mine: bool = False

    model_config = {"from_attributes": True}


class MessageThreadResponse(BaseModel):
    id: int
    private_request_id: int | None = None
    class_id: int | None = None
    class_registration_id: int | None = None
    title: str | None = None
    status: str
    participants: list[MessageParticipantResponse] = Field(default_factory=list)
    last_message: MessageResponse | None = None
    messages: list[MessageResponse] = Field(default_factory=list)
    unread_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class MessageThreadEnsureRequest(BaseModel):
    private_request_id: int | None = None
    class_id: int | None = None
    class_registration_id: int | None = None
    support: bool = False
    title: str | None = Field(default=None, max_length=255)

    @model_validator(mode="after")
    def validate_context(self) -> "MessageThreadEnsureRequest":
        context_count = sum(
            value is not None
            for value in (self.private_request_id, self.class_id, self.class_registration_id)
        )
        if self.support:
            if context_count:
                raise ValueError("Support thread không gắn với lớp/yêu cầu cụ thể.")
        elif context_count != 1:
            raise ValueError("Thread phải gắn với đúng một ngữ cảnh nghiệp vụ.")
        return self


class MessageCreateRequest(BaseModel):
    content: str = Field(min_length=1, max_length=2000)
