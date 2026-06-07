import { useEffect, useState } from 'react';
import { adminApi, extractErrorMessage } from '../../services/api';
import type { AuditLogResponse } from '../../types';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { EmptyPanel, PortalPage, SectionPanel } from '../../components/portal/PortalPage';

/* ── Action config ───────────────────────────────── */

type Category = 'staff' | 'review' | 'account';

interface ActionConfig {
  label: string;
  category: Category;
}

const actionMap: Record<string, ActionConfig> = {
  STAFF_CREATED:          { label: 'Tạo staff',                 category: 'staff' },
  STAFF_STATUS_UPDATED:   { label: 'Cập nhật trạng thái staff', category: 'staff' },
  STAFF_PASSWORD_RESET:   { label: 'Cấp lại mật khẩu staff',   category: 'staff' },
  ACCOUNT_STATUS_UPDATED: { label: 'Cập nhật trạng thái tài khoản', category: 'account' },
  ACCOUNT_PASSWORD_RESET: { label: 'Cấp lại mật khẩu tài khoản',   category: 'account' },
  QUALIFICATION_APPROVED: { label: 'Duyệt chứng chỉ',          category: 'review' },
  QUALIFICATION_REJECTED: { label: 'Từ chối chứng chỉ',         category: 'review' },
  TUTOR_SUBJECT_APPROVED: { label: 'Duyệt môn dạy',            category: 'review' },
  TUTOR_SUBJECT_REJECTED: { label: 'Từ chối môn dạy',           category: 'review' },
  TUTOR_PROFILE_VERIFIED: { label: 'Duyệt hồ sơ gia sư',       category: 'review' },
  TUTOR_PROFILE_REJECTED: { label: 'Từ chối hồ sơ gia sư',     category: 'review' },
};

const categoryConfig: Record<Category, { dot: string; bg: string; icon: string }> = {
  staff:   { dot: 'bg-primary-500', bg: 'border-l-primary-400', icon: '👤' },
  review:  { dot: 'bg-warning-500', bg: 'border-l-warning-400', icon: '✓' },
  account: { dot: 'bg-danger-500',  bg: 'border-l-danger-400',  icon: '🔒' },
};

function getConfig(action: string): ActionConfig & { category: Category } {
  return actionMap[action] || { label: action.replaceAll('_', ' ').toLowerCase(), category: 'account' };
}

/* ── Detail renderer ─────────────────────────────── */

function DetailView({ detail }: { detail: Record<string, unknown> }) {
  if (!detail || Object.keys(detail).length === 0) return null;

  const email = typeof detail.email === 'string' ? detail.email : null;
  const oldStatus = typeof detail.old_status === 'string' ? detail.old_status : null;
  const newStatus = typeof detail.new_status === 'string' ? detail.new_status : null;
  const reviewNote = typeof detail.review_note === 'string' ? detail.review_note : null;
  const role = typeof detail.role === 'string' ? detail.role : null;
  const fullName = typeof detail.full_name === 'string' ? detail.full_name : null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
      {email && (
        <span className="rounded-md bg-surface-tertiary px-2 py-0.5 font-mono text-text-secondary">{email}</span>
      )}
      {fullName && (
        <span className="font-medium text-text-secondary">{fullName}</span>
      )}
      {role && (
        <span className="rounded-md bg-primary-50 px-2 py-0.5 font-semibold text-primary-700">{role}</span>
      )}
      {oldStatus && newStatus && (
        <span className="flex items-center gap-1 text-text-tertiary">
          <span className="rounded bg-surface-tertiary px-1.5 py-0.5">{oldStatus}</span>
          <span>→</span>
          <span className="rounded bg-surface-tertiary px-1.5 py-0.5">{newStatus}</span>
        </span>
      )}
      {reviewNote && (
        <span className="italic text-text-tertiary">"{reviewNote}"</span>
      )}
    </div>
  );
}

/* ── Date helpers ─────────────────────────────────── */

