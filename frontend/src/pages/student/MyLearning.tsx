import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { classApi, privateRequestApi, paymentApi } from '../../services/api';
import type { ClassRegistrationResponse, PrivateRequestResponse, PaymentResponse } from '../../types';
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

type Tab = 'PRIVATE' | 'CLASS';

export default function StudentMyLearning() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const defaultTab = searchParams.get('tab') as Tab || 'PRIVATE';
  const [activeTab, setActiveTab] = useState<Tab>(defaultTab);

  const [requests, setRequests] = useState<PrivateRequestResponse[]>([]);
  const [myClasses, setMyClasses] = useState<ClassRegistrationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [qrPayment, setQrPayment] = useState<PaymentResponse | null>(null);
  const [payLoading, setPayLoading] = useState<string | null>(null); // "PRIVATE_123" or "CLASS_456"
  const { toast } = useToast();

  const loadData = useCallback(() => {
    Promise.all([
      privateRequestApi.list().catch(() => []),
      classApi.myRegistrations().catch(() => []),
    ]).then(([reqs, regs]) => {
      setRequests(reqs);
      setMyClasses(regs);
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
              <p className="text-sm font-bold text-text-primary flex items-center gap-2">
                <span className="w-4 text-center text-primary-500">💰</span>
                {toCurrency(request.agreed_fee_per_session)} <span className="font-normal text-xs text-text-tertiary">/ buổi</span>
              </p>
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

          {/* Button */}
          {isConfirmed ? (
            <Button 
              className="w-full justify-center shadow-sm" 
              onClick={onPayNow}
              disabled={payLoading}
            >
              {payLoading ? 'Đang tải...' : 'Thanh toán ngay để bắt đầu'}
            </Button>
          ) : isPaid ? (
            <Button 
              variant="outline"
              className="w-full justify-center border-primary-200 text-primary-700 bg-primary-50 hover:bg-primary-100 transition-colors" 
              onClick={() => onAction('/student/schedule')}
            >
              Xem lịch học
            </Button>
          ) : (
            <Button 
              variant="outline"
              className="w-full justify-center bg-surface-secondary text-text-tertiary border-border-light cursor-not-allowed"
              disabled
            >
              {isRejected ? 'Yêu cầu bị từ chối' : 'Đang chờ gia sư duyệt'}
            </Button>
          )}
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
            <div className="pt-2 mt-2 border-t border-border-light/50">
               <p className="text-base font-bold text-primary-700">
                 {toCurrency(reg.fee_per_session_per_student)} <span className="text-xs text-text-tertiary font-normal">/ buổi</span>
               </p>
            </div>
          )}
          {reg.review_note && (
            <div className="mt-3 bg-white/60 p-3 rounded-lg border border-border-light border-dashed">
              <p className="text-xs font-bold text-text-secondary mb-1">Nhận xét từ Staff:</p>
              <p className="text-sm italic text-text-primary">"{reg.review_note}"</p>
            </div>
          )}
        </div>

        {isApproved ? (
          <Button 
            className="w-full justify-center shadow-sm" 
            onClick={onPayNow}
            disabled={payLoading}
          >
            {payLoading ? 'Đang tải...' : 'Thanh toán ngay để bắt đầu'}
          </Button>
        ) : isPaid ? (
          <Button 
            variant="outline"
            className="w-full justify-center border-primary-200 text-primary-700 hover:bg-primary-50 shadow-sm transition-all" 
            onClick={() => onAction('/student/schedule')}
          >
            Vào lịch học
          </Button>
        ) : (
          <Button 
            variant="outline"
            className="w-full justify-center bg-surface-secondary text-text-tertiary border-border-light cursor-not-allowed"
            disabled
          >
            {isPending ? 'Đang chờ duyệt đăng ký' : isRejected ? 'Đăng ký bị từ chối' : 'Trạng thái khác'}
          </Button>
        )}
      </div>
    </article>
  );
}
