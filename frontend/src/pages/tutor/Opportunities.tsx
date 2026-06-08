import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classApi, extractErrorMessage, messageApi, privateRequestApi } from '../../services/api';
import type { CourseClassResponse, PrivateRequestResponse } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { getStatusBadge } from '../../components/ui/Badge';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { ClipboardCheckIcon, LayersIcon, UsersIcon, WalletIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel, SegmentedTabs } from '../../components/portal/PortalPage';

type OpportunityTab = 'requests' | 'classes' | 'history';

function currency(value: string | number | null | undefined) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export default function TutorOpportunities({ initialTab = 'requests' }: { initialTab?: OpportunityTab }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<OpportunityTab>(initialTab);
  const [requests, setRequests] = useState<PrivateRequestResponse[]>([]);
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => {
    Promise.all([
      privateRequestApi.list().catch(() => []),
      classApi.list().catch(() => []),
    ]).then(([requestList, classList]) => {
      setRequests(requestList);
      setClasses(classList);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleReject = async (id: number) => {
    if (!confirm('Từ chối yêu cầu này?')) return;
    try {
      await privateRequestApi.reject(id);
      toast('success', 'Đã từ chối yêu cầu');
      load();
    } catch {
      toast('error', 'Thao tác thất bại');
    }
  };

  const handleApply = async (classId: number) => {
    setApplying(classId);
    try {
      await classApi.apply(classId, { message: 'Tôi muốn ứng tuyển dạy lớp này.' });
      toast('success', 'Đã gửi ứng tuyển');
    } catch {
      toast('error', 'Ứng tuyển thất bại hoặc bạn đã ứng tuyển trước đó');
    } finally {
      setApplying(null);
    }
  };

  const handleOpenRequestThread = async (request: PrivateRequestResponse) => {
    try {
      const thread = await messageApi.ensureThread({
        private_request_id: request.id,
        title: `Yêu cầu 1-1${request.student_name ? ` - ${request.student_name}` : ''}`,
      });
      navigate(`/tutor/messages?threadId=${thread.id}`);
    } catch (err) {
      toast('error', extractErrorMessage(err));
    }
  };

  const pendingRequests = useMemo(() => requests.filter((request) => request.status === 'SENT'), [requests]);
  const activeRequests = useMemo(() => requests.filter((request) => ['TUTOR_CONFIRMED', 'PAID', 'ONGOING'].includes(request.status)), [requests]);
  const historyRequests = useMemo(() => requests.filter((request) => request.status !== 'SENT'), [requests]);
  const recruitingClasses = useMemo(() => classes.filter((course) => course.status === 'TUTOR_RECRUITING'), [classes]);

  if (loading) return <DashboardSkeleton />;

  return (
    <PortalPage
      title="Cơ hội dạy"
      description="Gộp yêu cầu 1-1 và lớp đang tuyển vào cùng một nơi, vì đây đều là luồng nhận việc mới của gia sư."
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={UsersIcon} label="Yêu cầu mới" value={pendingRequests.length} hint="Cần phản hồi sớm để giữ học viên." />
        <MetricTile icon={LayersIcon} label="Lớp đang tuyển" value={recruitingClasses.length} hint="Có thể ứng tuyển nếu phù hợp." tone="warning" />
        <MetricTile icon={ClipboardCheckIcon} label="Đang xử lý" value={activeRequests.length} hint="Đã xác nhận hoặc đang vận hành." tone="success" />
        <MetricTile icon={WalletIcon} label="Lịch sử" value={historyRequests.length} hint="Theo dõi trạng thái các yêu cầu cũ." tone="neutral" />
      </div>

      <SegmentedTabs
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'requests', label: 'Yêu cầu 1-1', count: pendingRequests.length },
          { value: 'classes', label: 'Lớp đang tuyển', count: recruitingClasses.length },
          { value: 'history', label: 'Đã xử lý', count: historyRequests.length },
        ]}
      />

      {activeTab === 'requests' && (
        <SectionPanel title="Yêu cầu 1-1 cần phản hồi" description="Gia sư chỉ cần quyết định nhận hay từ chối, không phải đi tìm ở màn riêng.">
          {pendingRequests.length === 0 ? (
            <EmptyPanel title="Không có yêu cầu mới" description="Yêu cầu mới từ học viên sẽ xuất hiện tại đây." />
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <article key={request.id} className="rounded-lg border border-border-light bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-text-primary">
                          {request.student_name || `Học viên #${request.student_account_id}`}
                        </h3>
                        {getStatusBadge(request.status)}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {request.subject_name && (
                          <span className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-1 text-xs font-bold text-primary-700">
                            {request.subject_name}
                          </span>
                        )}
                        <span className="rounded-full border border-border-light bg-surface-secondary px-2.5 py-1 text-xs font-semibold text-text-secondary">
                          {request.grade_level}
                        </span>
                        <span className="rounded-full border border-border-light bg-surface-secondary px-2.5 py-1 text-xs font-semibold text-text-secondary">
                          {request.requested_sessions} buổi
                        </span>
                        <span className="rounded-full border border-border-light bg-surface-secondary px-2.5 py-1 text-xs font-semibold text-text-secondary">
                          {request.mode === 'ONLINE' ? '🌐 Trực tuyến' : '📍 Trực tiếp'}
                        </span>
                      </div>
                      {request.goal && (
                        <div className="mt-3 rounded-lg border border-border-light bg-surface-secondary p-3">
                          <p className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary mb-1">Mục tiêu học tập</p>
                          <p className="text-sm leading-6 text-text-secondary">{request.goal}</p>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 lg:shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleOpenRequestThread(request)}>Trao đổi</Button>
                      <Button size="sm" onClick={() => setConfirmId(request.id)}>Xác nhận</Button>
                      <Button size="sm" variant="outline" className="text-danger-600 hover:bg-danger-50" onClick={() => handleReject(request.id)}>Từ chối</Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionPanel>
      )}

      {activeTab === 'classes' && (
        <SectionPanel title="Lớp nhóm đang tuyển gia sư" description="Các lớp này cần gia sư chính trước khi mở hoặc tiếp tục tuyển học viên.">
          {recruitingClasses.length === 0 ? (
            <EmptyPanel title="Chưa có lớp đang tuyển" description="Khi nhân viên mở tuyển gia sư cho lớp nhóm, lớp sẽ xuất hiện ở đây." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {recruitingClasses.map((course) => (
                <article key={course.id} className="rounded-lg border border-border-light bg-surface-secondary p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-text-primary">{course.title}</h3>
                        {getStatusBadge(course.status)}
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">
                        {course.grade_level} · {course.total_sessions} buổi · {currency(course.fee_per_session_per_student)}/HV
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {course.mode === 'ONLINE' ? 'Trực tuyến' : course.location || 'Trực tiếp'} · {course.min_students}-{course.max_students} học viên
                      </p>
                    </div>
                  </div>
                  {course.goal && <p className="mt-4 line-clamp-3 text-sm leading-6 text-text-secondary">{course.goal}</p>}
                  <Button className="mt-4 w-full" size="sm" loading={applying === course.id} onClick={() => handleApply(course.id)}>
                    Ứng tuyển lớp này
                  </Button>
                </article>
              ))}
            </div>
          )}
        </SectionPanel>
      )}

      {activeTab === 'history' && (
        <SectionPanel title="Yêu cầu đã xử lý" description="Lưu lại các yêu cầu đã xác nhận, đang học, hoàn tất hoặc đã từ chối.">
          {historyRequests.length === 0 ? (
            <EmptyPanel title="Chưa có lịch sử xử lý" />
          ) : (
            <div className="space-y-3">
              {historyRequests.map((request) => (
                <article key={request.id} className="rounded-lg border border-border-light bg-white p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-text-primary">
                          {request.student_name || `Học viên #${request.student_account_id}`}
                        </h3>
                        {request.subject_name && (
                          <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                            {request.subject_name}
                          </span>
                        )}
                        {getStatusBadge(request.status)}
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">
                        {request.requested_sessions} buổi{request.agreed_fee_per_session ? ` · ${currency(request.agreed_fee_per_session)}/buổi` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-text-tertiary">{request.confirmed_at ? new Date(request.confirmed_at).toLocaleDateString('vi-VN') : 'Chưa xác nhận'}</p>
                      <Button size="sm" variant="outline" onClick={() => handleOpenRequestThread(request)}>Trao đổi</Button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionPanel>
      )}

      <ConfirmRequestModal requestId={confirmId} onClose={() => setConfirmId(null)} onConfirmed={() => { setConfirmId(null); load(); }} toast={toast} />
    </PortalPage>
  );
}

function ConfirmRequestModal({ requestId, onClose, onConfirmed, toast }: { requestId: number | null; onClose: () => void; onConfirmed: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConfirm = async () => {
    if (!requestId || !fee) return;
    setSaving(true);
    try {
      await privateRequestApi.confirm(requestId, { agreed_fee_per_session: fee, response_note: note || undefined });
      toast('success', 'Đã xác nhận yêu cầu');
      onConfirmed();
    } catch {
      toast('error', 'Xác nhận thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={!!requestId}
      onClose={onClose}
      title="Xác nhận yêu cầu 1-1"
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button loading={saving} onClick={handleConfirm}>Xác nhận</Button>
        </>
      )}
    >
      <div className="space-y-4">
        <Input label="Học phí thỏa thuận (VNĐ/buổi)" type="number" placeholder="200000" value={fee} onChange={(event) => setFee(event.target.value)} required />
        <Input label="Ghi chú cho học viên" placeholder="VD: Có thể bắt đầu từ tuần sau" value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="rounded-lg border border-warning-100 bg-warning-50 p-3 text-sm leading-6 text-warning-800">
          Đây là học phí mỗi buổi. Khoản thanh toán ban đầu sẽ bằng mức này nhân với số buổi học viên yêu cầu.
        </div>
      </div>
    </Modal>
  );
}
