# Lumin Tutor Recommendation

**Lumin** là hệ thống gợi ý và kết nối gia sư theo hướng tiếp cận kết hợp.

Mục tiêu của repo này là triển khai một website giúp:

- Học viên tìm kiếm, nhận gợi ý và đăng ký gia sư/lớp học phù hợp.
- Gia sư tạo hồ sơ, tải chứng chỉ và chờ trung tâm duyệt.
- Staff/super admin quản lý gia sư, lớp học, đăng ký, điều phối và doanh thu.
- Hệ thống gợi ý dựa trên hybrid recommendation: content-based, business rule và collaborative signal.

## File cần đọc trước khi nhận task

1. [docs/PROJECT_BRIEF.md](docs/PROJECT_BRIEF.md)
2. [docs/01-roles-and-operations.md](docs/01-roles-and-operations.md)
3. [docs/02-business-flows.md](docs/02-business-flows.md)
4. [docs/03-data-model-and-erd.md](docs/03-data-model-and-erd.md)
5. [docs/04-schema-basic.sql](docs/04-schema-basic.sql)
6. [docs/05-tech-stack.md](docs/05-tech-stack.md)
7. [docs/06-phase-1-setup-decisions.md](docs/06-phase-1-setup-decisions.md)
8. [docs/BUSINESS_DECISIONS.md](docs/BUSINESS_DECISIONS.md)
9. [TASKS.md](TASKS.md)

## Tech stack đã chốt

- Backend: FastAPI + SQLAlchemy + Alembic
- Frontend: React + Vite
- Database: PostgreSQL
- AI assistant/recommendation: Python module trong backend trước
- Payment: mock gateway
- Deploy MVP: Docker Compose
- Cloud database: Supabase PostgreSQL, không dùng Supabase Auth trong MVP

## Trạng thái hiện tại

Repo đang ở phase thiết kế và bóc task. Chưa bắt đầu source code production.
