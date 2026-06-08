import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { classApi, paymentApi, scheduleApi, staffApi } from '../../services/api';
import type { CourseClassResponse, LearningSessionResponse, PaymentResponse, TutorPublicResponse } from '../../types';
import Button from '../../components/ui/Button';
import { getStatusBadge } from '../../components/ui/Badge';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { ArrowRightIcon, CalendarIcon, LayersIcon, UserCheckIcon, WalletIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel } from '../../components/portal/PortalPage';
import { TutorDetailModal } from './TutorVerification';

export default function StaffDashboard() {
  const [pendingTutors, setPendingTutors] = useState<TutorPublicResponse[]>([]);
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [sessions, setSessions] = useState<LearningSessionResponse[]>([]);
  const [selectedTutor, setSelectedTutor] = useState<TutorPublicResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = () => {
    setLoading(true);
    Promise.all([
      staffApi.getPendingTutors().catch(() => []),
      classApi.list().catch(() => []),
      paymentApi.list().catch(() => []),
      scheduleApi.listSessions().catch(() => []),
    ]).then(([tutorList, classList, paymentList, sessionList]) => {
      setPendingTutors(tutorList);
      setClasses(classList);
      setPayments(paymentList);
      setSessions(sessionList);
      setLoading(false);
    });
  };

  useEffect(load, []);

  if (loading) return <DashboardSkeleton />;

  const recruitingClasses = classes.filter((course) => ['DRAFT', 'TUTOR_RECRUITING', 'ENROLLING', 'READY'].includes(course.status));
  const paymentQueue = payments.filter((payment) => ['CREATED', 'PENDING', 'REFUND_PENDING'].includes(payment.status));

  const today = new Date().toISOString().slice(0, 10);
  const sessionsToday = sessions.filter(s => s.session_date === today);
  const scheduledSessions = sessions.filter(s => s.status === 'SCHEDULED');

  return (
    <PortalPage
      title="Tổng quan vận hành"
      description="Hàng chờ công việc hàng ngày."
      actions={(
        <Link to="/staff/tutors">
          <Button>
            Duyệt gia sư <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </Link>
      )}
    >
      {/* Hero metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={UserCheckIcon} label="Gia sư chờ duyệt" value={pendingTutors.length} hint="Cần xác minh." href="/staff/tutors" tone={pendingTutors.length > 0 ? 'warning' : 'success'} />
        <MetricTile icon={LayersIcon} label="Lớp cần điều phối" value={recruitingClasses.length} hint="Từ bản nháp đến sẵn sàng mở lớp." href="/staff/classes" />
        <MetricTile icon={CalendarIcon} label="Buổi học hôm nay" value={sessionsToday.length} hint={`${scheduledSessions.length} buổi sắp tới.`} tone="neutral" />
        <MetricTile icon={WalletIcon} label="Thanh toán chờ" value={paymentQueue.length} hint="Cần kiểm tra." href="/staff/payments" tone="neutral" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Pending tutors — compact list */}
        <SectionPanel
          title="Gia sư chờ duyệt"
          description={`${pendingTutors.length} hồ sơ.`}
          action={<Link to="/staff/tutors"><Button variant="ghost" size="sm">Xem tất cả</Button></Link>}
        >
          {pendingTutors.length === 0 ? (
            <EmptyPanel title="Hàng chờ trống" description="Không có gia sư cần duyệt." />
          ) : (
            <div className="divide-y divide-border-light">
              {pendingTutors.slice(0, 6).map((tutor) => (
                <div key={tutor.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-text-primary text-xs font-bold text-white">
                      {tutor.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text-primary">{tutor.full_name}</p>
                      <p className="text-xs text-text-tertiary">{tutor.years_experience} năm kinh nghiệm · {tutor.subjects.length} môn</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {getStatusBadge(tutor.verification_status)}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedTutor(tutor)}>
                      Xem chi tiết
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>

        {/* Classes needing action — compact list */}
        <SectionPanel
          title="Lớp cần điều phối"
          description={`${recruitingClasses.length} lớp.`}
          action={<Link to="/staff/classes"><Button variant="ghost" size="sm">Quản lý học vụ</Button></Link>}
        >
          {recruitingClasses.length === 0 ? (
            <EmptyPanel title="Không có lớp cần xử lý" />
          ) : (
            <div className="divide-y divide-border-light">
              {recruitingClasses.slice(0, 6).map((course) => (
                <div key={course.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-text-primary">{course.title}</p>
                    <p className="text-xs text-text-tertiary">
                      {course.grade_level} · {course.total_sessions} buổi · {course.min_students}-{course.max_students} HV
                    </p>
                  </div>
                  {getStatusBadge(course.status)}
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>

      {selectedTutor && (
        <TutorDetailModal
          tutor={selectedTutor}
          onClose={() => setSelectedTutor(null)}
          onUpdated={() => { setSelectedTutor(null); load(); }}
          toast={toast}
        />
      )}
    </PortalPage>
  );
}