function toDateKey(isoString: string | null): string {
  if (!isoString) return 'unknown';
  return new Date(isoString).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function toDateLabel(isoString: string | null): string {
  if (!isoString) return 'Không rõ';
  const d = new Date(isoString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000);

  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Hôm qua';
  return d.toLocaleDateString('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatTime(isoString: string | null): string {
  if (!isoString) return '-';
  return new Date(isoString).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

/* ── Group entries by date ────────────────────────── */

function groupByDate(logs: AuditLogResponse[]): { dateKey: string; dateLabel: string; entries: AuditLogResponse[] }[] {
  const map = new Map<string, AuditLogResponse[]>();
  const labels = new Map<string, string>();

  for (const log of logs) {
    const key = toDateKey(log.created_at);
    if (!map.has(key)) {
      map.set(key, []);
      labels.set(key, toDateLabel(log.created_at));
    }
    map.get(key)!.push(log);
  }

  return Array.from(map.entries()).map(([dateKey, entries]) => ({
    dateKey,
    dateLabel: labels.get(dateKey) || dateKey,
    entries,
  }));
}

/* ── Summary bar ─────────────────────────────────── */

function CategoryBar({ logs }: { logs: AuditLogResponse[] }) {
  const counts: Record<Category, number> = { staff: 0, review: 0, account: 0 };
  for (const log of logs) {
    const { category } = getConfig(log.action);
    counts[category]++;
  }
  const total = logs.length || 1;

  return (
    <div className="space-y-3">
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-surface-tertiary">
        {(['staff', 'review', 'account'] as Category[]).map((cat) => {
          if (counts[cat] === 0) return null;
          return (
            <div
              key={cat}
              className={`${categoryConfig[cat].dot} transition-all duration-500`}
              style={{ width: `${(counts[cat] / total) * 100}%` }}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1">
        {[
          { cat: 'staff' as Category, label: 'Quản lý staff' },
          { cat: 'review' as Category, label: 'Duyệt vận hành' },
          { cat: 'account' as Category, label: 'Tài khoản' },
        ].map(({ cat, label }) => (
          <div key={cat} className="flex items-center gap-2 text-xs">
            <span className={`inline-block h-2.5 w-2.5 rounded-full ${categoryConfig[cat].dot}`} />
            <span className="font-semibold text-text-primary">{counts[cat]}</span>
            <span className="text-text-tertiary">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Main ────────────────────────────────────────── */

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<AuditLogResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    adminApi.getAuditLog({ limit: 80 })
      .then(setLogs)
      .catch((err) => toast('error', extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <PageLoading />;

  const groups = groupByDate(logs);

  return (
    <PortalPage
      title="Nhật ký hệ thống"
      description={`${logs.length} thao tác gần nhất.`}
    >
      {/* Summary bar */}
      {logs.length > 0 && (
        <div className="rounded-lg border border-border-light bg-white p-5 shadow-xs">
          <CategoryBar logs={logs} />
        </div>
      )}

      <SectionPanel title="Timeline" description="Các hành động nhạy cảm, nhóm theo ngày.">
        {logs.length === 0 ? (
          <EmptyPanel title="Chưa có audit log" description="Các thao tác mới sẽ xuất hiện ở đây." />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.dateKey}>
                {/* Date separator */}
                <div className="mb-3 flex items-center gap-3">
                  <h3 className="shrink-0 text-sm font-bold text-text-primary">{group.dateLabel}</h3>
                  <div className="h-px flex-1 bg-border-light" />
                  <span className="shrink-0 rounded-full bg-surface-tertiary px-2.5 py-0.5 text-xs font-semibold text-text-tertiary">
                    {group.entries.length}
                  </span>
                </div>

                {/* Timeline entries */}
                <div className="relative ml-3 border-l-2 border-border-light pl-6 space-y-1">
                  {group.entries.map((log) => {
                    const config = getConfig(log.action);
                    const catConfig = categoryConfig[config.category];

                    return (
                      <article
                        key={log.id}
                        className={`relative rounded-lg border border-border-light border-l-4 bg-white p-4 transition-all hover:shadow-sm ${catConfig.bg}`}
                      >
                        {/* Timeline dot */}
                        <div className={`absolute -left-[calc(1.5rem+5px)] top-4 h-2.5 w-2.5 rounded-full ring-2 ring-white ${catConfig.dot}`} />

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{catConfig.icon}</span>
                              <p className="font-semibold text-text-primary">{config.label}</p>
                            </div>
                            <p className="mt-1 text-sm text-text-secondary">
                              <span className="font-medium">{log.actor_name || log.actor_email || 'System'}</span>
                              {' '}→ {log.target_type}
                              {log.target_id ? ` #${log.target_id}` : ''}
                            </p>
                            <DetailView detail={log.detail} />
                          </div>
                          <span className="shrink-0 text-xs font-semibold text-text-tertiary">
                            {formatTime(log.created_at)}
                          </span>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPanel>
    </PortalPage>
  );
}
