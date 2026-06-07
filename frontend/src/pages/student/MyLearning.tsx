import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { classApi, privateRequestApi, paymentApi, scheduleApi } from '../../services/api';
import type { ClassRegistrationResponse, LearningSessionResponse, PaymentResponse, PrivateRequestResponse } from '../../types';
import { PortalPage, SegmentedTabs, EmptyPanel } from '../../components/portal/PortalPage';
import { getStatusBadge } from '../../components/ui/Badge';
import { PageLoading } from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Avatar from '../../components/ui/Avatar';
import { UsersIcon, CalendarIcon, CheckCircleIcon, ClockIcon } from '../../components/ui/Icons';
import QRPaymentModal from '../../components/payment/QRPaymentModal';
import { useToast } from '../../components/ui/Toast';
import { LearningDetailModal } from '../../components/learning/LearningDetailModal';

function toCurrency(value: string | number | null | undefined) {
  if (value == null) return '0đ';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

type Tab = 'PRIVATE' | 'CLASS' | 'HISTORY';
type SessionTypeFilter = 'ALL' | 'CLASS' | 'PRIVATE';
type LearningHistoryFilter = 'ALL' | 'IN_PROGRESS' | 'COMPLETED' | 'NEEDS_ATTENDANCE';

export default function StudentMyLearning() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedTab = searchParams.get('tab');
  const defaultTab: Tab = requestedTab === 'CLASS' || requestedTab === 'HISTORY' ? requestedTab : 'PRIVATE';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [detailTarget, setDetailTarget] = useState<{ type: 'CLASS' | 'PRIVATE', id: number } | null>(null);

  const [requests, setRequests] = useState<PrivateRequestResponse[]>([]);
  const [myClasses, setMyClasses] = useState<ClassRegistrationResponse[]>([]);
  const [sessions, setSessions] = useState<LearningSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrPayment, setQrPayment] = useState<PaymentResponse | null>(null);
  const [payLoading, setPayLoading] = useState<string | null>(null); // "PRIVATE_123" or "CLASS_456"
  const { toast } = useToast();

  const historyCount = useMemo(() => {
    const classIdsWithSessions = new Set(
      sessions.filter((s) => s.class_id !== null).map((s) => s.class_id as number)
    );
    const reqIdsWithSessions = new Set(
      sessions.filter((s) => s.private_request_id !== null).map((s) => s.private_request_id as number)
    );
    return (
      myClasses.filter((c) => classIdsWithSessions.has(c.class_id)).length +
      requests.filter((r) => reqIdsWithSessions.has(r.id)).length
    );
  }, [sessions, myClasses, requests]);

  const loadData = useCallback(() => {
    Promise.all([
      privateRequestApi.list().catch(() => []),
      classApi.myRegistrations().catch(() => []),
      scheduleApi.listSessions().catch(() => []),
    ]).then(([reqs, regs, sess]) => {
      setRequests(reqs);
      setMyClasses(regs);
      setSessions(sess);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePayNow = async (targetType: 'PRIVATE_TUTORING_REQUEST' | 'CLASS_REGISTRATION', targetId: number) => {
    const loadingKey = `${targetType}_${targetId}`;
    setPayLoading(loadingKey);
    try {
      const payments = await paymentApi.list();
      const pending = payments.find(
        (p: PaymentResponse) =>
          p.target_type === targetType &&
          p.target_id === targetId &&
          (p.status === 'CREATED' || p.status === 'PENDING')
      );
      if (!pending) {
        toast('warning', 'Không tìm thấy giao dịch chờ thanh toán. Vui lòng liên hệ hỗ trợ.');
        return;
      }
      if (pending.provider?.toUpperCase() === 'SEPAY') {
        setQrPayment(pending);
      } else {
        // Mock payment — navigate to payments page
        navigate('/student/payments');
      }
    } catch {
      toast('error', 'Không thể tải thông tin thanh toán.');
    } finally {
      setPayLoading(null);
    }
  };

  const handleQrPaid = useCallback(() => {
    navigate('/student/payments');
  }, [navigate]);

  if (loading) return <PageLoading />;

  return (
    <PortalPage
      title="Lớp của tôi"
      description="Theo dõi và quản lý toàn bộ các khóa học và yêu cầu gia sư 1-1 của bạn tại đây."
    >
      <SegmentedTabs
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'PRIVATE', label: 'Yêu cầu 1-1', count: requests.length },
          { value: 'CLASS', label: 'Lớp nhóm', count: myClasses.length },
          { value: 'HISTORY', label: 'Lịch sử học', count: historyCount },
        ]}
      />

      <div className="mt-8">
        {activeTab === 'PRIVATE' && (
          <div className="space-y-6">
            {requests.length === 0 ? (
              <EmptyPanel
                title="Chưa có yêu cầu 1-1 nào"
                description="Bạn có thể tìm kiếm và gửi yêu cầu học kèm 1-1 cho các gia sư phù hợp với nhu cầu."
                action={<Button onClick={() => navigate('/student')}>Khám phá Gia sư</Button>}
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {requests.map((req) => (
                  <PrivateRequestCard
                    key={req.id}
                    request={req}
                    onAction={(path) => navigate(path)}
                    onPayNow={() => handlePayNow('PRIVATE_TUTORING_REQUEST', req.id)}
                    onDetails={() => setDetailTarget({ type: 'PRIVATE', id: req.id })}
                    payLoading={payLoading === `PRIVATE_TUTORING_REQUEST_${req.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'CLASS' && (
          <div className="space-y-6">
            {myClasses.length === 0 ? (
              <EmptyPanel
                title="Chưa tham gia lớp nhóm"
                description="Bạn chưa đăng ký lớp học nhóm nào. Khám phá hàng ngàn lớp học với mức phí siêu ưu đãi."
                action={<Button onClick={() => navigate('/student')}>Tìm lớp nhóm</Button>}
              />
            ) : (
              <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
                {myClasses.map((reg) => (
                  <ClassRegistrationCard
                    key={reg.id}
                    reg={reg}
                    onAction={(path) => navigate(path)}
                    onPayNow={() => handlePayNow('CLASS_REGISTRATION', reg.id)}
                    onDetails={() => setDetailTarget({ type: 'CLASS', id: reg.class_id })}
                    payLoading={payLoading === `CLASS_REGISTRATION_${reg.id}`}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'HISTORY' && (
          <SessionHistoryTab
            sessions={sessions}
            myClasses={myClasses}
            requests={requests}
          />
        )}
      </div>


      <LearningDetailModal 
        target={detailTarget} 
        onClose={() => setDetailTarget(null)} 
      />

      <QRPaymentModal

        open={qrPayment !== null}
        payment={qrPayment}
        onClose={() => setQrPayment(null)}
        onPaid={handleQrPaid}
      />
    </PortalPage>
  );
}

const sessionTypeFilters: { value: SessionTypeFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'CLASS', label: 'Lớp nhóm' },
  { value: 'PRIVATE', label: 'Học 1-1' },
];

const learningHistoryFilters: { value: LearningHistoryFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'IN_PROGRESS', label: 'Đang học' },
  { value: 'COMPLETED', label: 'Hoàn thành' },
  { value: 'NEEDS_ATTENDANCE', label: 'Chờ cập nhật điểm danh' },
];

function getSessionDate(sessionDate: string) {
  return new Date(`${sessionDate}T00:00:00`);
}

function getSessionDateTime(session: LearningSessionResponse) {
  return new Date(`${session.session_date}T${session.start_time}`);
}

function isPastSessionDate(sessionDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return getSessionDate(sessionDate) < today;
}

function isUpcomingScheduledSession(session: LearningSessionResponse) {
  return session.status === 'SCHEDULED' && !isPastSessionDate(session.session_date);
}

function isAttendanceNeededSession(session: LearningSessionResponse) {
  return session.status === 'SCHEDULED' && isPastSessionDate(session.session_date);
}

interface LearningHistoryItem {
  key: string;
  id: number;
  type: 'CLASS' | 'PRIVATE';
  title: string;
  tutorName: string | null;
  expectedSessions: number | null;
  sourceStatus: string;
  sessions: LearningSessionResponse[];
}

function SessionHistoryTab({
  sessions,
  myClasses,
  requests,
}: {
  sessions: LearningSessionResponse[];
  myClasses: ClassRegistrationResponse[];
  requests: PrivateRequestResponse[];
}) {
  const [typeFilter, setTypeFilter] = useState<SessionTypeFilter>('ALL');
  const [historyFilter, setHistoryFilter] = useState<LearningHistoryFilter>('ALL');
  const [selectedItem, setSelectedItem] = useState<LearningHistoryItem | null>(null);

  const historyItems = useMemo(() => {
    const sessionsByClass = new Map<number, LearningSessionResponse[]>();
    const sessionsByRequest = new Map<number, LearningSessionResponse[]>();

    sessions.forEach((session) => {
      if (session.class_id !== null) {
        const existing = sessionsByClass.get(session.class_id) ?? [];
        existing.push(session);
        sessionsByClass.set(session.class_id, existing);
      }
      if (session.private_request_id !== null) {
        const existing = sessionsByRequest.get(session.private_request_id) ?? [];
        existing.push(session);
        sessionsByRequest.set(session.private_request_id, existing);
      }
    });

    const classItems: LearningHistoryItem[] = myClasses.map((reg) => ({
      key: `CLASS_${reg.class_id}`,
      id: reg.class_id,
      type: 'CLASS',
      title: reg.class_title || `Lớp #${reg.class_id}`,
      tutorName: reg.tutor_name ?? null,
      expectedSessions: reg.total_sessions ?? null,
      sourceStatus: reg.status,
      sessions: sessionsByClass.get(reg.class_id) ?? [],
    }));

    const requestItems: LearningHistoryItem[] = requests.map((request) => ({
      key: `PRIVATE_${request.id}`,
      id: request.id,
      type: 'PRIVATE',
      title: request.subject_name ? `${request.subject_name} - ${request.grade_level}` : `Yêu cầu 1-1 #${request.id}`,
      tutorName: request.tutor_name,
      expectedSessions: request.requested_sessions,
      sourceStatus: request.status,
      sessions: sessionsByRequest.get(request.id) ?? [],
    }));

    return [...classItems, ...requestItems].sort((a, b) => {
      const aLatest = getLatestSessionTime(a.sessions);
      const bLatest = getLatestSessionTime(b.sessions);
      if (aLatest !== bLatest) return bLatest - aLatest;
      return a.title.localeCompare(b.title, 'vi');
    });
  }, [myClasses, requests, sessions]);

  const stats = useMemo(() => {
    const itemsWithHistory = historyItems.filter((item) => item.sessions.length > 0);
    let itemsWithSessions = 0;
    let needsAttendance = 0;

    itemsWithHistory.forEach((item) => {
      if (item.sessions.length > 0) itemsWithSessions += 1;
      item.sessions.forEach((session) => {
        if (isAttendanceNeededSession(session)) needsAttendance += 1;
      });
    });

    return {
      totalItems: itemsWithHistory.length,
      itemsWithSessions,
      needsAttendance,
    };
  }, [historyItems]);

  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      if (item.sessions.length === 0) return false;

      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (historyFilter === 'IN_PROGRESS') return item.sessions.some(isUpcomingScheduledSession);
      if (historyFilter === 'NEEDS_ATTENDANCE') return item.sessions.some(isAttendanceNeededSession);
      if (historyFilter === 'COMPLETED') {
        const completedCount = item.sessions.filter((session) => session.status === 'COMPLETED').length;
        if (item.expectedSessions != null) {
          // Có tổng buổi rõ ràng: so sánh trực tiếp
          return item.expectedSessions > 0 && completedCount >= item.expectedSessions;
        }
        // Không có tổng buổi: dựa vào sourceStatus của entity cha
        return ['COMPLETED', 'PAID'].includes(item.sourceStatus) && completedCount > 0;
      }
      return true;
    });
  }, [historyFilter, historyItems, typeFilter]);

  if (historyItems.length === 0) {
    return (
      <EmptyPanel
        title="Chưa có lớp học nào"
        description="Các lớp nhóm và yêu cầu học 1-1 của bạn sẽ xuất hiện ở đây sau khi đăng ký hoặc gửi yêu cầu."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <HistoryMetricCard label="Lớp / yêu cầu" value={stats.totalItems} icon={CalendarIcon} />
        <HistoryMetricCard label="Đã có lịch học" value={stats.itemsWithSessions} icon={CheckCircleIcon} tone="success" />
        <HistoryMetricCard label="Chờ cập nhật điểm danh" value={stats.needsAttendance} icon={ClockIcon} tone="warning" />
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-border-light bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <FilterButtonGroup
          label="Loại"
          options={sessionTypeFilters}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <FilterButtonGroup
          label="Tiến độ"
          options={learningHistoryFilters}
          value={historyFilter}
          onChange={setHistoryFilter}
        />
        <span className="text-sm font-semibold text-text-tertiary lg:ml-auto">
          {filteredItems.length} lớp/yêu cầu
        </span>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyPanel title="Không có lớp học phù hợp" />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filteredItems.map((item) => (
            <LearningHistoryCard
              key={item.key}
              item={item}
              onOpen={() => setSelectedItem(item)}
            />
          ))}
        </div>
      )}

      <LearningHistorySessionsModal
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}

