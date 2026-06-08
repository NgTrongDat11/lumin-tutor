import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../services/api';
import type { AdminStatsResponse } from '../../types';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { ArrowRightIcon, ClipboardCheckIcon, LayersIcon, UsersIcon, WalletIcon } from '../../components/ui/Icons';
import { MetricTile, PortalPage, SectionPanel } from '../../components/portal/PortalPage';
import Button from '../../components/ui/Button';

function currency(value: number) {
  return `${value.toLocaleString('vi-VN')}đ`;
}

const emptyStats: AdminStatsResponse = {
  users_by_role: {},
  total_users: 0,
  active_staff: 0,
  suspended_staff: 0,
  classes_by_status: {},
  paid_revenue: 0,
  pending_tutors: 0,
  payment_queue: 0,
  pending_contracts: 0,
  audit_log_count: 0,
};

/* ── Role distribution bar ─────────────────────── */

const roleConfig: { key: string; label: string; color: string }[] = [
  { key: 'STUDENT', label: 'Học viên', color: 'bg-primary-500' },
  { key: 'TUTOR', label: 'Gia sư', color: 'bg-success-500' },
  { key: 'STAFF', label: 'Nhân viên', color: 'bg-warning-500' },
  { key: 'SUPER_ADMIN', label: 'Quản trị viên', color: 'bg-danger-500' },
];

