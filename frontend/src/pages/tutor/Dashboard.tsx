import { useEffect, useState, type ComponentType } from 'react';
import { Link } from 'react-router-dom';
import { classApi, privateRequestApi, scheduleApi, tutorApi } from '../../services/api';
import type {
  CourseClassResponse,
  LearningSessionResponse,
  PrivateRequestResponse,
  QualificationResponse,
  TutorAvailabilityResponse,
  TutorProfileResponse,
  TutorSubjectResponse,
} from '../../types';
import { useAuth } from '../../hooks/useAuth';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { getStatusBadge } from '../../components/ui/Badge';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarIcon,
  ClipboardCheckIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
} from '../../components/ui/Icons';
import Avatar from '../../components/ui/Avatar';

type IconType = ComponentType<{ className?: string }>;

function formatMoney(value: string | number | null | undefined) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function verificationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    DRAFT: 'Bản nháp',
    PENDING_REVIEW: 'Chờ duyệt',
    VERIFIED: 'Đã xác minh',
    REJECTED: 'Từ chối',
  };
  return labels[status] || status;
}

function teachingModeLabel(mode: string | null | undefined) {
  if (mode === 'ONLINE') return 'Trực tuyến';
  if (mode === 'OFFLINE') return 'Trực tiếp';
  if (mode === 'BOTH') return 'Trực tuyến hoặc trực tiếp';
  return 'Chưa rõ';
}