function HistoryMetricCard({
  label,
  value,
  icon: Icon,
  tone = 'default',
}: {
  label: string;
  value: number;
  icon: typeof CalendarIcon;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass = tone === 'success'
    ? 'border-success-100 bg-success-50 text-success-700'
    : tone === 'warning'
      ? 'border-warning-100 bg-warning-50 text-warning-700'
      : 'border-border-light bg-white text-text-primary';

  return (
    <div className={`rounded-2xl border p-5 shadow-sm ${toneClass}`}>
      <Icon className="mb-3 h-5 w-5" />
      <p className="text-3xl font-extrabold leading-none">{value}</p>
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary">{label}</p>
    </div>
  );
}

function FilterButtonGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-xl border border-border-light bg-surface-secondary p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
              value === option.value
                ? 'bg-white text-primary-700 shadow-sm'
                : 'text-text-secondary hover:bg-white/70 hover:text-text-primary'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getLatestSessionTime(sessions: LearningSessionResponse[]) {
  return sessions.reduce((latest, session) => Math.max(latest, getSessionDateTime(session).getTime()), 0);
}

function getSortedSessions(sessions: LearningSessionResponse[]) {
  return sessions.slice().sort((a, b) => getSessionDateTime(b).getTime() - getSessionDateTime(a).getTime());
}

function getHistoryItemMetrics(item: LearningHistoryItem) {
  let completed = 0;
  let cancelledOrAbsent = 0;
  let needsAttendance = 0;
  let upcoming = 0;

  item.sessions.forEach((session) => {
    if (session.status === 'COMPLETED') completed += 1;
    if (session.status === 'CANCELLED' || session.status === 'NO_SHOW') cancelledOrAbsent += 1;
    if (isAttendanceNeededSession(session)) needsAttendance += 1;
    if (isUpcomingScheduledSession(session)) upcoming += 1;
  });

  return {
    completed,
    cancelledOrAbsent,
    needsAttendance,
    upcoming,
    scheduled: item.sessions.length,
    expected: item.expectedSessions,
  };
}

function LearningHistoryCard({ item, onOpen }: { item: LearningHistoryItem; onOpen: () => void }) {
  const metrics = getHistoryItemMetrics(item);
  const sortedSessions = getSortedSessions(item.sessions);
  const latestSession = sortedSessions[0] ?? null;
  const nextSession = sortedSessions.slice().reverse().find(isUpcomingScheduledSession);
  const typeLabel = item.type === 'CLASS' ? 'Lớp nhóm' : 'Học 1-1';
  const progressLabel = metrics.expected
    ? `${metrics.completed}/${metrics.expected} buổi đã học`
    : `${metrics.completed} buổi đã học`;

  return (
    <article className="flex flex-col rounded-2xl border border-border-light bg-white p-5 shadow-sm transition-all hover:border-primary-200 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary-600">{typeLabel}</p>
          <h4 className="line-clamp-2 text-lg font-bold text-text-primary">{item.title}</h4>
        </div>
        <div className="shrink-0">{getStatusBadge(item.sourceStatus)}</div>
      </div>

      <div className="mt-4 flex items-center gap-2 text-sm text-text-secondary">
        <Avatar name={item.tutorName || 'Gia sư'} size="sm" />
        <span className="font-semibold">{item.tutorName || 'Chưa có gia sư'}</span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <HistoryMiniStat label="Đã học" value={metrics.completed} tone="success" />
        <HistoryMiniStat label="Đã lên lịch" value={metrics.scheduled} />
        <HistoryMiniStat label="Chờ cập nhật" value={metrics.needsAttendance} tone="warning" />
      </div>

      <div className="mt-5 rounded-xl border border-border-light bg-surface-secondary/70 p-4">
        <p className="text-sm font-bold text-text-primary">{progressLabel}</p>
        <p className="mt-1 text-sm text-text-tertiary">
          {nextSession
            ? `Buổi tiếp theo: ${formatSessionDateTime(nextSession)}`
            : latestSession
              ? `Buổi gần nhất: ${formatSessionDateTime(latestSession)}`
              : 'Chưa có lịch học cho lớp/yêu cầu này.'}
        </p>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="text-sm text-text-tertiary">
          {metrics.cancelledOrAbsent > 0 ? `${metrics.cancelledOrAbsent} buổi hủy/vắng` : `${item.sessions.length} buổi trong lịch`}
        </span>
        <Button size="sm" variant="outline" onClick={onOpen}>
          Xem buổi học
        </Button>
      </div>
    </article>
  );
}

function HistoryMiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: number;
  tone?: 'default' | 'success' | 'warning';
}) {
  const toneClass = tone === 'success'
    ? 'bg-success-50 text-success-700'
    : tone === 'warning'
      ? 'bg-warning-50 text-warning-700'
      : 'bg-surface-secondary text-text-primary';

  return (
    <div className={`rounded-xl px-3 py-2 ${toneClass}`}>
      <p className="text-lg font-extrabold leading-none">{value}</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-text-tertiary">{label}</p>
    </div>
  );
}