function RoleDistributionBar({ byRole, total }: { byRole: Partial<Record<string, number>>; total: number }) {
  if (total === 0) {
    return <p className="text-sm text-text-tertiary">Chưa có dữ liệu tài khoản.</p>;
  }

  return (
    <div className="space-y-3">
      {/* Stacked bar */}
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-tertiary">
        {roleConfig.map(({ key, label, color }) => {
          const count = byRole[key] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={key}
              className={`${color} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${label}: ${count}`}
            />
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {roleConfig.map(({ key, label, color }) => {
          const count = byRole[key] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          if (count === 0) return null;
          return (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className={`inline-block h-3 w-3 rounded-full ${color}`} />
              <span className="font-medium text-text-primary">{count}</span>
              <span className="text-text-tertiary">{label} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Class distribution bar ─────────────────────── */

const classConfig: { key: string; label: string; color: string }[] = [
  { key: 'DRAFT', label: 'Bản nháp', color: 'bg-surface-tertiary' },
  { key: 'TUTOR_RECRUITING', label: 'Tuyển GS', color: 'bg-warning-400' },
  { key: 'ENROLLING', label: 'Tuyển sinh', color: 'bg-primary-400' },
  { key: 'READY', label: 'Sẵn sàng', color: 'bg-success-400' },
  { key: 'ONGOING', label: 'Đang học', color: 'bg-success-600' },
  { key: 'COMPLETED', label: 'Hoàn thành', color: 'bg-text-tertiary' },
  { key: 'CANCELLED', label: 'Đã hủy', color: 'bg-danger-400' },
];

function ClassDistributionBar({ byStatus }: { byStatus: Partial<Record<string, number>> }) {
  const total = Object.values(byStatus).reduce<number>((sum, value) => sum + (value || 0), 0);
  
  if (total === 0) {
    return <p className="text-sm text-text-tertiary">Chưa có dữ liệu lớp học.</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex h-4 w-full overflow-hidden rounded-full bg-surface-tertiary">
        {classConfig.map(({ key, label, color }) => {
          const count = byStatus[key] || 0;
          if (count === 0) return null;
          const pct = (count / total) * 100;
          return (
            <div
              key={key}
              className={`${color} transition-all duration-500`}
              style={{ width: `${pct}%` }}
              title={`${label}: ${count}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {classConfig.map(({ key, label, color }) => {
          const count = byStatus[key] || 0;
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          if (count === 0) return null;
          return (
            <div key={key} className="flex items-center gap-2 text-sm">
              <span className={`inline-block h-3 w-3 rounded-full ${color}`} />
              <span className="font-medium text-text-primary">{count}</span>
              <span className="text-text-tertiary">{label} ({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Alert card ────────────────────────────────── */

interface AlertItem {
  label: string;
  value: number;
  hint: string;
  href: string;
  tone: 'warning' | 'danger';
}

const toneStyles = {
  warning: 'border-l-warning-500 bg-warning-50/50',
  danger: 'border-l-danger-500 bg-danger-50/50',
};

const toneIcon = {
  warning: 'text-warning-600',
  danger: 'text-danger-600',
};

function AlertCard({ item }: { item: AlertItem }) {
  return (
    <Link
      to={item.href}
      className={`flex items-center gap-4 rounded-lg border border-border-light border-l-4 p-4 transition-all hover:shadow-sm ${toneStyles[item.tone]}`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className={`text-2xl font-bold ${toneIcon[item.tone]}`}>{item.value}</span>
          <span className="text-sm font-semibold text-text-primary">{item.label}</span>
        </div>
        <p className="mt-1 text-xs text-text-tertiary">{item.hint}</p>
      </div>
      <ArrowRightIcon className="h-4 w-4 shrink-0 text-text-tertiary" />
    </Link>
  );
}

/* ── Dashboard ─────────────────────────────────── */

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStatsResponse>(emptyStats);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats()
      .then(setStats)
      .catch(() => setStats(emptyStats))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <DashboardSkeleton />;

  const activeClasses = (stats.classes_by_status.READY || 0) + (stats.classes_by_status.ONGOING || 0);

  // Build alert items — chỉ hiện khi > 0
  const alerts: AlertItem[] = [
    stats.pending_tutors > 0 && { label: 'Gia sư cần duyệt', value: stats.pending_tutors, hint: 'Vào Gia sư để xử lý.', href: '/staff/tutors', tone: 'warning' as const },
    stats.pending_contracts > 0 && { label: 'Hợp đồng chờ', value: stats.pending_contracts, hint: 'Vào Lịch & hợp đồng.', href: '/staff/operations', tone: 'warning' as const },
    stats.payment_queue > 0 && { label: 'Giao dịch chờ', value: stats.payment_queue, hint: 'Vào Tài chính.', href: '/staff/payments', tone: 'warning' as const },
    stats.suspended_staff > 0 && { label: 'Nhân viên bị khóa', value: stats.suspended_staff, hint: 'Kiểm tra quyền vận hành.', href: '/admin/staff', tone: 'danger' as const },
  ].filter(Boolean) as AlertItem[];

  return (
    <PortalPage
      title="Tổng quan quản trị"
      description="Sức khỏe hệ thống và các cảnh báo cần xử lý."
      actions={(
        <Link to="/admin/staff">
          <Button>
            Quản lý nhân viên <ArrowRightIcon className="h-4 w-4" />
          </Button>
        </Link>
      )}
    >
      {/* Hero metrics */}
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={WalletIcon} label="Doanh thu" value={currency(stats.paid_revenue)} hint="Giao dịch thành công." tone="success" />
        <MetricTile icon={LayersIcon} label="Lớp đang mở" value={activeClasses} hint="Sẵn sàng hoặc đang học." />
        <MetricTile icon={UsersIcon} label="Nhân viên" value={stats.active_staff} hint={`${stats.suspended_staff} bị khóa.`} href="/admin/staff" tone="neutral" />
        <MetricTile icon={ClipboardCheckIcon} label="Nhật ký hệ thống" value={stats.audit_log_count} hint="Thao tác nhạy cảm." href="/admin/audit" tone="primary" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Alerts */}
        <SectionPanel title="Cảnh báo" description="Các hàng chờ cần xử lý.">
          {alerts.length === 0 ? (
            <div className="rounded-lg border border-dashed border-success-200 bg-success-50/30 p-5 text-center">
              <p className="text-sm font-semibold text-success-700">✓ Không có cảnh báo</p>
              <p className="mt-1 text-xs text-success-600/80">Các hàng chờ đang trống.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {alerts.map((item) => (
                <AlertCard key={item.label} item={item} />
              ))}
            </div>
          )}
        </SectionPanel>

        <div className="grid gap-6">
          <SectionPanel title="Thống kê lớp học" description="Phân bổ lớp theo trạng thái.">
            <ClassDistributionBar byStatus={stats.classes_by_status} />
          </SectionPanel>

          {/* Role distribution */}
          <SectionPanel title="Cơ cấu tài khoản" description={`${stats.total_users} tài khoản.`}>
            <RoleDistributionBar byRole={stats.users_by_role} total={stats.total_users} />

            {/* Quick links */}
            <div className="mt-5 flex flex-wrap gap-2 border-t border-border-light pt-4">
              {[
                { label: 'Quản lý nhân viên', href: '/admin/staff' },
                { label: 'Nhật ký', href: '/admin/audit' },
                { label: 'Hệ thống', href: '/admin/system' },
              ].map((link) => (
                <Link key={link.label} to={link.href} className="rounded-md border border-border-light px-3 py-1.5 text-xs font-semibold text-text-secondary transition-colors hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700">
                  {link.label}
                </Link>
              ))}
              <Link to="/staff" className="rounded-md border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100">
                → Chuyển sang Bảng vận hành
              </Link>
            </div>
          </SectionPanel>
        </div>
      </div>
    </PortalPage>
  );
}
