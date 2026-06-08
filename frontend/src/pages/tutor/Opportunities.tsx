import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { classApi, extractErrorMessage, messageApi, privateRequestApi } from '../../services/api';
import type { CourseClassResponse, PrivateRequestResponse } from '../../types';
import Avatar from '../../components/ui/Avatar';
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

const statusLabels: Record<string, string> = {
  SENT: 'Đã gửi',
  TUTOR_CONFIRMED: 'Đã xác nhận',
  TUTOR_REJECTED: 'Đã từ chối',
  PAID: 'Đã thanh toán',
  ONGOING: 'Đang học',
  COMPLETED: 'Hoàn tất',
};

export default function TutorOpportunities({ initialTab = 'requests' }: { initialTab?: OpportunityTab }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<OpportunityTab>(initialTab);
  const [requests, setRequests] = useState<PrivateRequestResponse[]>([]);
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmRequest, setConfirmRequest] = useState<PrivateRequestResponse | null>(null);
  const [applying, setApplying] = useState<number | null>(null);
  const [profileRequestId, setProfileRequestId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => {
    Promise.all([
      privateRequestApi.list().catch(() => []),
      classApi.list({ for_tutor: true }).catch(() => []),
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
        <MetricTile icon={LayersIcon} label="Lớp đang tuyển" value={recruitingClasses.length} hint="Lớp phù hợp với môn bạn dạy." tone="warning" />
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
        <SectionPanel title="Yêu cầu 1-1 cần phản hồi" description="Bấm vào tên học viên để xem hồ sơ chi tiết trước khi quyết định.">
          {pendingRequests.length === 0 ? (
            <EmptyPanel title="Không có yêu cầu mới" description="Yêu cầu mới từ học viên sẽ xuất hiện tại đây." />
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((request) => (
                <article key={request.id} className="rounded-lg border border-border-light bg-white p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setProfileRequestId(request.id)}
                          className="font-semibold text-primary-700 hover:text-primary-800 hover:underline transition-colors"
                        >
                          {request.student_name || `Học viên #${request.student_account_id}`}
                        </button>
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
                      <Button size="sm" onClick={() => setConfirmRequest(request)}>Xác nhận</Button>
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
        <SectionPanel title="Lớp nhóm phù hợp với bạn" description="Chỉ hiển thị lớp có môn học trùng với môn bạn đã đăng ký dạy.">
          {recruitingClasses.length === 0 ? (
            <EmptyPanel title="Chưa có lớp phù hợp" description="Khi có lớp nhóm cần gia sư ở môn bạn dạy, lớp sẽ xuất hiện ở đây." />
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
                        <button
                          type="button"
                          onClick={() => setProfileRequestId(request.id)}
                          className="font-semibold text-primary-700 hover:text-primary-800 hover:underline transition-colors"
                        >
                          {request.student_name || `Học viên #${request.student_account_id}`}
                        </button>
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

      <ConfirmRequestModal request={confirmRequest} onClose={() => setConfirmRequest(null)} onConfirmed={() => { setConfirmRequest(null); load(); }} toast={toast} />
      <StudentProfileModal requestId={profileRequestId} onClose={() => setProfileRequestId(null)} />
    </PortalPage>
  );
}

/* ── Confirm Request Modal ───────────────────── */

function ConfirmRequestModal({ request, onClose, onConfirmed, toast }: { request: PrivateRequestResponse | null; onClose: () => void; onConfirmed: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const defaultTitle = request
    ? `1-1 ${request.subject_name || 'Môn học'} - ${request.grade_level}`
    : '';
  const [classTitle, setClassTitle] = useState(defaultTitle);
  const [sessions, setSessions] = useState(String(request?.requested_sessions || 10));
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const sessionCount = Math.max(Number(sessions || 0), 0);
  const feeNumber = Math.max(Number(fee || 0), 0);
  const totalAmount = sessionCount * feeNumber;

  useEffect(() => {
    if (!request) return;
    setClassTitle(`1-1 ${request.subject_name || 'Môn học'} - ${request.grade_level}`);
    setSessions(String(request.requested_sessions || 1));
    setFee(request.agreed_fee_per_session || '');
    setNote(request.tutor_response_note || '');
  }, [request]);

  const handleConfirm = async () => {
    if (!request || !feeNumber || !sessionCount || !classTitle.trim()) {
      toast('error', 'Vui lòng chốt tên, số buổi và học phí hợp lệ');
      return;
    }
    setSaving(true);
    try {
      await privateRequestApi.confirm(request.id, {
        agreed_fee_per_session: fee,
        agreed_sessions: sessionCount,
        class_title: classTitle.trim(),
        response_note: note || undefined,
      });
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
      open={!!request}
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
        <div className="rounded-lg border border-primary-100 bg-primary-50 p-3 text-sm leading-6 text-primary-800">
          Sau khi xác nhận, hệ thống sẽ tạo lớp 1-1 nội bộ và tạo khoản thanh toán theo đúng thông tin đã chốt bên dưới.
        </div>
        <Input label="Tên lớp/buổi 1-1" placeholder="VD: 1-1 IELTS - Band 6.5" value={classTitle} onChange={(event) => setClassTitle(event.target.value)} required />
        <div className="grid gap-3 sm:grid-cols-2">
          <Input label="Số buổi đã chốt" type="number" min="1" value={sessions} onChange={(event) => setSessions(event.target.value)} required />
        <Input label="Học phí thỏa thuận (VNĐ/buổi)" type="number" placeholder="200000" value={fee} onChange={(event) => setFee(event.target.value)} required />
        </div>
        <Input label="Ghi chú cho học viên" placeholder="VD: Có thể bắt đầu từ tuần sau" value={note} onChange={(event) => setNote(event.target.value)} />
        <div className="rounded-lg border border-warning-100 bg-warning-50 p-3 text-sm leading-6 text-warning-800">
          Tổng thanh toán sẽ là <strong>{currency(totalAmount)}</strong> = {sessionCount || 0} buổi x {currency(feeNumber)}/buổi.
        </div>
      </div>
    </Modal>
  );
}

/* ── Student Profile Modal ───────────────────── */

interface StudentProfile {
  student_id: number;
  full_name: string;
  avatar_url: string | null;
  email: string;
  phone: string | null;
  birth_year: number | null;
  address: string | null;
  created_at: string | null;
  total_contracts: number;
  request_history: {
    id: number;
    subject_name: string;
    grade_level: string;
    goal: string | null;
    requested_sessions: number;
    status: string;
    mode: string;
    created_at: string | null;
  }[];
}

function StudentProfileModal({ requestId, onClose }: { requestId: number | null; onClose: () => void }) {
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!requestId) {
      setProfile(null);
      setError('');
      return;
    }
    setLoading(true);
    setError('');
    privateRequestApi.studentProfile(requestId)
      .then((data) => setProfile(data))
      .catch((err) => setError(extractErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [requestId]);

  return (
    <Modal
      open={!!requestId}
      onClose={onClose}
      title="Hồ sơ học viên"
      size="lg"
    >
      {loading ? (
        <div className="space-y-4 animate-pulse">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full bg-surface-secondary" />
            <div className="space-y-2 flex-1">
              <div className="h-5 w-40 rounded bg-surface-secondary" />
              <div className="h-3 w-60 rounded bg-surface-secondary" />
            </div>
          </div>
          <div className="h-20 rounded-lg bg-surface-secondary" />
          <div className="h-32 rounded-lg bg-surface-secondary" />
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger-100 bg-danger-50 p-4 text-sm text-danger-600">{error}</div>
      ) : profile ? (
        <div className="space-y-5">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Avatar name={profile.full_name} src={profile.avatar_url || undefined} size="lg" shape="circle" />
            <div>
              <h3 className="text-lg font-bold text-text-primary">{profile.full_name}</h3>
              <p className="text-sm text-text-secondary">{profile.email}</p>
              {profile.phone && <p className="text-sm text-text-secondary">📞 {profile.phone}</p>}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border-light bg-surface-secondary p-3 text-center">
              <p className="text-2xl font-bold text-primary-700">{profile.total_contracts}</p>
              <p className="text-xs font-medium text-text-tertiary">Hợp đồng</p>
            </div>
            <div className="rounded-lg border border-border-light bg-surface-secondary p-3 text-center">
              <p className="text-2xl font-bold text-primary-700">{profile.request_history.length}</p>
              <p className="text-xs font-medium text-text-tertiary">Yêu cầu</p>
            </div>
            <div className="rounded-lg border border-border-light bg-surface-secondary p-3 text-center">
              <p className="text-2xl font-bold text-primary-700">{profile.birth_year || '—'}</p>
              <p className="text-xs font-medium text-text-tertiary">Năm sinh</p>
            </div>
          </div>

          {profile.address && (
            <div className="rounded-lg border border-border-light bg-surface-secondary p-3">
              <p className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary mb-1">Địa chỉ</p>
              <p className="text-sm text-text-secondary">{profile.address}</p>
            </div>
          )}

          {/* Member since */}
          {profile.created_at && (
            <p className="text-xs text-text-tertiary">
              Tham gia từ {new Date(profile.created_at).toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          )}

          {/* Request history */}
          <div>
            <h4 className="text-sm font-bold text-text-primary mb-3">Lịch sử yêu cầu học</h4>
            {profile.request_history.length === 0 ? (
              <p className="text-sm text-text-tertiary">Chưa có lịch sử.</p>
            ) : (
              <div className="space-y-2 max-h-[240px] overflow-y-auto">
                {profile.request_history.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border-light bg-white p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-primary-200 bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">
                          {item.subject_name}
                        </span>
                        <span className="text-xs text-text-secondary">{item.grade_level}</span>
                        <span className="text-xs text-text-secondary">· {item.requested_sessions} buổi</span>
                      </div>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.status === 'PAID' || item.status === 'COMPLETED' ? 'bg-success-50 text-success-700' :
                        item.status === 'TUTOR_REJECTED' ? 'bg-danger-50 text-danger-600' :
                        'bg-surface-secondary text-text-secondary'
                      }`}>
                        {statusLabels[item.status] || item.status}
                      </span>
                    </div>
                    {item.goal && (
                      <p className="mt-1.5 text-xs leading-5 text-text-tertiary line-clamp-2">{item.goal}</p>
                    )}
                    {item.created_at && (
                      <p className="mt-1 text-[10px] text-text-tertiary">
                        {new Date(item.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