function LearningHistorySessionsModal({ item, onClose }: { item: LearningHistoryItem | null; onClose: () => void }) {
  if (!item) return null;

  const sortedSessions = getSortedSessions(item.sessions);

  return (
    <Modal
      open
      onClose={onClose}
      title="Các buổi học"
      size="lg"
      footer={<Button variant="ghost" onClick={onClose}>Đóng</Button>}
    >
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary-600">
              {item.type === 'CLASS' ? 'Lớp nhóm' : 'Học 1-1'}
            </p>
            <h3 className="text-xl font-bold text-text-primary">{item.title}</h3>
            <p className="mt-1 text-sm text-text-tertiary">{item.tutorName || 'Chưa có gia sư'}</p>
          </div>
          {getStatusBadge(item.sourceStatus)}
        </div>

        {sortedSessions.length === 0 ? (
          <EmptyPanel
            title="Chưa có buổi học nào"
            description="Khi gia sư hoặc staff tạo lịch, các buổi học của lớp/yêu cầu này sẽ xuất hiện ở đây."
          />
        ) : (
          <div className="space-y-3">
            {sortedSessions.map((session) => (
              <CompactSessionRow key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function CompactSessionRow({ session }: { session: LearningSessionResponse }) {
  return (
    <div className="rounded-xl border border-border-light bg-white p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-text-primary">{formatSessionDateTime(session)}</p>
          <p className="mt-1 text-sm text-text-tertiary">
            {session.session_number ? `Buổi ${session.session_number}` : 'Buổi học'} · {session.tutor_name || `GS #${session.tutor_id}`}
          </p>
        </div>
        <SessionHistoryStatusBadge session={session} />
      </div>
      {session.attendance_note && (
        <p className="mt-3 rounded-lg bg-warning-50 px-3 py-2 text-sm text-warning-800">
          {session.attendance_note}
        </p>
      )}
    </div>
  );
}

function formatSessionDateTime(session: LearningSessionResponse) {
  const dateObj = getSessionDate(session.session_date);
  return `${dateObj.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' })} · ${session.start_time.slice(0, 5)} - ${session.end_time.slice(0, 5)}`;
}

function SessionHistoryStatusBadge({ session }: { session: LearningSessionResponse }) {
  if (isAttendanceNeededSession(session)) {
    return (
      <span className="inline-flex items-center rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700">
        ⚠️ Chưa điểm danh
      </span>
    );
  }

  return getStatusBadge(session.status);
}

function PrivateRequestCard({
  request,
  onAction,
  onPayNow,
  payLoading,
  onDetails,
}: {
  request: PrivateRequestResponse;
  onAction: (path: string) => void;
  onPayNow: () => void;
  payLoading: boolean;
  onDetails: () => void;
}) {
  const isPaid = request.status === 'PAID';
  const isConfirmed = request.status === 'TUTOR_CONFIRMED';
  const isRejected = request.status === 'TUTOR_REJECTED';

  // Progress Steps logic
  const steps = [
    { label: 'Gửi yêu cầu', active: true, done: true },
    { label: 'GS Phản hồi', active: isConfirmed || isPaid || isRejected, done: isConfirmed || isPaid },
    { label: 'Học phí', active: isPaid, done: isPaid }
  ];

  return (
    <article className="relative flex flex-col overflow-hidden rounded-2xl border border-border-light bg-white shadow-sm transition-all hover:shadow-md">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary-50 rounded-bl-full opacity-50 pointer-events-none"></div>

      <div className="p-6 relative z-10 flex flex-col h-full">
        <div className="flex justify-between items-start mb-5">
          <div className="flex gap-4 items-center">
            <Avatar name={request.tutor_name || `Gia sư #${request.tutor_id}`} size="lg" className="border-2 border-white shadow-sm" />
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary-600 mb-0.5">Gia sư 1-1</p>
              <h3 className="font-bold text-lg text-text-primary leading-tight">{request.tutor_name || `Gia sư #${request.tutor_id}`}</h3>
            </div>
          </div>
          <div className="shrink-0">{getStatusBadge(request.status)}</div>
        </div>

        <div className="bg-surface-secondary/70 rounded-xl p-5 border border-border-light backdrop-blur-sm mb-6 flex-1">
          <h4 className="font-bold text-lg text-text-primary mb-3">
            {request.subject_name ? `${request.subject_name} - ${request.grade_level}` : `Yêu cầu #${request.id}`}
          </h4>
          
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <CalendarIcon className="w-4 h-4 text-text-tertiary" />
              {request.requested_sessions} buổi học ({request.mode === 'ONLINE' ? 'Trực tuyến' : request.mode === 'OFFLINE' ? 'Trực tiếp' : 'Cả hai'})
            </p>
            {request.agreed_fee_per_session && (
              <div className="pt-2 mt-2 border-t border-border-light/50 flex items-center justify-between">
                <p className="text-sm font-bold text-text-primary flex items-center gap-2">
                  <span className="w-4 text-center text-primary-500">💰</span>
                  {toCurrency(request.agreed_fee_per_session)} <span className="font-normal text-xs text-text-tertiary">/ buổi</span>
                </p>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-text-tertiary font-bold mb-0.5">Tổng cộng</p>
                  <p className="text-sm font-extrabold text-primary-700">
                    {toCurrency(Number(request.agreed_fee_per_session) * (request.requested_sessions || 0))}
                  </p>
                </div>
              </div>
            )}
            {request.tutor_response_note && (
              <div className="mt-3 bg-white/60 p-3 rounded-lg border border-border-light border-dashed">
                <p className="text-xs font-bold text-text-secondary mb-1">Gia sư nhắn:</p>
                <p className="text-sm italic text-text-primary">"{request.tutor_response_note}"</p>
              </div>
            )}
          </div>
        </div>

        {/* Action area */}
        <div className="mt-auto space-y-5">
          {/* Progress Indicator */}
          {!isRejected && (
            <div className="flex items-center justify-between relative px-2">
              <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-surface-tertiary -translate-y-1/2 z-0"></div>
              {steps.map((step, idx) => (
                <div key={idx} className="relative z-10 flex flex-col items-center gap-1.5 bg-white px-2">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center border-2 ${
                    step.done ? 'bg-primary-50 border-primary-500 text-primary-600' :
                    step.active ? 'bg-white border-primary-400 text-primary-500' :
                    'bg-white border-border-light text-border-light'
                  }`}>
                    {step.done ? <CheckCircleIcon className="w-3.5 h-3.5" /> : <span className="w-1.5 h-1.5 rounded-full bg-current"></span>}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider ${step.active ? 'text-text-primary' : 'text-text-tertiary'}`}>
                    {step.label}
                  </span>
                </div>
              ))}
            </div>
          )}

          
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 justify-center border-border-light shadow-sm" onClick={onDetails}>Xem chi tiết</Button>
            {isConfirmed ? (
              <Button className="flex-1 justify-center shadow-sm" onClick={onPayNow} disabled={payLoading}>
                {payLoading ? 'Đang tải...' : 'Thanh toán'}
              </Button>
            ) : isPaid ? (
              <Button className="flex-1 justify-center border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100" onClick={() => onAction('/student/schedule')}>
                Vào lịch học
              </Button>
            ) : (
              <Button variant="outline" className="flex-1 justify-center bg-surface-secondary text-text-tertiary border-border-light cursor-not-allowed" disabled>
                {isRejected ? 'Bị từ chối' : 'Chờ duyệt'}
              </Button>
            )}
          </div>

        </div>
      </div>
    </article>
  );
}

function ClassRegistrationCard({
  reg,
  onAction,
  onPayNow,
  payLoading,
  onDetails,
}: {
  reg: ClassRegistrationResponse;
  onAction: (path: string) => void;
  onPayNow: () => void;
  payLoading: boolean;
  onDetails: () => void;
}) {
  const isPaid = reg.status === 'PAID';
  const isApproved = reg.status === 'APPROVED';
  const isPending = reg.status === 'PENDING';
  const isRejected = reg.status === 'REJECTED';

  return (
    <article className="group relative flex flex-col rounded-2xl border border-border-light bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-primary-200 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
      
      <div className="p-6 relative z-10 flex flex-col h-full">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600 mb-1">Lớp nhóm</p>
            <h4 className="text-lg font-bold leading-snug text-text-primary line-clamp-2 group-hover:text-primary-700 transition-colors">{reg.class_title}</h4>
          </div>
          <div className="shrink-0">{getStatusBadge(reg.status)}</div>
        </div>
        
        <div className="space-y-2 mt-auto mb-6 bg-surface-secondary/50 rounded-xl p-4 border border-border-light/50 backdrop-blur-sm flex-1">
          {reg.tutor_name && (
            <p className="text-sm font-medium text-text-secondary flex items-center gap-2">
              <UsersIcon className="w-4 h-4 text-primary-500" />
              GS. <span className="font-bold text-text-primary">{reg.tutor_name}</span>
            </p>
          )}
          <p className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-primary-500" />
            {reg.total_sessions} buổi
          </p>
          {reg.fee_per_session_per_student && (
            <div className="pt-2 mt-2 border-t border-border-light/50 flex items-center justify-between">
               <p className="text-base font-bold text-primary-700">
                 {toCurrency(reg.fee_per_session_per_student)} <span className="text-xs text-text-tertiary font-normal">/ buổi</span>
               </p>
               <div className="text-right">
                 <p className="text-[10px] uppercase text-text-tertiary font-bold mb-0.5">Tổng cộng</p>
                 <p className="text-base font-extrabold text-primary-700">
                   {toCurrency(Number(reg.fee_per_session_per_student) * (reg.total_sessions || 0))}
                 </p>
               </div>
            </div>
          )}
          {reg.review_note && (
            <div className="mt-3 bg-white/60 p-3 rounded-lg border border-border-light border-dashed">
              <p className="text-xs font-bold text-text-secondary mb-1">Nhận xét từ Staff:</p>
              <p className="text-sm italic text-text-primary">"{reg.review_note}"</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-4">
          <Button variant="outline" className="flex-1 justify-center border-border-light shadow-sm" onClick={onDetails}>Xem chi tiết</Button>
          {isApproved ? (
            <Button className="flex-1 justify-center shadow-sm" onClick={onPayNow} disabled={payLoading}>
              {payLoading ? 'Đang tải...' : 'Thanh toán'}
            </Button>
          ) : isPaid ? (
            <Button className="flex-1 justify-center border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100" onClick={() => onAction('/student/schedule')}>
              Vào lịch học
            </Button>
          ) : (
            <Button variant="outline" className="flex-1 justify-center bg-surface-secondary text-text-tertiary border-border-light cursor-not-allowed" disabled>
              {isPending ? 'Đang chờ duyệt' : isRejected ? 'Bị từ chối' : 'Trạng thái khác'}
            </Button>
          )}
        </div>
      </div>
    </article>
  );
}


