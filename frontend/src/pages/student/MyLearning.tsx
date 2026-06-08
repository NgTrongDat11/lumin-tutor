import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { classApi, extractErrorMessage, messageApi, paymentApi, privateRequestApi, scheduleApi } from '../../services/api';
import type { ClassRegistrationResponse, LearningSessionResponse, PaymentResponse, PrivateRequestResponse } from '../../types';
import { EmptyPanel, PortalPage, SegmentedTabs } from '../../components/portal/PortalPage';
import { getStatusBadge } from '../../components/ui/Badge';
import { CardGridSkeleton } from '../../components/ui/Skeleton';
import Button from '../../components/ui/Button';
import Avatar from '../../components/ui/Avatar';
import { BookOpenIcon, CalendarIcon, CheckCircleIcon, ClockIcon, UsersIcon, WalletIcon, XIcon } from '../../components/ui/Icons';
import QRPaymentModal from '../../components/payment/QRPaymentModal';
import { useToast } from '../../components/ui/Toast';

function toCurrency(value: string | number | null | undefined) {
  if (value == null) return '0đ';
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(num);
}

type Tab = 'ACTIVE' | 'COMPLETED';
type SessionTypeFilter = 'ALL' | 'CLASS' | 'PRIVATE';
type LearningItemType = 'CLASS' | 'PRIVATE';
type LearningAction = 'PAY' | 'SCHEDULE' | 'WAITING' | 'REJECTED' | 'NONE';

interface LearningMetrics {
  completed: number;
  cancelledOrAbsent: number;
  needsAttendance: number;
  upcoming: number;
  scheduled: number;
  expected: number | null;
}

interface UnifiedLearningItem {
  key: string;
  type: LearningItemType;
  id: number;
  paymentTargetId: number;
  paymentTargetType: 'PRIVATE_TUTORING_REQUEST' | 'CLASS_REGISTRATION';
  title: string;
  tutorName: string | null;
  expectedSessions: number | null;
  feePerSession: string | null;
  status: string;
  note: string | null;
  modeLabel: string;
  typeLabel: string;
  sessions: LearningSessionResponse[];
}

const sessionTypeFilters: { value: SessionTypeFilter; label: string }[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'CLASS', label: 'Lớp nhóm' },
  { value: 'PRIVATE', label: 'Học 1-1' },
];