function getProfileScore(
  profile: TutorProfileResponse | null,
  subjects: TutorSubjectResponse[],
  qualifications: QualificationResponse[],
  availabilities: TutorAvailabilityResponse[],
) {
  const checks = [
    Boolean(profile?.bio),
    Boolean(profile?.qualification_level),
    Number(profile?.years_experience || 0) > 0,
    subjects.length > 0,
    qualifications.length > 0,
    availabilities.length > 0,
    profile?.verification_status === 'VERIFIED',
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export default function TutorDashboard() {
  const { user, tutorProfile } = useAuth();
  const [profile, setProfile] = useState<TutorProfileResponse | null>(null);
  const [subjects, setSubjects] = useState<TutorSubjectResponse[]>([]);
  const [qualifications, setQualifications] = useState<QualificationResponse[]>([]);
  const [availabilities, setAvailabilities] = useState<TutorAvailabilityResponse[]>([]);
  const [requests, setRequests] = useState<PrivateRequestResponse[]>([]);
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [sessions, setSessions] = useState<LearningSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      tutorApi.getProfile().catch(() => null),
      tutorApi.getSubjects().catch(() => []),
      tutorApi.getQualifications().catch(() => []),
      tutorApi.getAvailabilities().catch(() => []),
      privateRequestApi.list().catch(() => []),
      classApi.list().catch(() => []),
      scheduleApi.listSessions().catch(() => []),
    ]).then(([p, s, q, a, r, c, sessionList]) => {
      setProfile(p);
      setSubjects(s);
      setQualifications(q);
      setAvailabilities(a);
      setRequests(r);
      setClasses(c);
      setSessions(sessionList);
      setLoading(false);
    });
  }, []);

  if (loading) return <DashboardSkeleton />;

  const pendingRequests = requests.filter((r) => r.status === 'SENT');
  const recruitingClasses = classes.filter((c) => ['TUTOR_RECRUITING', 'ENROLLING'].includes(c.status)).slice(0, 4);
  const upcomingSessions = sessions.filter((s) => s.status === 'SCHEDULED').slice(0, 4);
  const profileScore = getProfileScore(profile, subjects, qualifications, availabilities);

  const metrics: { label: string; value: string | number; icon: IconType }[] = [
    { label: 'Hoàn thiện hồ sơ', value: `${profileScore}%`, icon: UserCheckIcon },
    { label: 'Môn đang dạy', value: subjects.length, icon: BookOpenIcon },
    { label: 'Yêu cầu mới', value: pendingRequests.length, icon: UsersIcon },
    { label: 'Buổi sắp tới', value: upcomingSessions.length, icon: CalendarIcon },
  ];

  return (
    <div className="mx-auto max-w-7xl animate-slide-up space-y-8">
      {profile && profile.verification_status !== 'VERIFIED' && (
        <div className="rounded-lg bg-warning-50 p-4 border border-warning-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <ShieldCheckIcon className="h-5 w-5 text-warning-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-warning-800">Tài khoản chưa được duyệt</h3>
              <div className="mt-2 text-sm text-warning-700">
                <p>Hồ sơ của bạn đang ở trạng thái <strong>{verificationStatusLabel(profile.verification_status)}</strong>. Bạn không thể nhận lớp hay xác nhận yêu cầu học 1-1 cho đến khi được nhân viên duyệt. Vui lòng cập nhật hồ sơ và gửi duyệt.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="rounded-lg bg-text-primary p-6 text-white shadow-xl md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="text-sm font-medium text-primary-200">Tổng quan gia sư</p>
              <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-balance">
                Xây hồ sơ gia sư đủ tin cậy để được chọn nhanh hơn.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-white/68">
                Xem nhanh hồ sơ, lịch dạy, lớp đang tuyển và các việc cần phản hồi mà không phải mở từng module rời rạc.
              </p>
            </div>
            <div className="shrink-0 rounded-lg border border-white/12 bg-white/8 p-4">
              <p className="text-xs text-white/55">Trạng thái hồ sơ</p>
              <div className="mt-2">{getStatusBadge(tutorProfile?.verification_status || profile?.verification_status || 'DRAFT')}</div>
            </div>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-4">
            {metrics.map((metric) => (
              <div key={metric.label} className="rounded-lg bg-white p-4 text-text-primary">
                <metric.icon className="h-5 w-5 text-primary-800" />
                <p className="mt-3 text-2xl font-semibold">{metric.value}</p>
                <p className="text-xs text-text-tertiary">{metric.label}</p>
              </div>
            ))}
          </div>
        </div>

        <Card padding="lg">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Xem trước hồ sơ</h2>
              <p className="text-sm text-text-secondary">Cách học viên nhìn thấy hồ sơ của bạn.</p>
            </div>
            <Link to="/tutor/profile">
              <Button variant="ghost" size="sm">
                Sửa hồ sơ <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
          </div>

          <div className="mt-6 rounded-lg border border-border-light bg-[#fbfaf6] p-5">
            <div className="flex items-start gap-4">
              <Avatar name={user?.full_name || 'Gia sư Lumin'} src={user?.avatar_url || undefined} size="xl" shape="square" />
              <div>
                <h3 className="text-lg font-semibold">{profile?.qualification_level || 'Gia sư Lumin'}</h3>
                <p className="text-sm text-text-secondary">
                  {profile?.years_experience || 0} năm kinh nghiệm · {teachingModeLabel(profile?.teaching_mode)}
                </p>
                <p className="mt-1 text-sm text-text-tertiary">
                  {profile?.teaching_area || 'Chưa khai báo khu vực'}
                </p>
              </div>
            </div>
            <p className="mt-5 line-clamp-3 text-sm leading-6 text-text-secondary">
              {profile?.bio || 'Thêm phần giới thiệu ngắn về phong cách giảng dạy, kết quả từng hỗ trợ và thế mạnh môn học để hồ sơ chuyên nghiệp hơn.'}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {subjects.slice(0, 4).map((subject) => (
                <span key={subject.id} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-text-secondary">
                  {subject.subject_name || `Môn #${subject.subject_id}`} · {formatMoney(subject.fee_per_session)}
                </span>
              ))}
              {subjects.length === 0 && (
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-text-tertiary">Chưa thêm môn dạy</span>
              )}
            </div>
          </div>
        </Card>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <Card padding="lg">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Yêu cầu 1-1 mới</h2>
              <p className="text-sm text-text-secondary">Ưu tiên phản hồi sớm để giữ trải nghiệm học viên.</p>
            </div>
            <Link to="/tutor/opportunities">
              <Button variant="ghost" size="sm">Xử lý</Button>
            </Link>
          </div>

          <div className="space-y-3">
            {pendingRequests.slice(0, 4).map((req) => (
              <article key={req.id} className="rounded-lg border border-border-light p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-semibold">Yêu cầu #{req.id}</h3>
                    <p className="text-sm text-text-secondary">{req.grade_level} · {req.requested_sessions} buổi · {req.mode}</p>
                  </div>
                  {getStatusBadge(req.status)}
                </div>
                {req.goal && <p className="mt-3 text-sm leading-6 text-text-secondary">{req.goal}</p>}
              </article>
            ))}
            {pendingRequests.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6">
                <UsersIcon className="h-8 w-8 text-primary-800" />
                <h3 className="mt-4 font-semibold">Không có yêu cầu mới</h3>
                <p className="mt-1 text-sm text-text-secondary">Khi học viên gửi yêu cầu 1-1, bạn sẽ thấy tại đây.</p>
              </div>
            )}
          </div>
        </Card>

        <Card padding="lg">
          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Cơ hội lớp nhóm</h2>
              <p className="text-sm text-text-secondary">Các lớp đang tuyển hoặc chuẩn bị mở tuyển gia sư.</p>
            </div>
            <Link to="/tutor/opportunities">
              <Button variant="ghost" size="sm">Ứng tuyển</Button>
            </Link>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {recruitingClasses.map((course) => (
              <article key={course.id} className="rounded-lg border border-border-light bg-[#fbfaf6] p-4">
                <div className="mb-4 h-1.5 w-14 rounded-full bg-warning-500" />
                <h3 className="font-semibold">{course.title}</h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {course.grade_level} · {course.total_sessions} buổi · {formatMoney(course.fee_per_session_per_student)}/học viên
                </p>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-text-tertiary">{course.mode === 'ONLINE' ? 'Trực tuyến' : course.location || 'Trực tiếp'}</span>
                  {getStatusBadge(course.status)}
                </div>
              </article>
            ))}
            {recruitingClasses.length === 0 && (
              <div className="rounded-lg border border-dashed border-border p-6 md:col-span-2">
                <ClipboardCheckIcon className="h-8 w-8 text-primary-800" />
                <h3 className="mt-4 font-semibold">Chưa có lớp phù hợp</h3>
                <p className="mt-1 text-sm text-text-secondary">Hoàn thiện môn dạy và lịch rảnh để tăng khả năng được gợi ý cho lớp mới.</p>
              </div>
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          { title: 'Bổ sung chứng chỉ', desc: `${qualifications.length} chứng chỉ trong hồ sơ`, icon: ShieldCheckIcon, href: '/tutor/qualifications' },
          { title: 'Cập nhật lịch rảnh', desc: `${availabilities.length} khung giờ đã khai báo`, icon: CalendarIcon, href: '/tutor/schedule' },
          { title: 'Theo dõi lớp và môn dạy', desc: `${subjects.length} môn đang trong hồ sơ dạy`, icon: WalletIcon, href: '/tutor/teaching' },
        ].map((item) => (
          <Link key={item.title} to={item.href}>
            <Card hover padding="lg" className="h-full">
              <item.icon className="h-6 w-6 text-primary-800" />
              <h3 className="mt-5 font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-text-secondary">{item.desc}</p>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
