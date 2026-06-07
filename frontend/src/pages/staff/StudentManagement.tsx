import { useEffect, useMemo, useRef, useState } from 'react';
import { staffApi } from '../../services/api';
import { getStatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { SearchIcon, UsersIcon, ShieldCheckIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel } from '../../components/portal/PortalPage';
import Avatar from '../../components/ui/Avatar';

/* ── Types ───────────────────────────────────────── */

interface StudentRecord {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  status: string;
  created_at: string | null;
}

type ConfirmAction = { type: 'toggle'; student: StudentRecord } | { type: 'reset'; student: StudentRecord };

/* ── Dropdown menu ───────────────────────────────── */

function ActionMenu({ student, onToggle, onReset, loading }: {
  student: StudentRecord;
  onToggle: () => void;
  onReset: () => void;
  loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleLabel = student.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa';
  const toggleClass = student.status === 'ACTIVE' ? 'text-danger-600 hover:bg-danger-50' : 'text-success-700 hover:bg-success-50';

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={loading}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary transition-colors hover:bg-surface-tertiary hover:text-text-primary disabled:opacity-50"
      >
        <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-44 rounded-lg border border-border-light bg-white py-1 shadow-lg animate-fade-in">
          <button type="button" onClick={() => { setOpen(false); onReset(); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-secondary">
            <svg className="h-4 w-4 text-text-tertiary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
            Cấp lại mật khẩu
          </button>
          <div className="mx-2 border-t border-border-light" />
          <button type="button" onClick={() => { setOpen(false); onToggle(); }} className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${toggleClass}`}>
            {student.status === 'ACTIVE' ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
            {toggleLabel}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Student card (mobile) ───────────────────────── */

function StudentCard({ student, onToggle, onReset, loading }: {
  student: StudentRecord;
  onToggle: () => void;
  onReset: () => void;
  loading: boolean;
}) {
  const suspended = student.status === 'SUSPENDED';
  return (
    <article className={`rounded-lg border p-4 transition-all ${suspended ? 'border-danger-200 bg-danger-50/20' : 'border-border-light bg-white hover:shadow-sm'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={student.full_name} src={student.avatar_url || undefined} size="sm" />
          <div className="min-w-0">
            <h3 className={`truncate font-semibold ${suspended ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
              {student.full_name}
            </h3>
            <p className="text-xs text-text-tertiary">{student.email}</p>
          </div>
        </div>
        <ActionMenu student={student} onToggle={onToggle} onReset={onReset} loading={loading} />
      </div>
      <div className="mt-3 flex items-center gap-3 text-xs text-text-tertiary">
        {getStatusBadge(student.status)}
        <span>·</span>
        <span>{student.phone || 'Chưa có SĐT'}</span>
        <span>·</span>
        <span>{student.created_at ? new Date(student.created_at).toLocaleDateString('vi-VN') : '-'}</span>
      </div>
    </article>
  );
}

/* ── Main ────────────────────────────────────────── */

export default function StaffStudentManagement() {
  const [students, setStudents] = useState<StudentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [resetResult, setResetResult] = useState<{ name: string; password: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const { toast } = useToast();

  const load = () => {
    staffApi.getStudents()
      .then(setStudents)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const activeCount = students.filter(s => s.status === 'ACTIVE').length;
  const suspendedCount = students.filter(s => s.status === 'SUSPENDED').length;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s =>
      s.full_name.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q) ||
      (s.phone || '').includes(q),
    );
  }, [search, students]);

  /* ── Confirm modal handler ── */

  const executeConfirmAction = async () => {
    if (!confirmAction) return;
    const student = confirmAction.student;

    setActionLoading(student.id);
    try {
      if (confirmAction.type === 'toggle') {
        const nextStatus = student.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
        const label = nextStatus === 'SUSPENDED' ? 'khóa' : 'mở khóa';
        await staffApi.updateAccountStatus(student.id, nextStatus);
        toast('success', `Đã ${label} tài khoản ${student.full_name}`);
        load();
      } else {
        const result = await staffApi.resetPassword(student.id);
        setResetResult({ name: student.full_name, password: result.temp_password });
        toast('success', `Đã cấp lại mật khẩu cho ${student.full_name}`);
      }
    } catch {
      toast('error', 'Thao tác thất bại');
    } finally {
      setActionLoading(null);
      setConfirmAction(null);
    }
  };

  const confirmLabel = confirmAction
    ? confirmAction.type === 'toggle'
      ? confirmAction.student.status === 'ACTIVE' ? 'Khóa tài khoản' : 'Mở khóa'
      : 'Cấp lại mật khẩu'
    : '';

  const confirmDesc = confirmAction
    ? confirmAction.type === 'toggle'
      ? confirmAction.student.status === 'ACTIVE'
        ? `Học viên "${confirmAction.student.full_name}" sẽ không thể đăng nhập sau khi bị khóa.`
        : `Mở khóa để học viên "${confirmAction.student.full_name}" có thể đăng nhập lại.`
      : `Mật khẩu cũ của "${confirmAction.student.full_name}" sẽ bị hủy và thay bằng mật khẩu tạm mới.`
    : '';

  const confirmDanger = confirmAction?.type === 'toggle' && confirmAction.student.status === 'ACTIVE';

  if (loading) return <PageLoading />;

  return (
    <PortalPage
      title="Quản lý học viên"
      description="Quản lý trạng thái tài khoản và cấp lại mật khẩu."
    >
      {/* Metrics */}
      {students.length >= 2 && (
        <div className="grid gap-4 md:grid-cols-3">
          <MetricTile icon={UsersIcon} label="Tổng học viên" value={students.length} hint="Đã đăng ký hệ thống." tone="neutral" />
          <MetricTile icon={ShieldCheckIcon} label="Đang hoạt động" value={activeCount} hint="Tài khoản bình thường." tone="success" />
          <MetricTile icon={UsersIcon} label="Bị khóa" value={suspendedCount} hint="Tài khoản tạm dừng." tone={suspendedCount > 0 ? 'warning' : 'neutral'} />
        </div>
      )}

      <SectionPanel title="Danh sách học viên" description={`${students.length} tài khoản.`}>
        <div className="mb-4">
          <div className="relative max-w-sm">
            <SearchIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
            <input
              type="text"
              placeholder="Tìm theo tên, email hoặc SĐT..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full rounded-lg border border-border bg-white py-2 pl-9 pr-4 text-sm outline-none transition-all focus:border-primary-300 focus:ring-1 focus:ring-primary-200"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyPanel title="Không tìm thấy học viên" description={search ? 'Thử từ khóa khác.' : 'Chưa có học viên nào.'} />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border-light text-left">
                    <th className="px-4 py-3 font-semibold text-text-secondary">Học viên</th>
                    <th className="px-4 py-3 font-semibold text-text-secondary">Email</th>
                    <th className="px-4 py-3 font-semibold text-text-secondary">SĐT</th>
                    <th className="px-4 py-3 font-semibold text-text-secondary">Ngày tham gia</th>
                    <th className="px-4 py-3 font-semibold text-text-secondary">Trạng thái</th>
                    <th className="px-4 py-3 text-right font-semibold text-text-secondary" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-light">
                  {filtered.map((student) => (
                    <tr key={student.id} className={student.status === 'SUSPENDED' ? 'bg-danger-50/30' : 'hover:bg-surface-secondary'}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={student.full_name} src={student.avatar_url || undefined} size="sm" />
                          <span className={`font-medium ${student.status === 'SUSPENDED' ? 'text-text-tertiary line-through' : 'text-text-primary'}`}>
                            {student.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-text-secondary">{student.email}</td>
                      <td className="px-4 py-3 text-text-secondary">{student.phone || '—'}</td>
                      <td className="px-4 py-3 text-text-secondary">
                        {student.created_at ? new Date(student.created_at).toLocaleDateString('vi-VN') : '—'}
                      </td>
                      <td className="px-4 py-3">{getStatusBadge(student.status)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end">
                          <ActionMenu
                            student={student}
                            onToggle={() => setConfirmAction({ type: 'toggle', student })}
                            onReset={() => setConfirmAction({ type: 'reset', student })}
                            loading={actionLoading === student.id}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="grid gap-3 md:hidden">
              {filtered.map((student) => (
                <StudentCard
                  key={student.id}
                  student={student}
                  onToggle={() => setConfirmAction({ type: 'toggle', student })}
                  onReset={() => setConfirmAction({ type: 'reset', student })}
                  loading={actionLoading === student.id}
                />
              ))}
            </div>
          </>
        )}
      </SectionPanel>

      {/* Confirm action modal */}
      {confirmAction && (
        <Modal
          open={true}
          onClose={() => setConfirmAction(null)}
          title={confirmLabel}
          size="sm"
          footer={(
            <>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Hủy</Button>
              <Button
                variant={confirmDanger ? 'danger' : 'primary'}
                loading={actionLoading === confirmAction.student.id}
                onClick={executeConfirmAction}
              >
                {confirmLabel}
              </Button>
            </>
          )}
        >
          <p className="text-sm leading-6 text-text-secondary">{confirmDesc}</p>
        </Modal>
      )}

      {/* Password result modal */}
      {resetResult && (
        <Modal
          open={true}
          onClose={() => setResetResult(null)}
          title="Mật khẩu tạm"
          size="sm"
          footer={<Button onClick={() => setResetResult(null)}>Đã ghi nhận</Button>}
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Mật khẩu tạm cho <strong>{resetResult.name}</strong>:
            </p>
            <div className="rounded-lg border border-border-light bg-surface-tertiary p-4 text-center">
              <code className="select-all text-2xl font-bold tracking-widest text-primary-700">{resetResult.password}</code>
            </div>
            <p className="rounded-lg border border-warning-200 bg-warning-50 p-3 text-xs leading-5 text-warning-800">
              Mật khẩu này chỉ hiển thị một lần. Học viên nên đổi mật khẩu sau khi đăng nhập.
            </p>
          </div>
        </Modal>
      )}
    </PortalPage>
  );
}