export default function StudentMyLearning() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const requestedTab = searchParams.get('tab');
  const defaultTab: Tab = requestedTab === 'COMPLETED' || requestedTab === 'HISTORY' ? 'COMPLETED' : 'ACTIVE';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);
  const [typeFilter, setTypeFilter] = useState<SessionTypeFilter>('ALL');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const [requests, setRequests] = useState<PrivateRequestResponse[]>([]);
  const [myClasses, setMyClasses] = useState<ClassRegistrationResponse[]>([]);
  const [sessions, setSessions] = useState<LearningSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrPayment, setQrPayment] = useState<PaymentResponse | null>(null);
  const [payLoading, setPayLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const loadData = useCallback(() => {
    setLoading(true);
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

  const items = useMemo(() => buildLearningItems(myClasses, requests, sessions), [myClasses, requests, sessions]);
  const activeItems = useMemo(() => items.filter((item) => !isCompletedItem(item)), [items]);
  const completedItems = useMemo(() => items.filter(isCompletedItem), [items]);

  const filteredActiveItems = useMemo(
    () => activeItems.filter((item) => typeFilter === 'ALL' || item.type === typeFilter),
    [activeItems, typeFilter],
  );

  const primaryActiveItems = useMemo(
    () => filteredActiveItems.filter((item) => !isPendingPrivateRequest(item)).sort(compareLearningItems),
    [filteredActiveItems],
  );

  const waitingRequestItems = useMemo(
    () => filteredActiveItems.filter(isPendingPrivateRequest).sort(compareLearningItems),
    [filteredActiveItems],
  );

  const filteredCompletedItems = useMemo(
    () => completedItems.filter((item) => typeFilter === 'ALL' || item.type === typeFilter).sort(compareCompletedItems),
    [completedItems, typeFilter],
  );

  const handlePayNow = async (targetType: 'PRIVATE_TUTORING_REQUEST' | 'CLASS_REGISTRATION', targetId: number) => {
    const loadingKey = `${targetType}_${targetId}`;
    setPayLoading(loadingKey);
    try {
      const payments = await paymentApi.list();
      const pending = payments.find(
        (p: PaymentResponse) =>
          p.target_type === targetType &&
          p.target_id === targetId &&
          (p.status === 'CREATED' || p.status === 'PENDING'),
      );
      if (!pending) {
        toast('warning', 'Không tìm thấy giao dịch chờ thanh toán. Vui lòng liên hệ hỗ trợ.');
        return;
      }
      if (pending.provider?.toUpperCase() === 'SEPAY') {
        setQrPayment(pending);
      } else {
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

  const handleOpenMessages = async (item: UnifiedLearningItem) => {
    try {
      const thread = await messageApi.ensureThread(
        item.type === 'PRIVATE'
          ? { private_request_id: item.id, title: item.title }
          : { class_registration_id: item.paymentTargetId, title: item.title },
      );
      navigate(`/student/messages?threadId=${thread.id}`);
    } catch (err) {
      toast('error', extractErrorMessage(err));
    }
  };

  if (loading) return <CardGridSkeleton />;

  const visibleCount = activeTab === 'ACTIVE'
    ? primaryActiveItems.length + waitingRequestItems.length
    : filteredCompletedItems.length;

  return (
    <PortalPage
      title="Việc học của tôi"
      description="Theo dõi lớp nhóm đang học, tiến trình từng buổi và các yêu cầu học 1-1 trong cùng một nơi."
    >
      <div className="space-y-4 md:space-y-5">
        <SegmentedTabs
          value={activeTab}
          onChange={setActiveTab}
          tabs={[
            { value: 'ACTIVE', label: 'Đang học', count: activeItems.length },
            { value: 'COMPLETED', label: 'Đã hoàn thành', count: completedItems.length },
          ]}
        />

        <div className="flex flex-col gap-3 rounded-lg border border-border-light bg-white px-3 py-3 shadow-xs sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <FilterButtonGroup
            label="Loại"
            options={sessionTypeFilters}
            value={typeFilter}
            onChange={setTypeFilter}
          />
          <span className="text-xs font-semibold text-text-tertiary">{visibleCount} kết quả</span>
        </div>

        {activeTab === 'ACTIVE' ? (
          <ActiveLearningView
            primaryItems={primaryActiveItems}
            waitingItems={waitingRequestItems}
            expandedKey={expandedKey}
            payLoading={payLoading}
            onToggle={(key) => setExpandedKey(expandedKey === key ? null : key)}
            onSchedule={(session) => navigate(session ? `/student/schedule?sessionId=${session.id}` : '/student/schedule')}
            onPayNow={(item) => handlePayNow(item.paymentTargetType, item.paymentTargetId)}
            onMessage={handleOpenMessages}
            onExplore={() => navigate('/student')}
          />
        ) : (
          <CompletedLearningView
            items={filteredCompletedItems}
            expandedKey={expandedKey}
            onToggle={(key) => setExpandedKey(expandedKey === key ? null : key)}
            onMessage={handleOpenMessages}
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

function ActiveLearningView({
  primaryItems,
  waitingItems,
  expandedKey,
  payLoading,
  onToggle,
  onSchedule,
  onPayNow,
  onMessage,
  onExplore,
}: {
  primaryItems: UnifiedLearningItem[];
  waitingItems: UnifiedLearningItem[];
  expandedKey: string | null;
  payLoading: string | null;
  onToggle: (key: string) => void;
  onSchedule: (session?: LearningSessionResponse) => void;
  onPayNow: (item: UnifiedLearningItem) => void;
  onMessage: (item: UnifiedLearningItem) => void;
  onExplore: () => void;
}) {
  if (primaryItems.length === 0 && waitingItems.length === 0) {
    return (
      <EmptyPanel
        title="Chưa có lớp đang học"
        description="Các lớp nhóm, yêu cầu học 1-1 và yêu cầu đang chờ sẽ xuất hiện tại đây."
        action={<Button onClick={onExplore}>Khám phá lớp học</Button>}
      />
    );
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {primaryItems.length > 0 && (
        <div className="grid gap-4">
          {primaryItems.map((item) => (
            <LearningCard
              key={item.key}
              item={item}
              expanded={expandedKey === item.key}
              payLoading={payLoading === `${item.paymentTargetType}_${item.paymentTargetId}`}
              onToggle={() => onToggle(item.key)}
              onSchedule={onSchedule}
              onPayNow={() => onPayNow(item)}
              onMessage={() => onMessage(item)}
            />
          ))}
        </div>
      )}

      {waitingItems.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Yêu cầu đang chờ</h2>
              <p className="mt-0.5 text-xs text-text-tertiary">Các yêu cầu 1-1 đang chờ gia sư phản hồi hoặc cần trao đổi thêm.</p>
            </div>
            <span className="rounded-full bg-surface-tertiary px-2.5 py-1 text-xs font-semibold text-text-secondary">
              {waitingItems.length}
            </span>
          </div>
          <div className="grid gap-4">
            {waitingItems.map((item) => (
              <LearningCard
                key={item.key}
                item={item}
                expanded={expandedKey === item.key}
                payLoading={payLoading === `${item.paymentTargetType}_${item.paymentTargetId}`}
                muted
                onToggle={() => onToggle(item.key)}
                onSchedule={onSchedule}
                onPayNow={() => onPayNow(item)}
                onMessage={() => onMessage(item)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CompletedLearningView({
  items,
  expandedKey,
  onToggle,
  onMessage,
}: {
  items: UnifiedLearningItem[];
  expandedKey: string | null;
  onToggle: (key: string) => void;
  onMessage: (item: UnifiedLearningItem) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyPanel
        title="Chưa có lớp hoàn thành"
        description="Khi lớp đạt đủ số buổi học hoặc được đánh dấu hoàn thành, lớp sẽ chuyển sang đây."
      />
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <LearningCard
          key={item.key}
          item={item}
          expanded={expandedKey === item.key}
          completed
          onToggle={() => onToggle(item.key)}
          onMessage={() => onMessage(item)}
        />
      ))}
    </div>
  );
}

function LearningCard({
  item,
  expanded,
  completed = false,
  muted = false,
  payLoading = false,
  onToggle,
  onSchedule,
  onPayNow,
  onMessage,
}: {
  item: UnifiedLearningItem;
  expanded: boolean;
  completed?: boolean;
  muted?: boolean;
  payLoading?: boolean;
  onToggle: () => void;
  onSchedule?: (session?: LearningSessionResponse) => void;
  onPayNow?: () => void;
  onMessage?: () => void;
}) {
  const metrics = getItemMetrics(item);
  const sortedSessions = getSortedSessions(item.sessions);
  const nextSession = sortedSessions.find(isUpcomingScheduledSession);
  const action = getLearningAction(item);
  const progressPct = getProgressPct(metrics);
  const showTimeline = item.sessions.length > 0;
  const isDimmed = completed || muted || action === 'REJECTED';

  return (
    <article
      className={`overflow-hidden rounded-lg border bg-white shadow-xs transition-all duration-200 ${
        completed
          ? 'border-slate-200 bg-slate-50/70'
          : isDimmed
            ? 'border-border-light bg-surface-secondary/60'
            : 'border-border-light hover:border-primary-200 hover:shadow-sm'
      }`}
    >
      <div className="p-3.5 md:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <Avatar
                name={item.tutorName || 'Gia sư'}
                size="md"
                className={`border border-white shadow-sm ${isDimmed ? 'opacity-75 grayscale' : ''}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                    item.type === 'CLASS' ? 'bg-primary-50 text-primary-700' : 'bg-sky-50 text-sky-700'
                  }`}>
                    {item.type === 'CLASS' ? <UsersIcon className="h-3.5 w-3.5" /> : <BookOpenIcon className="h-3.5 w-3.5" />}
                    {item.typeLabel}
                  </span>
                  {completed ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700">
                      <CheckCircleIcon className="h-3.5 w-3.5" />
                      Hoàn thành
                    </span>
                  ) : (
                    getStatusBadge(item.status)
                  )}
                </div>
                <h3 className={`mt-2 line-clamp-2 text-lg font-semibold tracking-tight ${completed ? 'text-text-secondary' : 'text-text-primary'}`}>
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  {item.tutorName ? `GS. ${item.tutorName}` : 'Chưa có gia sư'}
                </p>
              </div>
            </div>
          </div>

          <LearningCardAction
            item={item}
            action={action}
            payLoading={payLoading}
            onSchedule={() => onSchedule?.(nextSession ?? undefined)}
            onPayNow={onPayNow}
          />
        </div>

        <div className="mt-4 space-y-3 md:mt-5">
          <div className="rounded-lg border border-border-light bg-surface-secondary/70 p-3.5 md:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-text-primary">Tiến trình học</p>
              <p className="text-sm font-bold text-primary-700">
                {metrics.expected ? `${metrics.completed}/${metrics.expected} buổi` : `${metrics.completed} buổi đã học`}
                {progressPct !== null && <span className="ml-2 text-text-tertiary">({progressPct}%)</span>}
              </p>
            </div>
            <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-white">
              <div
                className={`h-full rounded-full transition-all ${completed ? 'bg-success-500' : 'bg-primary-500'}`}
                style={{ width: `${progressPct ?? (metrics.completed > 0 ? 100 : 0)}%` }}
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <MetaChip icon={<BookOpenIcon className="h-4 w-4" />} label={item.typeLabel} />
            <MetaChip icon={<ClockIcon className="h-4 w-4" />} label={item.modeLabel} />
            {item.feePerSession && (
              <MetaChip icon={<WalletIcon className="h-4 w-4" />} label={`${toCurrency(item.feePerSession)}/buổi`} />
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border-light bg-white px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex items-start gap-2 text-sm">
            <CalendarIcon className={`mt-0.5 h-4 w-4 shrink-0 ${nextSession ? 'text-primary-600' : 'text-text-tertiary'}`} />
            <div>
              <p className="font-semibold text-text-primary">
                {nextSession
                  ? `Buổi tiếp: ${formatShortDate(nextSession.session_date)} lúc ${nextSession.start_time.slice(0, 5)}`
                  : getNoNextSessionText(item)}
              </p>
              {item.note && (
                <p className={`mt-1 text-xs ${action === 'REJECTED' ? 'text-danger-600' : 'text-text-tertiary'}`}>
                  {item.note}
                </p>
              )}
              {metrics.needsAttendance > 0 && (
                <p className="mt-1 text-xs font-semibold text-warning-600">
                  {metrics.needsAttendance} buổi chờ gia sư cập nhật điểm danh
                </p>
              )}
            </div>
          </div>

          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <button
              type="button"
              onClick={onMessage}
              className="inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-primary-100 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100 sm:w-auto"
            >
              Tin nhắn
            </button>
            <button
              type="button"
              onClick={onToggle}
              className="inline-flex w-full shrink-0 items-center justify-center rounded-lg border border-border-light px-3 py-2 text-xs font-semibold text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
              disabled={!showTimeline}
              aria-expanded={expanded}
            >
              {showTimeline ? (expanded ? 'Ẩn buổi học' : 'Xem buổi học') : 'Chưa có buổi'}
            </button>
          </div>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border-light bg-surface-secondary/50 px-4 py-4 md:px-5">
          <div className="mb-4 flex flex-wrap gap-2">
            <StatPill label="Đã học" value={metrics.completed} tone="success" />
            <StatPill label="Sắp tới" value={metrics.upcoming} tone="default" />
            {metrics.cancelledOrAbsent > 0 && (
              <StatPill label="Hủy/Vắng" value={metrics.cancelledOrAbsent} tone="muted" />
            )}
          </div>
          <ol className="space-y-2">
            {sortedSessions.map((session, idx) => (
              <SessionTimelineRow key={session.id} session={session} index={idx + 1} />
            ))}
          </ol>
        </div>
      )}
    </article>
  );
}

function LearningCardAction({
  item,
  action,
  payLoading,
  onSchedule,
  onPayNow,
}: {
  item: UnifiedLearningItem;
  action: LearningAction;
  payLoading: boolean;
  onSchedule?: () => void;
  onPayNow?: () => void;
}) {
  if (action === 'PAY') {
    return (
      <Button
        className="w-full shrink-0 gap-2 bg-primary-700 text-white hover:bg-primary-800 lg:w-auto"
        onClick={onPayNow}
        disabled={payLoading}
      >
        {payLoading ? (
          'Đang tải...'
        ) : (
          <>
            <WalletIcon className="h-4 w-4" />
            Thanh toán
          </>
        )}
      </Button>
    );
  }

  if (action === 'SCHEDULE') {
    return (
      <Button
        variant="secondary"
        className="w-full shrink-0 gap-2 border border-primary-100 lg:w-auto"
        onClick={onSchedule}
      >
        <CalendarIcon className="h-4 w-4" />
        Vào lịch học
      </Button>
    );
  }

  if (action === 'REJECTED') {
    return (
      <Button variant="outline" className="w-full shrink-0 gap-2 text-danger-600 lg:w-auto" disabled>
        <XIcon className="h-4 w-4" />
        Đã bị từ chối
      </Button>
    );
  }

  if (action === 'WAITING') {
    return (
      <Button variant="outline" className="w-full shrink-0 gap-2 text-text-tertiary lg:w-auto" disabled>
        <ClockIcon className="h-4 w-4" />
        {item.status === 'PENDING' ? 'Chờ duyệt' : 'Chờ phản hồi'}
      </Button>
    );
  }

  return null;
}

function MetaChip({ icon, label }: { icon: ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-lg bg-surface-secondary px-2.5 py-1.5 text-xs font-semibold text-text-secondary">
      {icon}
      {label}
    </span>
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
    <div className="flex flex-wrap items-center gap-2">
      <span className="shrink-0 text-xs font-bold uppercase tracking-[0.14em] text-text-tertiary">{label}:</span>
      <div className="flex flex-wrap gap-1 rounded-lg border border-border-light bg-surface-secondary p-1">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              value === option.value
                ? 'bg-white text-primary-700 shadow-xs'
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

function buildLearningItems(
  myClasses: ClassRegistrationResponse[],
  requests: PrivateRequestResponse[],
  sessions: LearningSessionResponse[],
): UnifiedLearningItem[] {
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

  const classItems: UnifiedLearningItem[] = myClasses.map((reg) => ({
    key: `CLASS_${reg.id}`,
    type: 'CLASS',
    id: reg.class_id,
    paymentTargetId: reg.id,
    paymentTargetType: 'CLASS_REGISTRATION',
    title: reg.class_title || reg.subject_name || `Lớp #${reg.class_id}`,
    tutorName: reg.tutor_name ?? null,
    expectedSessions: reg.total_sessions ?? null,
    feePerSession: reg.fee_per_session_per_student ?? null,
    status: reg.status,
    note: reg.review_note,
    modeLabel: 'Theo lịch lớp',
    typeLabel: 'Lớp nhóm',
    sessions: sessionsByClass.get(reg.class_id) ?? [],
  }));

  const privateItems: UnifiedLearningItem[] = requests.map((request) => ({
    key: `PRIVATE_${request.id}`,
    type: 'PRIVATE',
    id: request.id,
    paymentTargetId: request.id,
    paymentTargetType: 'PRIVATE_TUTORING_REQUEST',
    title: request.subject_name ? `${request.subject_name} - ${request.grade_level}` : `Yêu cầu 1-1 #${request.id}`,
    tutorName: request.tutor_name,
    expectedSessions: request.requested_sessions,
    feePerSession: request.agreed_fee_per_session,
    status: request.status,
    note: request.tutor_response_note,
    modeLabel: formatModeLabel(request.mode),
    typeLabel: 'Học 1-1',
    sessions: sessionsByRequest.get(request.id) ?? [],
  }));

  return [...classItems, ...privateItems];
}

function getLearningAction(item: UnifiedLearningItem): LearningAction {
  if (item.status === 'TUTOR_CONFIRMED' || item.status === 'APPROVED') return 'PAY';
  if (item.status === 'PAID' || item.status === 'ONGOING') return 'SCHEDULE';
  if (item.status === 'SENT' || item.status === 'PENDING') return 'WAITING';
  if (item.status === 'TUTOR_REJECTED' || item.status === 'REJECTED') return 'REJECTED';
  return 'NONE';
}

function isPendingPrivateRequest(item: UnifiedLearningItem) {
  return item.type === 'PRIVATE' && (item.status === 'SENT' || item.status === 'TUTOR_REJECTED');
}

function isCompletedItem(item: UnifiedLearningItem) {
  const metrics = getItemMetrics(item);
  if (item.status === 'COMPLETED') return true;
  return metrics.expected !== null && metrics.expected > 0 && metrics.completed >= metrics.expected;
}

function compareLearningItems(a: UnifiedLearningItem, b: UnifiedLearningItem) {
  const aNext = getNextSessionTime(a);
  const bNext = getNextSessionTime(b);
  if (aNext !== bNext) {
    if (aNext === Number.POSITIVE_INFINITY) return 1;
    if (bNext === Number.POSITIVE_INFINITY) return -1;
    return aNext - bNext;
  }

  const aWeight = getSortWeight(a);
  const bWeight = getSortWeight(b);
  if (aWeight !== bWeight) return aWeight - bWeight;
  return a.title.localeCompare(b.title, 'vi');
}

function compareCompletedItems(a: UnifiedLearningItem, b: UnifiedLearningItem) {
  return getLatestSessionTime(b.sessions) - getLatestSessionTime(a.sessions);
}

function getSortWeight(item: UnifiedLearningItem) {
  const action = getLearningAction(item);
  if (action === 'PAY') return 1;
  if (action === 'SCHEDULE') return 2;
  if (action === 'WAITING') return 3;
  if (action === 'REJECTED') return 4;
  return 5;
}

function getNextSessionTime(item: UnifiedLearningItem) {
  const next = getSortedSessions(item.sessions).find(isUpcomingScheduledSession);
  return next ? getSessionDateTime(next).getTime() : Number.POSITIVE_INFINITY;
}

function getLatestSessionTime(sessions: LearningSessionResponse[]) {
  return sessions.reduce((latest, session) => Math.max(latest, getSessionDateTime(session).getTime()), 0);
}

function getItemMetrics(item: UnifiedLearningItem): LearningMetrics {
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

function getProgressPct(metrics: LearningMetrics) {
  if (!metrics.expected || metrics.expected <= 0) return null;
  return Math.min(100, Math.round((metrics.completed / metrics.expected) * 100));
}

function getNoNextSessionText(item: UnifiedLearningItem) {
  if (item.status === 'SENT') return 'Đã gửi yêu cầu, chờ gia sư phản hồi';
  if (item.status === 'TUTOR_REJECTED') return 'Gia sư đã từ chối yêu cầu';
  if (item.status === 'PENDING') return 'Đang chờ nhân viên duyệt đăng ký';
  if (item.status === 'APPROVED' || item.status === 'TUTOR_CONFIRMED') return 'Lịch học sẽ hiển thị sau khi thanh toán';
  if (item.status === 'COMPLETED') return 'Lớp học đã hoàn thành';
  return item.sessions.length > 0 ? 'Chưa có buổi học sắp tới' : 'Chưa có lịch học';
}

function formatModeLabel(mode: string | null | undefined) {
  if (mode === 'ONLINE') return 'Trực tuyến';
  if (mode === 'OFFLINE') return 'Trực tiếp';
  if (mode === 'BOTH') return 'Linh hoạt';
  return 'Theo thỏa thuận';
}

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

function getSortedSessions(sessions: LearningSessionResponse[]) {
  return sessions.slice().sort((a, b) => getSessionDateTime(a).getTime() - getSessionDateTime(b).getTime());
}

function formatShortDate(dateStr: string) {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
  });
}

function StatPill({ label, value, tone }: { label: string; value: number; tone: 'success' | 'default' | 'muted' }) {
  const cls = tone === 'success'
    ? 'bg-success-50 text-success-700'
    : tone === 'muted'
      ? 'bg-surface-secondary text-text-tertiary'
      : 'bg-white border border-border-light text-text-primary';
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${cls}`}>
      <span className="text-sm font-bold">{value}</span>
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
        ? 'bg-warning-500'
        : 'bg-primary-500';

  return (
    <li className="flex items-start gap-3">
      <div className="mt-1.5 flex flex-col items-center">
        <div className={`h-2.5 w-2.5 rounded-full ${dotColor}`} />
      </div>

      <div className="flex flex-1 flex-wrap items-start justify-between gap-x-4 gap-y-1 rounded-lg border border-border-light bg-white px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold text-text-primary">
            Buổi {session.session_number ?? index} · {formatShortDate(session.session_date)}
            <span className="font-normal text-text-secondary"> {session.start_time.slice(0, 5)}-{session.end_time.slice(0, 5)}</span>
          </p>
          {needsUpdate && (
            <p className="mt-0.5 text-xs text-warning-600">Gia sư chưa cập nhật điểm danh</p>
          )}
          {session.attendance_note && (
            <p className="mt-0.5 text-xs italic text-text-tertiary">"{session.attendance_note}"</p>
          )}
        </div>
        <SessionHistoryStatusBadge session={session} />
      </div>
    </li>
  );
}

function SessionHistoryStatusBadge({ session }: { session: LearningSessionResponse }) {
  if (isAttendanceNeededSession(session)) {
    return (
      <span className="inline-flex items-center rounded-full bg-warning-50 px-2.5 py-0.5 text-xs font-medium text-warning-700">
        Chưa điểm danh
      </span>
    );
  }

  return getStatusBadge(session.status);
}
