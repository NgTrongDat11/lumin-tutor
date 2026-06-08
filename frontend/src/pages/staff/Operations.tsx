import { useEffect, useMemo, useState } from 'react';
import { scheduleApi } from '../../services/api';
import type { ContractResponse, ContractStatus, LearningSessionResponse, SchedulePatternResponse, SessionStatus } from '../../types';
import Button from '../../components/ui/Button';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { getStatusBadge } from '../../components/ui/Badge';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { CalendarIcon, ClipboardCheckIcon, ClockIcon, UserCheckIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel, SegmentedTabs, WeekPlanner, type WeekEvent } from '../../components/portal/PortalPage';

type OperationTab = 'schedules' | 'contracts';

const dayLabels = ['', 'CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function sessionDay(dateValue: string) {
  const jsDay = new Date(dateValue).getDay();
  return jsDay === 0 ? 1 : jsDay + 1;
}

function timeRange(start?: string, end?: string) {
  return `${start?.slice(0, 5) || '--:--'} - ${end?.slice(0, 5) || '--:--'}`;
}

export default function StaffOperations({ initialTab = 'schedules' }: { initialTab?: OperationTab }) {
  const [activeTab, setActiveTab] = useState<OperationTab>(initialTab);
  const [patterns, setPatterns] = useState<SchedulePatternResponse[]>([]);
  const [sessions, setSessions] = useState<LearningSessionResponse[]>([]);
  const [contracts, setContracts] = useState<ContractResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionFilter, setSessionFilter] = useState<'ALL' | SessionStatus>('SCHEDULED');
  const [contractFilter, setContractFilter] = useState<'ALL' | ContractStatus>('PENDING');
  const [confirmAction, setConfirmAction] = useState<{ id: number; action: ContractStatus } | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [showPatterns, setShowPatterns] = useState(false);
  const { toast } = useToast();

  const load = () => {
    Promise.all([
      scheduleApi.listPatterns().catch(() => []),
      scheduleApi.listSessions().catch(() => []),
      scheduleApi.listContracts().catch(() => []),
    ]).then(([patternList, sessionList, contractList]) => {
      setPatterns(patternList);
      setSessions(sessionList);
      setContracts(contractList);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const updateContract = async (id: number, status: ContractStatus) => {
    setActionLoading(true);
    try {
      await scheduleApi.updateContractStatus(id, { status });
      toast('success', 'Đã cập nhật hợp đồng');
      load();
    } catch {
      toast('error', 'Cập nhật thất bại');
    } finally {
      setActionLoading(false);
      setConfirmAction(null);
    }
  };

  const filteredSessions = useMemo(() => {
    if (sessionFilter === 'ALL') return sessions;
    return sessions.filter((s) => s.status === sessionFilter);
  }, [sessionFilter, sessions]);

  const filteredContracts = useMemo(() => {
    if (contractFilter === 'ALL') return contracts;
    return contracts.filter((c) => c.status === contractFilter);
  }, [contractFilter, contracts]);

  const scheduled = sessions.filter((s) => s.status === 'SCHEDULED').length;
  const completed = sessions.filter((s) => s.status === 'COMPLETED').length;
  const pendingContracts = contracts.filter((c) => c.status === 'PENDING').length;
  const activeContracts = contracts.filter((c) => c.status === 'ACTIVE').length;

  const weekEvents: WeekEvent[] = sessions
    .filter((s) => s.status === 'SCHEDULED')
    .map((s) => ({
      id: s.id,
      dayOfWeek: sessionDay(s.session_date),
      title: s.private_request_id ? `1-1 #${s.private_request_id}` : `Lớp #${s.class_id}`,
      time: timeRange(s.start_time, s.end_time),
      meta: `GS #${s.tutor_id}`,
      tone: 'primary',
    }));

  if (loading) return <DashboardSkeleton />;

  const contractStatusLabel = (status: ContractStatus) => {
    const labels: Partial<Record<ContractStatus, string>> = {
      PENDING: 'Chờ duyệt',
      ACTIVE: 'Đang hiệu lực',
      COMPLETED: 'Hoàn thành',
      CANCELLED: 'Đã hủy',
    };
    return labels[status] || status;
  };

  return (
    <PortalPage
      title="Lịch và hợp đồng"
      description="Lịch học và hợp đồng sau khi lớp/yêu cầu được chốt."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={CalendarIcon} label="Đã lên lịch" value={scheduled} hint="Cần điểm danh." />
        <MetricTile icon={ClockIcon} label="Đã hoàn thành" value={completed} hint="Nền thanh toán." tone="success" />
        <MetricTile icon={ClipboardCheckIcon} label="HĐ chờ duyệt" value={pendingContracts} hint="Cần xử lý." tone="warning" />
        <MetricTile icon={UserCheckIcon} label="HĐ hiệu lực" value={activeContracts} hint="Đang vận hành." tone="neutral" />
      </div>

      <SegmentedTabs
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'schedules', label: 'Lịch học', count: sessions.length },
          { value: 'contracts', label: 'Hợp đồng', count: contracts.length },
        ]}
      />

      {activeTab === 'schedules' ? (
        <div className="space-y-6">
          {/* Week planner */}
          <SectionPanel title="Lịch tuần" description="Các buổi đã lên lịch.">
            <WeekPlanner events={weekEvents} emptyText="Trống" />
          </SectionPanel>

          {/* Sessions list */}
          <SectionPanel
            title="Buổi học"
            description={`${filteredSessions.length} buổi.`}
            action={(
              <div className="flex items-center gap-2">
                {/* Patterns toggle */}
                <Button variant="ghost" size="sm" onClick={() => setShowPatterns(!showPatterns)}>
                  {showPatterns ? 'Ẩn lịch lặp' : `Lịch lặp (${patterns.length})`}
                </Button>
                <div className="flex gap-1 rounded-lg border border-border-light bg-surface-secondary p-1">
                  {(['SCHEDULED', 'COMPLETED', 'CANCELLED', 'ALL'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setSessionFilter(f)}
                      className={`rounded-md px-2.5 py-1 text-xs font-semibold ${sessionFilter === f ? 'bg-white text-text-primary shadow-xs' : 'text-text-secondary hover:bg-white/70'}`}
                    >
                      {f === 'SCHEDULED' ? 'Sắp học' : f === 'COMPLETED' ? 'Đã học' : f === 'CANCELLED' ? 'Đã hủy' : 'Tất cả'}
                    </button>
                  ))}
                </div>
              </div>
            )}
          >
            {/* Expandable patterns */}
            {showPatterns && patterns.length > 0 && (
              <div className="mb-4 rounded-lg border border-border-light bg-surface-secondary p-3">
                <p className="mb-2 text-xs font-semibold text-text-secondary">Lịch lặp ({patterns.length})</p>
                <div className="flex flex-wrap gap-2">
                  {patterns.map((p) => (
                    <span key={p.id} className="rounded-md border border-border-light bg-white px-2.5 py-1 text-xs text-text-secondary">
                      {dayLabels[p.day_of_week]} {timeRange(p.start_time, p.end_time)} · {p.private_request_id ? `1-1 #${p.private_request_id}` : `Lớp #${p.class_id}`}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {filteredSessions.length === 0 ? (
              <EmptyPanel title="Không có buổi học" description={sessionFilter !== 'ALL' ? 'Thử bộ lọc khác.' : undefined} />
            ) : (
              <div className="divide-y divide-border-light">
                {filteredSessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-text-primary">
                          {s.private_request_id ? `1-1 #${s.private_request_id}` : `Lớp #${s.class_id}`}
                        </h3>
                        {getStatusBadge(s.status)}
                      </div>
                      <p className="mt-0.5 text-xs text-text-tertiary">
                        {new Date(s.session_date).toLocaleDateString('vi-VN')} · {timeRange(s.start_time, s.end_time)} · GS #{s.tutor_id}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionPanel>
        </div>
      ) : (
        <SectionPanel
          title="Hợp đồng"
          description={`${filteredContracts.length} hợp đồng.`}
          action={(
            <div className="flex gap-1 rounded-lg border border-border-light bg-surface-secondary p-1">
              {(['PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ALL'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setContractFilter(f)}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${contractFilter === f ? 'bg-white text-text-primary shadow-xs' : 'text-text-secondary hover:bg-white/70'}`}
                >
                  {f === 'ALL' ? 'Tất cả' : f === 'PENDING' ? 'Chờ duyệt' : f === 'ACTIVE' ? 'Hiệu lực' : f === 'COMPLETED' ? 'Hoàn thành' : 'Đã hủy'}
                </button>
              ))}
            </div>
          )}
        >
          {filteredContracts.length === 0 ? (
            <EmptyPanel title="Không có hợp đồng" description={contractFilter !== 'ALL' ? 'Thử bộ lọc khác.' : undefined} />
          ) : (
            <div className="divide-y divide-border-light">
              {filteredContracts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">HĐ #{c.id}</h3>
                      {getStatusBadge(c.status)}
                    </div>
                    <p className="mt-0.5 text-xs text-text-secondary">
                      {c.tutor_name || `GS #${c.tutor_id}`} · {c.target_name || (c.private_request_id ? `1-1 #${c.private_request_id}` : `Lớp #${c.class_id}`)}
                    </p>
                    <p className="text-xs text-text-tertiary">
                      {c.commission_name_snapshot}: TT {parseFloat(c.center_rate_snapshot).toFixed(0)}% · GS {parseFloat(c.tutor_rate_snapshot).toFixed(0)}%
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {c.status === 'PENDING' && (
                      <>
                        <Button size="sm" variant="outline" onClick={() => setConfirmAction({ id: c.id, action: 'CANCELLED' })}>Hủy</Button>
                        <Button size="sm" onClick={() => setConfirmAction({ id: c.id, action: 'ACTIVE' })}>Duyệt</Button>
                      </>
                    )}
                    {c.status === 'ACTIVE' && (
                      <Button size="sm" variant="outline" onClick={() => setConfirmAction({ id: c.id, action: 'COMPLETED' })}>Hoàn thành</Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      )}

      <ConfirmDialog
        open={confirmAction !== null}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => confirmAction && updateContract(confirmAction.id, confirmAction.action)}
        title="Xác nhận cập nhật"
        description={`Chuyển hợp đồng #${confirmAction?.id} sang trạng thái ${confirmAction ? contractStatusLabel(confirmAction.action) : ''}?`}
        confirmText="Xác nhận"
        danger={confirmAction?.action === 'CANCELLED'}
        loading={actionLoading}
      />
    </PortalPage>
  );
}
