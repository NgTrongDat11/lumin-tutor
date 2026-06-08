"""Contextual messaging API for students, tutors, staff, and admins."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.v1.notifications import create_notifications_bulk
from app.core.deps import get_current_user, get_db
from app.models.class_registration import ClassRegistration
from app.models.course_class import CourseClass
from app.models.message import Message
from app.models.message_thread import MessageThread
from app.models.message_thread_participant import MessageThreadParticipant
from app.models.private_tutoring_request import PrivateTutoringRequest
from app.models.tutor_profile import TutorProfile
from app.models.user_account import UserAccount
from app.schemas.common import ApiResponse
from app.schemas.message import (
    MessageCreateRequest,
    MessageParticipantResponse,
    MessageResponse,
    MessageThreadEnsureRequest,
    MessageThreadResponse,
)

router = APIRouter(prefix="/messages", tags=["Messages"])


@router.get("/threads", response_model=ApiResponse, summary="Danh sách hội thoại")
async def list_threads(
    current_user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    participant_rows = await db.execute(
        select(MessageThreadParticipant.thread_id).where(
            MessageThreadParticipant.account_id == current_user.id
        )
    )
    thread_ids = [row[0] for row in participant_rows.all()]
    if not thread_ids:
        return ApiResponse(data=[])

    result = await db.execute(
        select(MessageThread)
        .where(MessageThread.id.in_(thread_ids))
        .order_by(MessageThread.updated_at.desc(), MessageThread.created_at.desc())
    )
    threads = result.scalars().all()
    return ApiResponse(data=[await _serialize_thread(thread, current_user.id, db) for thread in threads])


@router.post("/threads", response_model=ApiResponse, status_code=status.HTTP_201_CREATED, summary="Mở hoặc tạo hội thoại")
async def ensure_thread(
    body: MessageThreadEnsureRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    thread, participant_ids = await _resolve_or_create_thread(body, current_user, db)
    await _ensure_participants(thread.id, participant_ids, db)
    await db.commit()
    await db.refresh(thread)
    return ApiResponse(data=await _serialize_thread(thread, current_user.id, db))


@router.get("/threads/{thread_id}", response_model=ApiResponse, summary="Chi tiết hội thoại")
async def get_thread_detail(
    thread_id: int,
    current_user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    thread = await _get_thread_for_participant(thread_id, current_user.id, db)
    await _mark_read(thread_id, current_user.id, db)
    await db.commit()
    return ApiResponse(data=await _serialize_thread(thread, current_user.id, db, include_messages=True))


@router.get("/threads/{thread_id}/messages", response_model=ApiResponse, summary="Tin nhắn trong hội thoại")
async def list_messages(
    thread_id: int,
    current_user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await _get_thread_for_participant(thread_id, current_user.id, db)
    result = await db.execute(
        select(Message)
        .where(Message.thread_id == thread_id)
        .order_by(Message.created_at.asc(), Message.id.asc())
    )
    messages = result.scalars().all()
    await _mark_read(thread_id, current_user.id, db)
    await db.commit()
    return ApiResponse(data=await _serialize_messages(messages, current_user.id, db))


@router.post("/threads/{thread_id}/messages", response_model=ApiResponse, status_code=status.HTTP_201_CREATED, summary="Gửi tin nhắn")
async def send_message(
    thread_id: int,
    body: MessageCreateRequest,
    current_user: UserAccount = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    thread = await _get_thread_for_participant(thread_id, current_user.id, db)
    if thread.status != "OPEN":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Hội thoại đã đóng.")

    content = body.content.strip()
    if not content:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Tin nhắn không được để trống.")

    message = Message(thread_id=thread.id, sender_id=current_user.id, content=content)
    thread.updated_at = datetime.utcnow()
    db.add(message)
    await db.flush()

    recipients = await _participant_ids(thread.id, db)
    notify_ids = [account_id for account_id in recipients if account_id != current_user.id]
    await db.commit()
    await db.refresh(message)

    if notify_ids:
        try:
            await create_notifications_bulk(
                db,
                user_ids=notify_ids,
                notification_type="NEW_MESSAGE",
                title=f"Tin nhắn mới từ {current_user.full_name}",
                body=content[:160],
                reference_type="message_thread",
                reference_id=thread.id,
            )
            await db.commit()
        except SQLAlchemyError:
            await db.rollback()

    return ApiResponse(data=(await _serialize_messages([message], current_user.id, db))[0])


async def _resolve_or_create_thread(
    body: MessageThreadEnsureRequest,
    current_user: UserAccount,
    db: AsyncSession,
) -> tuple[MessageThread, list[int]]:
    if body.support:
        participant_ids = await _support_participants(current_user, db)
        existing = await _find_support_thread(current_user.id, db)
        if existing:
            return existing, participant_ids
        thread = MessageThread(title=body.title or "Hỗ trợ trung tâm")
        db.add(thread)
        await db.flush()
        return thread, participant_ids

    if body.private_request_id is not None:
        private_request, participant_ids = await _private_request_context(body.private_request_id, current_user, db)
        existing = await _find_thread(private_request_id=private_request.id, db=db)
        if existing:
            return existing, participant_ids
        thread = MessageThread(
            private_request_id=private_request.id,
            title=body.title or f"Yêu cầu 1-1 #{private_request.id}",
        )
        db.add(thread)
        await db.flush()
        return thread, participant_ids

    if body.class_registration_id is not None:
        registration, course_class, participant_ids = await _class_registration_context(
            body.class_registration_id, current_user, db
        )
        existing = await _find_thread(class_registration_id=registration.id, db=db)
        if existing:
            return existing, participant_ids
        thread = MessageThread(
            class_registration_id=registration.id,
            title=body.title or f"Đăng ký lớp: {course_class.title}",
        )
        db.add(thread)
        await db.flush()
        return thread, participant_ids

    course_class, participant_ids = await _class_context(body.class_id or 0, current_user, db)
    existing = await _find_thread(class_id=course_class.id, db=db)
    if existing:
        return existing, participant_ids
    thread = MessageThread(class_id=course_class.id, title=body.title or course_class.title)
    db.add(thread)
    await db.flush()
    return thread, participant_ids


async def _private_request_context(
    request_id: int,
    current_user: UserAccount,
    db: AsyncSession,
) -> tuple[PrivateTutoringRequest, list[int]]:
    result = await db.execute(select(PrivateTutoringRequest).where(PrivateTutoringRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy yêu cầu 1-1.")

    tutor_account_id = await _tutor_account_id(req.tutor_id, db)
    allowed = {req.student_account_id, tutor_account_id}
    if current_user.role in ("STAFF", "SUPER_ADMIN"):
        allowed.add(current_user.id)
    if current_user.id not in allowed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền mở hội thoại này.")
    return req, list(allowed)


async def _class_registration_context(
    registration_id: int,
    current_user: UserAccount,
    db: AsyncSession,
) -> tuple[ClassRegistration, CourseClass, list[int]]:
    result = await db.execute(
        select(ClassRegistration, CourseClass)
        .join(CourseClass, ClassRegistration.class_id == CourseClass.id)
        .where(ClassRegistration.id == registration_id)
    )
    row = result.one_or_none()
    if not row:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy đăng ký lớp.")

    registration, course_class = row
    participant_ids = {registration.student_account_id}
    if course_class.primary_tutor_id:
        participant_ids.add(await _tutor_account_id(course_class.primary_tutor_id, db))
    participant_ids.update(await _operator_ids(db, exclude_account_id=None))
    if current_user.role in ("STAFF", "SUPER_ADMIN"):
        participant_ids.add(current_user.id)

    if current_user.role == "STUDENT" and current_user.id != registration.student_account_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền mở hội thoại này.")
    if current_user.role == "TUTOR" and current_user.id not in participant_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền mở hội thoại này.")
    if current_user.role not in ("STUDENT", "TUTOR", "STAFF", "SUPER_ADMIN"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền mở hội thoại này.")

    return registration, course_class, list(participant_ids)


async def _class_context(
    class_id: int,
    current_user: UserAccount,
    db: AsyncSession,
) -> tuple[CourseClass, list[int]]:
    result = await db.execute(select(CourseClass).where(CourseClass.id == class_id))
    course_class = result.scalar_one_or_none()
    if not course_class:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy lớp.")

    participant_ids = {current_user.id}
    if course_class.primary_tutor_id:
        participant_ids.add(await _tutor_account_id(course_class.primary_tutor_id, db))

    if current_user.role == "STUDENT":
        registered = await db.execute(
            select(ClassRegistration.id).where(
                ClassRegistration.class_id == class_id,
                ClassRegistration.student_account_id == current_user.id,
            )
        )
        if not registered.scalar_one_or_none():
            raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn chưa thuộc lớp này.")
    elif current_user.role == "TUTOR" and current_user.id not in participant_ids:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không phụ trách lớp này.")
    elif current_user.role not in ("STAFF", "SUPER_ADMIN", "TUTOR"):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Bạn không có quyền mở hội thoại này.")

    return course_class, list(participant_ids)


async def _support_participants(current_user: UserAccount, db: AsyncSession) -> list[int]:
    operator_ids = await _operator_ids(db, exclude_account_id=current_user.id)
    if not operator_ids and current_user.role not in ("SUPER_ADMIN", "STAFF"):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Chưa có tài khoản vận hành để nhận hỗ trợ.")
    return [current_user.id, *operator_ids]


async def _operator_ids(db: AsyncSession, exclude_account_id: int | None) -> list[int]:
    result = await db.execute(
        select(UserAccount.id)
        .where(
            UserAccount.role.in_(("SUPER_ADMIN", "STAFF")),
            UserAccount.status == "ACTIVE",
        )
        .order_by(UserAccount.role.desc(), UserAccount.id.asc())
    )
    return [row[0] for row in result.all() if row[0] != exclude_account_id]


async def _find_support_thread(current_user_id: int, db: AsyncSession) -> MessageThread | None:
    result = await db.execute(
        select(MessageThread)
        .join(MessageThreadParticipant, MessageThreadParticipant.thread_id == MessageThread.id)
        .where(
            MessageThreadParticipant.account_id == current_user_id,
            MessageThread.private_request_id.is_(None),
            MessageThread.class_id.is_(None),
            MessageThread.class_registration_id.is_(None),
        )
        .order_by(MessageThread.created_at.desc())
    )
    return result.scalars().first()


async def _find_thread(
    db: AsyncSession,
    private_request_id: int | None = None,
    class_id: int | None = None,
    class_registration_id: int | None = None,
) -> MessageThread | None:
    result = await db.execute(
        select(MessageThread).where(
            MessageThread.private_request_id == private_request_id,
            MessageThread.class_id == class_id,
            MessageThread.class_registration_id == class_registration_id,
        )
    )
    return result.scalar_one_or_none()


async def _tutor_account_id(tutor_id: int, db: AsyncSession) -> int:
    result = await db.execute(select(TutorProfile.account_id).where(TutorProfile.id == tutor_id))
    account_id = result.scalar_one_or_none()
    if not account_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy tài khoản gia sư.")
    return account_id


async def _ensure_participants(thread_id: int, account_ids: list[int], db: AsyncSession) -> None:
    if not account_ids:
        return
    existing = await db.execute(
        select(MessageThreadParticipant.account_id).where(
            MessageThreadParticipant.thread_id == thread_id,
            MessageThreadParticipant.account_id.in_(account_ids),
        )
    )
    existing_ids = {row[0] for row in existing.all()}
    for account_id in dict.fromkeys(account_ids):
        if account_id not in existing_ids:
            db.add(MessageThreadParticipant(thread_id=thread_id, account_id=account_id))


async def _get_thread_for_participant(
    thread_id: int,
    account_id: int,
    db: AsyncSession,
) -> MessageThread:
    result = await db.execute(
        select(MessageThread)
        .join(MessageThreadParticipant, MessageThreadParticipant.thread_id == MessageThread.id)
        .where(MessageThread.id == thread_id, MessageThreadParticipant.account_id == account_id)
    )
    thread = result.scalar_one_or_none()
    if not thread:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy hội thoại.")
    return thread


async def _participant_ids(thread_id: int, db: AsyncSession) -> list[int]:
    result = await db.execute(
        select(MessageThreadParticipant.account_id).where(MessageThreadParticipant.thread_id == thread_id)
    )
    return [row[0] for row in result.all()]


async def _mark_read(thread_id: int, account_id: int, db: AsyncSession) -> None:
    result = await db.execute(
        select(MessageThreadParticipant).where(
            MessageThreadParticipant.thread_id == thread_id,
            MessageThreadParticipant.account_id == account_id,
        )
    )
    participant = result.scalar_one_or_none()
    if participant:
        participant.last_read_at = datetime.utcnow()


async def _serialize_thread(
    thread: MessageThread,
    current_user_id: int,
    db: AsyncSession,
    include_messages: bool = False,
) -> MessageThreadResponse:
    participant_result = await db.execute(
        select(UserAccount.id, UserAccount.full_name, UserAccount.role)
        .join(MessageThreadParticipant, MessageThreadParticipant.account_id == UserAccount.id)
        .where(MessageThreadParticipant.thread_id == thread.id)
        .order_by(UserAccount.role, UserAccount.full_name)
    )
    participants = [
        MessageParticipantResponse(account_id=row[0], full_name=row[1], role=row[2])
        for row in participant_result.all()
    ]

    last_result = await db.execute(
        select(Message)
        .where(Message.thread_id == thread.id)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .limit(1)
    )
    last_message = last_result.scalar_one_or_none()

    participant_state = await db.execute(
        select(MessageThreadParticipant.last_read_at).where(
            MessageThreadParticipant.thread_id == thread.id,
            MessageThreadParticipant.account_id == current_user_id,
        )
    )
    last_read_at = participant_state.scalar_one_or_none()
    unread_predicates = [
        Message.thread_id == thread.id,
        Message.sender_id != current_user_id,
    ]
    if last_read_at is not None:
        unread_predicates.append(Message.created_at > last_read_at)
    unread_result = await db.execute(select(func.count()).select_from(Message).where(and_(*unread_predicates)))
    unread_count = unread_result.scalar() or 0

    response = MessageThreadResponse.model_validate(thread)
    response.participants = participants
    response.unread_count = unread_count
    if last_message:
        response.last_message = (await _serialize_messages([last_message], current_user_id, db))[0]
    if include_messages:
        messages_result = await db.execute(
            select(Message)
            .where(Message.thread_id == thread.id)
            .order_by(Message.created_at.asc(), Message.id.asc())
        )
        response.messages = await _serialize_messages(messages_result.scalars().all(), current_user_id, db)
    return response


async def _serialize_messages(
    messages: list[Message],
    current_user_id: int,
    db: AsyncSession,
) -> list[MessageResponse]:
    if not messages:
        return []
    sender_ids = {message.sender_id for message in messages}
    result = await db.execute(select(UserAccount.id, UserAccount.full_name).where(UserAccount.id.in_(sender_ids)))
    names = {row[0]: row[1] for row in result.all()}
    data = []
    for message in messages:
        resp = MessageResponse.model_validate(message)
        resp.sender_name = names.get(message.sender_id)
        resp.is_mine = message.sender_id == current_user_id
        data.append(resp)
    return data
