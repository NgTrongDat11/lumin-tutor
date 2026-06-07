import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { classApi, privateRequestApi, paymentApi, scheduleApi } from '../../services/api';
import type { ClassRegistrationResponse, LearningSessionResponse, PaymentResponse, PrivateRequestResponse } from '../../types';
import { PortalPage, SegmentedTabs, EmptyPanel } from '../../components/portal/PortalPage';
import { getStatusBadge } from '../../components/ui/Badge';
import { PageLoading } from '../../components/ui/Spinner';
import Button from '../../components/ui/Button';

import Avatar from '../../components/ui/Avatar';
import { UsersIcon, CalendarIcon, CheckCircleIcon } from '../../components/ui/Icons';
import QRPaymentModal from '../../components/payment/QRPaymentModal';
import { useToast } from '../../components/ui/Toast';

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
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

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

  const filteredItems = useMemo(() => {
    return historyItems.filter((item) => {
      if (item.sessions.length === 0) return false;
      if (typeFilter !== 'ALL' && item.type !== typeFilter) return false;
      if (historyFilter === 'IN_PROGRESS') return item.sessions.some(isUpcomingScheduledSession);
      if (historyFilter === 'NEEDS_ATTENDANCE') return item.sessions.some(isAttendanceNeededSession);
      if (historyFilter === 'COMPLETED') {
        const completedCount = item.sessions.filter((s) => s.status === 'COMPLETED').length;
        if (item.expectedSessions != null) {
          return item.expectedSessions > 0 && completedCount >= item.expectedSessions;
        }
        return ['COMPLETED', 'PAID'].includes(item.sourceStatus) && completedCount > 0;
      }
      return true;
    });
  }, [historyFilter, historyItems, typeFilter]);

  if (historyItems.filter((i) => i.sessions.length > 0).length === 0) {
    return (
      <EmptyPanel
        title="Chưa có lịch sử học"
        description="Các lớp nhóm và yêu cầu học 1-1 có buổi học sẽ xuất hiện ở đây."
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar — compact single row */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-border-light bg-white px-4 py-3 shadow-sm">
        <FilterButtonGroup
          label="Loại"
          options={sessionTypeFilters}
          value={typeFilter}
          onChange={setTypeFilter}
        />
        <div className="h-4 w-px bg-border-light hidden sm:block" />
        <FilterButtonGroup
          label="Tiến độ"
          options={learningHistoryFilters}
          value={historyFilter}
          onChange={setHistoryFilter}
        />
        <span className="ml-auto text-xs font-semibold text-text-tertiary">
          {filteredItems.length} kết quả
        </span>
      </div>

      {filteredItems.length === 0 ? (
        <EmptyPanel title="Không có kết quả phù hợp" />
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item) => (
            <LearningHistoryAccordion
              key={item.key}
              item={item}
              expanded={expandedKey === item.key}
              onToggle={() => setExpandedKey(expandedKey === item.key ? null : item.key)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButtonGroup<T extends string,>({
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
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary">{label}:</span>
      <div className="flex flex-wrap gap-1 rounded-xl border border-border-light bg-surface-secondary p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-3 py-1 text-xs font-bold transition-colors ${
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
  return sessions.slice().sort((a, b) => getSessionDateTime(a).getTime() - getSessionDateTime(b).getTime());
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

  return { completed, cancelledOrAbsent, needsAttendance, upcoming, scheduled: item.sessions.length, expected: item.expectedSessions };
}

// ── Accordion row: summary + inline expand ────────────────
function LearningHistoryAccordion({
  item,
  expanded,
  onToggle,
}: {
  item: LearningHistoryItem;
  expanded: boolean;
  onToggle: () => void;
}) {
  const metrics = getHistoryItemMetrics(item);
  const sortedSessions = getSortedSessions(item.sessions);
  const nextSession = sortedSessions.find(isUpcomingScheduledSession);
  const lastCompleted = [...sortedSessions].reverse().find((s) => s.status === 'COMPLETED');
  const typeLabel = item.type === 'CLASS' ? 'Lớp nhóm' : 'Học 1-1';
  const progressPct = item.expectedSessions
    ? Math.min(100, Math.round((metrics.completed / item.expectedSessions) * 100))
    : null;

  const isCompleted = item.expectedSessions != null
    ? (item.expectedSessions > 0 && metrics.completed >= item.expectedSessions)
    : (['COMPLETED', 'PAID'].includes(item.sourceStatus) && metrics.completed > 0);

  return (
    <div className={`overflow-hidden rounded-2xl border transition-all ${
      isCompleted
        ? `bg-slate-50/60 border-slate-200/80 ${expanded ? 'border-slate-300' : 'hover:border-slate-300'}`
        : `bg-white border-border-light ${expanded ? 'border-primary-200' : 'hover:border-primary-100'}`
    }`}>
      {/* ── Header row (always visible) ── */}
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-4 px-5 py-4">
          {/* Left: icon + type pill */}
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isCompleted ? 'bg-blue-100/70' : 'bg-primary-50'
          }`}>
            {isCompleted ? (
              <CheckCircleIcon className="h-5 w-5 text-blue-600" />
            ) : item.type === 'CLASS' ? (
              <UsersIcon className="h-5 w-5 text-primary-600" />
            ) : (
              <CalendarIcon className="h-5 w-5 text-primary-600" />
            )}
          </div>

          {/* Center: title + meta */}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                isCompleted ? 'bg-slate-200/70 text-slate-600' : 'bg-primary-50 text-primary-600'
              }`}>
                {typeLabel}
              </span>
              {isCompleted ? (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800">
                  ✓ Hoàn thành
                </span>
              ) : (
                getStatusBadge(item.sourceStatus)
              )}
            </div>
            <p className={`mt-1 truncate text-base font-bold ${isCompleted ? 'text-text-secondary' : 'text-text-primary'}`}>{item.title}</p>
            <p className="mt-0.5 text-sm text-text-secondary">
              {item.tutorName || 'Chưa có gia sư'}
              {item.expectedSessions ? ` · ${metrics.completed}/${item.expectedSessions} buổi` : ` · ${metrics.completed} buổi đã học`}
              {nextSession && (
                <span className="ml-2 text-primary-600 font-semibold">
                  · Tiếp: {formatShortDate(nextSession.session_date)} {nextSession.start_time.slice(0, 5)}
                </span>
              )}
            </p>
          </div>

          {/* Right: progress + chevron */}
          <div className="flex shrink-0 flex-col items-end gap-1">
            {progressPct !== null && (
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-surface-secondary">
                  <div
                    className={`h-full rounded-full transition-all ${
                      isCompleted ? 'bg-blue-500' : 'bg-primary-500'
                    }`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>
                <span className={`text-xs font-bold ${isCompleted ? 'text-blue-600' : 'text-text-tertiary'}`}>{progressPct}%</span>
              </div>
            )}
            {metrics.needsAttendance > 0 && (
              <span className="rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-bold text-warning-700">
                ⏳ {metrics.needsAttendance} chờ GS cập nhật
              </span>
            )}
            <span className={`text-xs text-text-tertiary transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </div>
        </div>
      </button>

      {/* ── Expandable session timeline ── */}
      {expanded && (
        <div className="border-t border-border-light bg-surface-secondary/40 px-5 py-4">
          {/* Quick stats strip */}
          <div className="mb-4 flex flex-wrap gap-3">
            <StatPill label="Đã học" value={metrics.completed} tone="success" />
            <StatPill label="Sắp tới" value={metrics.upcoming} tone="default" />
            {metrics.cancelledOrAbsent > 0 && (
              <StatPill label="Hủy/Vắng" value={metrics.cancelledOrAbsent} tone="muted" />
            )}
            {lastCompleted && (
              <span className="ml-auto text-xs text-text-tertiary">
                Buổi gần nhất: {formatShortDate(lastCompleted.session_date)}
              </span>
            )}
          </div>

          {/* Session timeline */}
          {sortedSessions.length === 0 ? (
            <p className="text-sm text-text-tertiary">Chưa có buổi học nào được tạo.</p>
          ) : (
            <ol className="space-y-2">
              {sortedSessions.map((session, idx) => (
                <SessionTimelineRow key={session.id} session={session} index={idx + 1} />
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: 'success' | 'default' | 'muted' }) {
  const cls = tone === 'success'
    ? 'bg-success-50 text-success-700'
    : tone === 'muted'
      ? 'bg-surface-secondary text-text-tertiary'
      : 'bg-white border border-border-light text-text-primary';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${cls}`}>
      <span className="text-sm font-extrabold">{value}</span>
      {label}
    </span>
  );
}

function SessionTimelineRow({ session, index }: { session: LearningSessionResponse; index: number }) {
  const needsUpdate = isAttendanceNeededSession(session);

  const dotColor = session.status === 'COMPLETED'
    ? 'bg-success-500'
    : session.status === 'CANCELLED' || session.status === 'NO_SHOW'
      ? 'bg-text-tertiary'
      : needsUpdate
        ? 'bg-warning-400'
        : 'bg-primary-400';

  return (
    <li className="flex items-start gap-3">
      {/* Timeline dot */}
      <div className="mt-1.5 flex flex-col items-center">
        <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-xl border border-border-light bg-white px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            Buổi {session.session_number ?? index} &nbsp;·&nbsp; {formatShortDate(session.session_date)}
            &nbsp;<span className="font-normal text-text-secondary">{session.start_time.slice(0, 5)}–{session.end_time.slice(0, 5)}</span>
          </p>
          {needsUpdate && (
            <p className="mt-0.5 text-xs text-warning-600">⏳ Gia sư chưa cập nhật điểm danh</p>
          )}
          {session.attendance_note && (
            <p className="mt-0.5 text-xs text-text-tertiary italic">"{session.attendance_note}"</p>
          )}
        </div>
        <SessionHistoryStatusBadge session={session} />
      </div>
    </li>
  );
}

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'short', day: 'numeric', month: 'numeric',
  });
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
}: {
  request: PrivateRequestResponse;
  onAction: (path: string) => void;
  onPayNow: () => void;
  payLoading: boolean;
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
}: {
  reg: ClassRegistrationResponse;
  onAction: (path: string) => void;
  onPayNow: () => void;
  payLoading: boolean;
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


