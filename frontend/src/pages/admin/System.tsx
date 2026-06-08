import { useEffect, useState } from 'react';
import { adminApi } from '../../services/api';
import type { AdminStatsResponse } from '../../types';
import { FormSkeleton } from '../../components/ui/Skeleton';
import { PortalPage, SectionPanel } from '../../components/portal/PortalPage';

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

/* ── Health check ────────────────────────────────── */

interface HealthStatus {
  ok: boolean;
  message: string;
  latency: number;
}

async function checkHealth(): Promise<HealthStatus> {
  const start = performance.now();
  try {
    const res = await fetch('/api/v1/health');
    const latency = Math.round(performance.now() - start);
    if (!res.ok) return { ok: false, message: `Lỗi HTTP ${res.status}`, latency };
    const data = await res.json();
    return { ok: data.status === 'ok', message: data.message || 'Ổn định', latency };
  } catch {
    const latency = Math.round(performance.now() - start);
    return { ok: false, message: 'Không kết nối được', latency };
  }
}

/* ── Status indicator ────────────────────────────── */

function StatusDot({ ok }: { ok: boolean }) {
  return (
    <span className="relative flex h-3 w-3">
      {ok && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success-400 opacity-75" />}
      <span className={`relative inline-flex h-3 w-3 rounded-full ${ok ? 'bg-success-500' : 'bg-danger-500'}`} />
    </span>
  );
}

/* ── Info row ─────────────────────────────────────── */

function InfoRow({ label, value, mono }: { label: string; value: string | number; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className={`text-sm font-semibold text-text-primary ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
}

/* ── Permissions matrix ──────────────────────────── */

const permissionsData = [
  { role: 'Quản trị viên', color: 'bg-danger-500', perms: 'Quản lý nhân viên · Nhật ký hệ thống · Thống kê · Cấu hình · Truy cập vận hành' },
  { role: 'Nhân viên', color: 'bg-warning-500', perms: 'Duyệt gia sư · Quản lý học viên · Lớp · Lịch · Hợp đồng · Thanh toán' },
  { role: 'Gia sư', color: 'bg-success-500', perms: 'Hồ sơ · Môn dạy · Lịch rảnh · Lớp/yêu cầu đã nhận' },
  { role: 'Học viên', color: 'bg-primary-500', perms: 'Nhu cầu học · Gợi ý · Đăng ký lớp · Thanh toán · Đánh giá' },
];

/* ── Main ────────────────────────────────────────── */

export default function AdminSystem() {
  const [stats, setStats] = useState<AdminStatsResponse>(emptyStats);
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.getStats().catch(() => emptyStats),
      checkHealth(),
    ]).then(([statsData, healthData]) => {
      setStats(statsData);
      setHealth(healthData);
      setLoading(false);
    });
  }, []);

  if (loading) return <FormSkeleton />;

  const activeClasses = (stats.classes_by_status.READY || 0) + (stats.classes_by_status.ONGOING || 0);
  const totalClasses = Object.values(stats.classes_by_status).reduce((a, b) => a + b, 0);

  return (
    <PortalPage
      title="Thông tin hệ thống"
      description="Trạng thái, số liệu và ranh giới quyền."
    >
      <div className="grid gap-6 xl:grid-cols-2">
        {/* Health & System info */}
        <SectionPanel title="Trạng thái" description="Kết nối API và số liệu hoạt động.">
          <div className="divide-y divide-border-light">
            {/* API health */}
            <div className="flex items-center justify-between gap-4 py-3">
              <div className="flex items-center gap-3">
                <StatusDot ok={health?.ok ?? false} />
                <span className="text-sm font-semibold text-text-primary">Máy chủ API</span>
              </div>
              <div className="text-right">
                <span className={`text-sm font-semibold ${health?.ok ? 'text-success-700' : 'text-danger-600'}`}>
                  {health?.ok ? 'Hoạt động' : 'Lỗi'}
                </span>
                {health && (
                  <span className="ml-2 text-xs text-text-tertiary">{health.latency}ms</span>
                )}
              </div>
            </div>

            <InfoRow label="Tổng tài khoản" value={stats.total_users} />
            <InfoRow label="Nhân viên hoạt động" value={`${stats.active_staff} đang hoạt động · ${stats.suspended_staff} bị khóa`} />
            <InfoRow label="Tổng lớp" value={`${totalClasses} (${activeClasses} đang mở)`} />
            <InfoRow label="Gia sư chờ duyệt" value={stats.pending_tutors} />
            <InfoRow label="Mục nhật ký hệ thống" value={stats.audit_log_count} />
            <InfoRow label="Giao dịch thành công" value={`${stats.paid_revenue.toLocaleString('vi-VN')}đ`} mono />
          </div>
        </SectionPanel>

        {/* Permissions matrix */}
        <SectionPanel title="Ma trận quyền" description="Phân quyền hiện tại theo vai trò.">
          <div className="space-y-3">
            {permissionsData.map((item) => (
              <div key={item.role} className="rounded-lg border border-border-light bg-white p-4">
                <div className="flex items-center gap-2.5">
                  <span className={`inline-block h-3 w-3 rounded-full ${item.color}`} />
                  <h3 className="text-sm font-bold text-text-primary">{item.role}</h3>
                </div>
                <p className="mt-2 text-xs leading-5 text-text-secondary">{item.perms}</p>
              </div>
            ))}
          </div>

          {/* Roadmap note — compact */}
          <div className="mt-4 rounded-lg border border-dashed border-border bg-surface-secondary p-3">
            <p className="text-xs leading-5 text-text-tertiary">
              <span className="font-semibold text-text-secondary">Hướng mở rộng:</span>{' '}
              Phân quyền chi tiết cho nhân viên, cấu hình tỷ lệ hoa hồng qua cơ sở dữ liệu, quy tắc duyệt gia sư tự động.
            </p>
          </div>
        </SectionPanel>
      </div>
    </PortalPage>
  );
}
