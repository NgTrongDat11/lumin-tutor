"""Subject catalog API — list, create, update, delete."""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.subject import Subject
from app.models.user_account import UserAccount
from app.schemas.common import ApiResponse

router = APIRouter(prefix="/subjects", tags=["Subjects"])


class SubjectCreate(BaseModel):
    name: str = Field(max_length=100)
    description: str | None = None


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, max_length=100)
    description: str | None = None
    status: str | None = None


@router.get("", response_model=ApiResponse, summary="Danh sách môn học")
async def list_subjects(
    db: AsyncSession = Depends(get_db),
    current_user: UserAccount = Depends(get_current_user),
):
    result = await db.execute(
        select(Subject).where(Subject.status == "ACTIVE").order_by(Subject.name)
    )
    subjects = result.scalars().all()
    data = [
        {"id": s.id, "name": s.name, "description": s.description, "status": s.status}
        for s in subjects
    ]
    return ApiResponse(data=data)


@router.post(
    "",
    response_model=ApiResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Staff thêm môn học",
)
async def create_subject(
    body: SubjectCreate,
    current_user: UserAccount = Depends(require_role("STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    # Check duplicate name
    existing = await db.execute(select(Subject).where(Subject.name == body.name))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Môn học đã tồn tại.")

    subject = Subject(name=body.name, description=body.description)
    db.add(subject)
    await db.commit()
    await db.refresh(subject)
    return ApiResponse(
        data={"id": subject.id, "name": subject.name, "description": subject.description},
        message="Thêm môn học thành công.",
    )


@router.put("/{subject_id}", response_model=ApiResponse, summary="Staff cập nhật môn học")
async def update_subject(
    subject_id: int,
    body: SubjectUpdate,
    current_user: UserAccount = Depends(require_role("STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy môn học.")

    update_data = body.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(subject, key, value)
    await db.commit()
    return ApiResponse(message="Cập nhật môn học thành công.")


@router.delete("/{subject_id}", response_model=ApiResponse, summary="Staff xoá (ẩn) môn học")
async def delete_subject(
    subject_id: int,
    current_user: UserAccount = Depends(require_role("STAFF", "SUPER_ADMIN")),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Subject).where(Subject.id == subject_id))
    subject = result.scalar_one_or_none()
    if not subject:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Không tìm thấy môn học.")

    # Soft delete: set INACTIVE instead of removing
    subject.status = "INACTIVE"
    await db.commit()
    return ApiResponse(message="Đã ẩn môn học.")
