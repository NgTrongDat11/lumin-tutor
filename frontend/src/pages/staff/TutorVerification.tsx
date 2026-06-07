import { useEffect, useState } from 'react';
import { staffApi } from '../../services/api';
import type { TutorPublicResponse, TutorDetailResponse } from '../../types';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import Input from '../../components/ui/Input';
import DocumentLink from '../../components/ui/DocumentLink';
import { getStatusBadge } from '../../components/ui/Badge';
import Spinner, { PageLoading } from '../../components/ui/Spinner';
import EmptyState from '../../components/ui/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { BookOpenIcon, CalendarIcon, SearchIcon, ShieldCheckIcon, UserCheckIcon } from '../../components/ui/Icons';
import { MetricTile, PortalPage, SectionPanel } from '../../components/portal/PortalPage';

type TutorFilter = 'ALL' | 'PENDING_REVIEW' | 'VERIFIED' | 'REJECTED';

export default function StaffTutorVerification() {
  const [allTutors, setAllTutors] = useState<TutorPublicResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTutor, setSelectedTutor] = useState<TutorPublicResponse | null>(null);
  const [filter, setFilter] = useState<TutorFilter>('ALL');
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const load = () => {
    staffApi.getAllTutors().then(setAllTutors).catch(() => {}).finally(() => setLoading(false));
  };
  useEffect(load, []);

  if (loading) return <PageLoading />;

  const pendingCount = allTutors.filter(t => t.verification_status === 'PENDING_REVIEW').length;
  const verifiedCount = allTutors.filter(t => t.verification_status === 'VERIFIED').length;
  const rejectedCount = allTutors.filter(t => t.verification_status === 'REJECTED').length;

  const filtered = allTutors
    .filter(t => filter === 'ALL' || t.verification_status === filter)
    .filter(t => {
      if (!search) return true;
      const q = search.toLowerCase();
      return t.full_name.toLowerCase().includes(q) ||
        t.subjects.some(s => s.subject_name?.toLowerCase().includes(q)) ||
        (t.teaching_area || '').toLowerCase().includes(q);
    });

  const tabs: { value: TutorFilter; label: string; count: number }[] = [
    { value: 'ALL', label: 'Tất cả', count: allTutors.length },
    { value: 'PENDING_REVIEW', label: 'Chờ duyệt', count: pendingCount },
    { value: 'VERIFIED', label: 'Đã duyệt', count: verifiedCount },
    { value: 'REJECTED', label: 'Từ chối', count: rejectedCount },
  ];

  return (
    <PortalPage title="Quản lý gia sư" description={`${allTutors.length} gia sư, ${pendingCount} chờ duyệt.`}>
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={UserCheckIcon} label="Tổng gia sư" value={allTutors.length} hint="Toàn bộ hệ thống." tone="neutral" />
        <MetricTile icon={ShieldCheckIcon} label="Chờ duyệt" value={pendingCount} hint="Cần xử lý." tone={pendingCount > 0 ? 'warning' : 'success'} />
        <MetricTile icon={BookOpenIcon} label="Đã xác minh" value={verifiedCount} hint="Sẵn sàng nhận lớp." tone="success" />
        <MetricTile icon={CalendarIcon} label="Từ chối" value={rejectedCount} hint="Không đạt yêu cầu." tone={rejectedCount > 0 ? 'warning' : 'neutral'} />
      </div>

      <SectionPanel title="Danh sách gia sư" description="Dùng nút xem chi tiết để mở modal duyệt hồ sơ.">
        {/* Tabs + Search */}
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <div className="flex bg-surface-secondary p-1 rounded-xl w-fit">
            {tabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setFilter(tab.value)}
                className={`px-3 py-1.5 text-sm font-bold rounded-lg transition-all ${
                  filter === tab.value ? 'bg-white text-primary-700 shadow-sm' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {tab.label} ({tab.count})
              </button>
            ))}
          </div>
          <div className="relative max-w-xs">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <input
              type="text"
              placeholder="Tìm gia sư..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-border bg-white focus:border-primary-300 focus:ring-1 focus:ring-primary-200 outline-none transition-all"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState title="Không tìm thấy" description={search ? 'Thử từ khóa khác.' : 'Không có gia sư nào ở trạng thái này.'} />
        ) : (
          <div className="divide-y divide-border-light">
            {filtered.map((tutor) => {
              const isUpdate = tutor.subjects.some(s => s.status === 'APPROVED');
              const isPending = tutor.verification_status === 'PENDING_REVIEW';
              return (
                <div
                  key={tutor.id}
                  className="w-full flex items-center justify-between gap-3 py-3 px-1 text-left transition-colors hover:bg-surface-secondary rounded-lg -mx-1"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-text-primary text-sm font-bold text-white">
                      {tutor.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-text-primary">{tutor.full_name}</p>
                        {isPending && (
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${isUpdate ? 'border border-primary-100 bg-primary-50 text-primary-700' : 'border border-success-100 bg-success-50 text-success-700'}`}>
                            {isUpdate ? '🔄 Cập nhật' : '✨ Mới'}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-text-tertiary">
                        {tutor.years_experience} năm KN · {tutor.teaching_mode === 'ONLINE' ? 'Online' : tutor.teaching_mode === 'OFFLINE' ? 'Trực tiếp' : 'Linh hoạt'}
                        {tutor.subjects.length > 0 && ` · ${tutor.subjects.map(s => s.subject_name || `#${s.subject_id}`).slice(0, 3).join(', ')}`}
                        {tutor.subjects.length > 3 && ` +${tutor.subjects.length - 3}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {getStatusBadge(tutor.verification_status)}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedTutor(tutor)}>
                      Xem chi tiết
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SectionPanel>

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

export function TutorDetailModal({ tutor, onClose, onUpdated, toast }: { tutor: TutorPublicResponse; onClose: () => void; onUpdated: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [detail, setDetail] = useState<TutorDetailResponse | null>(null);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetResult, setResetResult] = useState<{ name: string; password: string } | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ type: 'toggle' | 'reset'; label: string; desc: string; danger?: boolean } | null>(null);

  useEffect(() => {
    staffApi.getTutorDetail(tutor.id).then(setDetail).catch(() => toast('error', 'Lỗi tải chi tiết hồ sơ'));
  }, [tutor.id, toast]);

  const handleReview = async (action: 'VERIFIED' | 'REJECTED') => {
    setLoading(true);
    try {
      await staffApi.reviewTutor(tutor.id, { action, review_note: note || undefined });
      toast('success', action === 'VERIFIED' ? 'Đã duyệt hồ sơ tổng thể!' : 'Đã từ chối hồ sơ tổng thể.');
      onUpdated();
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err as { response?: { data?: { detail?: string } } }).response?.data?.detail
        : undefined;
      toast('error', message || 'Thao tác thất bại');
    } finally { setLoading(false); }
  };

  const handleReviewSubject = async (subId: number, action: 'APPROVED' | 'REJECTED') => {
    try {
      await staffApi.reviewSubject(subId, { action, review_note: note || undefined });
      toast('success', `Đã ${action === 'APPROVED' ? 'duyệt' : 'từ chối'} môn dạy`);
      staffApi.getTutorDetail(tutor.id).then(setDetail);
    } catch { toast('error', 'Thất bại'); }
  };

  const handleReviewQualification = async (qId: number, action: 'APPROVED' | 'REJECTED') => {
    try {
      await staffApi.reviewQualification(qId, { action, review_note: note || undefined });
      toast('success', `Đã ${action === 'APPROVED' ? 'duyệt' : 'từ chối'} chứng chỉ`);
      staffApi.getTutorDetail(tutor.id).then(setDetail);
    } catch { toast('error', 'Thất bại'); }
  };

  const dayNames = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  const isPending = tutor.verification_status === 'PENDING_REVIEW';

  const executeConfirmAction = async () => {
    if (!confirmAction || !detail) return;
    setLoading(true);
    try {
      if (confirmAction.type === 'toggle') {
        const accountId = detail.profile.account_id;
        const isSuspending = (detail.profile.verification_status as string) !== 'SUSPENDED';
        await staffApi.updateAccountStatus(accountId, isSuspending ? 'SUSPENDED' : 'ACTIVE');
        toast('success', `Đã ${isSuspending ? 'đình chỉ' : 'kích hoạt lại'} gia sư ${tutor.full_name}`);
        onUpdated();
      } else {
        const result = await staffApi.resetPassword(detail.profile.account_id);
        setResetResult({ name: tutor.full_name, password: result.temp_password });
        toast('success', `Đã cấp lại mật khẩu cho ${tutor.full_name}`);
      }
    } catch {
      toast('error', 'Thao tác thất bại');
    } finally {
      setLoading(false);
      setConfirmAction(null);
    }
  };

  const askToggle = () => {
    if (!detail) return;
    const isSuspending = (detail.profile.verification_status as string) !== 'SUSPENDED';
    setConfirmAction({
      type: 'toggle',
      label: isSuspending ? 'Đình chỉ gia sư' : 'Kích hoạt lại',
      desc: isSuspending
        ? `Gia sư "${tutor.full_name}" sẽ không thể đăng nhập sau khi bị đình chỉ.`
        : `Mở khóa để gia sư "${tutor.full_name}" có thể đăng nhập lại.`,
      danger: isSuspending,
    });
  };

  const askReset = () => {
    setConfirmAction({
      type: 'reset',
      label: 'Cấp lại mật khẩu',
      desc: `Mật khẩu cũ của "${tutor.full_name}" sẽ bị hủy và thay bằng mật khẩu tạm mới.`,
    });
  };

  return (
    <Modal
      open={true}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <span>Hồ sơ: {tutor.full_name}</span>
          {getStatusBadge(tutor.verification_status)}
        </div>
      }
      size="lg"
      footer={isPending ? (
        <>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          <Button variant="danger" loading={loading} onClick={() => handleReview('REJECTED')}>✕ Từ chối</Button>
          <Button loading={loading} onClick={() => handleReview('VERIFIED')}>✓ Duyệt</Button>
        </>
      ) : (
        <>
          <Button variant="outline" onClick={onClose}>Đóng</Button>
          {detail && (
            <>
              <Button variant="outline" loading={loading} onClick={askReset}>🔑 Cấp MK</Button>
              <Button
                variant={detail.profile.verification_status === 'VERIFIED' ? 'danger' : 'primary'}
                loading={loading}
                onClick={askToggle}
              >
                {detail.profile.verification_status === 'VERIFIED' ? '🚫 Đình chỉ' : '✅ Kích hoạt lại'}
              </Button>
            </>
          )}
        </>
      )}
    >
      {!detail ? (
        <div className="py-12 flex justify-center"><Spinner /></div>
      ) : (
        <div className="space-y-5">
          {/* Bio */}
          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-1">Giới thiệu</h4>
            <p className="text-sm bg-surface-tertiary p-3 rounded-lg border border-border-light">{detail.profile.bio || 'Chưa có giới thiệu'}</p>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm bg-surface-secondary p-3 rounded-lg">
            <div><span className="text-text-tertiary">Trình độ:</span> <span className="font-medium">{detail.profile.qualification_level || '—'}</span></div>
            <div><span className="text-text-tertiary">Kinh nghiệm:</span> <span className="font-medium">{detail.profile.years_experience} năm</span></div>
            <div><span className="text-text-tertiary">Hình thức:</span> <span className="font-medium">{detail.profile.teaching_mode}</span></div>
            <div><span className="text-text-tertiary">Khu vực:</span> <span className="font-medium">{detail.profile.teaching_area || '—'}</span></div>
          </div>

          {/* Qualifications — compact */}
          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-2">Chứng chỉ ({detail.qualifications.length})</h4>
            {detail.qualifications.length === 0 && <p className="text-sm text-text-tertiary italic">Chưa tải lên chứng chỉ nào.</p>}
            <div className="space-y-2">
              {detail.qualifications.map((q) => (
                <div key={q.id} className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${q.status === 'PENDING' ? 'bg-warning-50/30 border-warning-200' : 'bg-surface-secondary border-border-light'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-text-primary truncate">{q.title}</span>
                      {getStatusBadge(q.status)}
                    </div>
                    <p className="text-xs text-text-secondary mt-0.5">{q.type} {q.issuer && `· ${q.issuer}`}</p>
                    <DocumentLink fileUrl={q.file_url}>Xem tài liệu</DocumentLink>
                  </div>
                  {q.status === 'PENDING' && isPending && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" className="text-xs py-1" onClick={() => handleReviewQualification(q.id, 'APPROVED')}>✓</Button>
                      <Button variant="outline" size="sm" className="text-xs py-1 text-danger-600 hover:bg-danger-50 hover:border-danger-200" onClick={() => handleReviewQualification(q.id, 'REJECTED')}>✕</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Subjects — compact */}
          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-2">Môn dạy ({detail.subjects.length})</h4>
            {detail.subjects.length === 0 && <p className="text-sm text-text-tertiary italic">Chưa đăng ký môn dạy nào.</p>}
            <div className="space-y-2">
              {detail.subjects.map((s) => (
                <div key={s.id} className={`flex items-center justify-between gap-3 p-2.5 rounded-lg border ${s.status === 'PENDING' ? 'bg-warning-50/30 border-warning-200' : 'bg-surface-secondary border-border-light'}`}>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{s.subject_name || `#${s.subject_id}`}</span>
                      {getStatusBadge(s.status)}
                    </div>
                    <span className="text-xs text-text-secondary">{s.grade_level} · {parseFloat(s.fee_per_session).toLocaleString('vi-VN')}đ/buổi</span>
                  </div>
                  {s.status === 'PENDING' && isPending && (
                    <div className="flex gap-1.5 shrink-0">
                      <Button variant="outline" size="sm" className="text-xs" onClick={() => handleReviewSubject(s.id, 'APPROVED')}>✓</Button>
                      <Button variant="outline" size="sm" className="text-xs text-danger-600 hover:bg-danger-50 hover:border-danger-200" onClick={() => handleReviewSubject(s.id, 'REJECTED')}>✕</Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Availability — inline */}
          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-2">Lịch rảnh ({detail.availabilities.length})</h4>
            {detail.availabilities.length === 0 ? (
              <p className="text-sm text-text-tertiary italic">Chưa cập nhật lịch rảnh.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {detail.availabilities.map((a) => (
                  <span key={a.id} className="text-xs bg-surface-tertiary text-text-secondary border border-border-light px-2 py-1 rounded-md">
                    {dayNames[a.day_of_week]} {a.start_time?.slice(0, 5)}–{a.end_time?.slice(0, 5)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Note */}
          {isPending && (
            <div className="pt-2 border-t border-border-light">
              <Input
                label="Ghi chú (tuỳ chọn)"
                placeholder="Nhập lý do nếu từ chối..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          )}
        </div>
      )}

      {/* Confirm modal */}
      {confirmAction && (
        <Modal
          open={true}
          onClose={() => setConfirmAction(null)}
          title={confirmAction.label}
          size="sm"
          footer={(
            <>
              <Button variant="outline" onClick={() => setConfirmAction(null)}>Hủy</Button>
              <Button variant={confirmAction.danger ? 'danger' : 'primary'} loading={loading} onClick={executeConfirmAction}>
                {confirmAction.label}
              </Button>
            </>
          )}
        >
          <p className="text-sm leading-6 text-text-secondary">{confirmAction.desc}</p>
        </Modal>
      )}

      {/* Password result */}
      {resetResult && (
        <Modal
          open={true}
          onClose={() => setResetResult(null)}
          title="Mật khẩu tạm"
          size="sm"
          footer={<Button onClick={() => setResetResult(null)}>Đã ghi nhận</Button>}
        >
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">Mật khẩu tạm cho <strong>{resetResult.name}</strong>:</p>
            <div className="bg-surface-tertiary border border-border-light rounded-lg p-4 text-center">
              <code className="text-2xl font-bold text-primary-700 tracking-widest select-all">{resetResult.password}</code>
            </div>
            <p className="bg-warning-50 border border-warning-200 rounded-lg p-3 text-xs text-warning-800">
              Mật khẩu này chỉ hiện một lần. Gia sư nên đổi mật khẩu sau khi đăng nhập.
            </p>
          </div>
        </Modal>
      )}
    </Modal>
  );
}
