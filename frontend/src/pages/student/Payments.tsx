import { useCallback, useEffect, useMemo, useState } from 'react';
import { paymentApi, classApi } from '../../services/api';
import type { PaymentResponse, ClassRegistrationResponse } from '../../types';
import { getStatusBadge } from '../../components/ui/Badge';
import Button from '../../components/ui/Button';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import ConfirmDialog from '../../components/ui/ConfirmDialog';
import { WalletIcon, ClipboardCheckIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel } from '../../components/portal/PortalPage';
import QRPaymentModal from '../../components/payment/QRPaymentModal';
import { LearningDetailModal } from '../../components/learning/LearningDetailModal';

export default function StudentPayments() {
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [registrations, setRegistrations] = useState<ClassRegistrationResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [paying, setPaying] = useState<number | null>(null);
  const [confirmPayId, setConfirmPayId] = useState<number | null>(null);
  const [qrPayment, setQrPayment] = useState<PaymentResponse | null>(null);
  const [cancelling, setCancelling] = useState<number | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<number | null>(null);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'SUCCEEDED'>('ALL');
  const [detailTarget, setDetailTarget] = useState<{ type: 'CLASS' | 'PRIVATE', id: number } | null>(null);
  const { toast } = useToast();

  const load = useCallback(() => {
    Promise.all([
      paymentApi.list().catch(() => []),
      classApi.myRegistrations().catch(() => [])
    ]).then(([payList, regList]) => {
      setPayments(payList);
      setRegistrations(regList);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openPaymentFlow = (payment: PaymentResponse) => {
    if (payment.provider?.toUpperCase() === 'SEPAY') {
      setQrPayment(payment);
      return;
    }
    setConfirmPayId(payment.id);
  };

  const handlePay = async (id: number) => {
    setPaying(id);
    try {
      await paymentApi.pay(id);
      toast('success', 'Thanh toán thành công!');
      load();
    } catch {
      toast('error', 'Thanh toán thất bại');
    } finally {
      setPaying(null);
      setConfirmPayId(null);
    }
  };

  const handleQrPaid = useCallback(() => {
    toast('success', 'Thanh toán thành công!');
    setQrPayment(null);
    load();
  }, [load, toast]);

  const handleCancel = async (id: number) => {
    setCancelling(id);
    try {
      await paymentApi.cancel(id);
      toast('success', 'Đã hủy giao dịch thành công!');
      load();
    } catch {
      toast('error', 'Hủy giao dịch thất bại');
    } finally {
      setCancelling(null);
      setConfirmCancelId(null);
    }
  };

  const filteredPayments = useMemo(() => {
    if (filter === 'ALL') return payments;
    if (filter === 'PENDING') {
      return payments.filter((p) => p.status === 'PENDING' || p.status === 'CREATED');
    }
    return payments.filter((p) => p.status === filter);
  }, [payments, filter]);

  const stats = useMemo(() => {
    return {
      totalPaid: payments.filter(p => p.status === 'SUCCEEDED').reduce((sum, p) => sum + parseFloat(p.amount), 0),
      totalPending: payments.filter(p => p.status === 'PENDING' || p.status === 'CREATED').reduce((sum, p) => sum + parseFloat(p.amount), 0)
    };
  }, [payments]);

  const getModalTarget = useCallback((payment: PaymentResponse): { type: 'CLASS' | 'PRIVATE', id: number } | null => {
    if (payment.target_type === 'PRIVATE_TUTORING_REQUEST') {
      return { type: 'PRIVATE', id: payment.target_id };
    }
    if (payment.target_type === 'CLASS_REGISTRATION') {
      const reg = registrations.find(r => r.id === payment.target_id);
      if (reg) {
        return { type: 'CLASS', id: reg.class_id };
      }
    }
    return null;
  }, [registrations]);

  const formatCurrency = (amount: number) => `${amount.toLocaleString('vi-VN')}đ`;

  if (loading) return <PageLoading />;

  return (
    <PortalPage 
      title="Lịch sử thanh toán" 
      description="Theo dõi các giao dịch thanh toán của bạn."
    >
      {/* Stats */}
      {payments.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          <MetricTile 
            icon={WalletIcon} 
            label="Đã thanh toán" 
            value={formatCurrency(stats.totalPaid)} 
            tone="success" 
          />
          <MetricTile 
            icon={ClipboardCheckIcon} 
            label="Chờ thanh toán" 
            value={formatCurrency(stats.totalPending)} 
            tone="warning" 
          />
        </div>
      )}

      {payments.length > 0 && (
        <SectionPanel
          title="Giao dịch"
          description={`${filteredPayments.length} giao dịch.`}
          action={
            <div className="flex gap-1 rounded-lg border border-border-light bg-surface-secondary p-1">
              {(['ALL', 'PENDING', 'SUCCEEDED'] as const).map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${
                    filter === f ? 'bg-white text-text-primary shadow-xs' : 'text-text-secondary hover:bg-white/70'
                  }`}
                >
                  {f === 'ALL' ? 'Tất cả' : f === 'PENDING' ? 'Chờ thanh toán' : 'Đã thanh toán'}
                </button>
              ))}
            </div>
          }
        >
          {filteredPayments.length === 0 ? (
            <EmptyPanel title="Không có giao dịch phù hợp" />
          ) : (
            <div className="space-y-3">
              {filteredPayments.map((p) => {
                const target = getModalTarget(p);
                return (
                  <article key={p.id} className="rounded-xl border border-border-light bg-white p-5 transition-all duration-200 hover:border-primary-300 hover:shadow-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                          <h3 className="text-xl font-extrabold text-text-primary">
                            {parseFloat(p.amount).toLocaleString('vi-VN')}đ
                          </h3>
                          {getStatusBadge(p.status)}
                        </div>
                        <p className="text-base font-bold text-text-secondary">
                          {p.subject_name ? `${p.subject_name} — ` : ''}{p.tutor_name || 'Hệ thống'}
                        </p>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-text-tertiary">
                          <span className="font-semibold px-2 py-0.5 rounded-full bg-surface-secondary text-xs">
                            {p.target_type === 'PRIVATE_TUTORING_REQUEST' ? '🤝 Yêu cầu 1-1' : '👥 Đăng ký lớp'}
                          </span>
                          <span>·</span>
                          <span className="font-medium text-text-secondary">{p.target_name || `#${p.target_id}`}</span>
                        </div>
                        {p.paid_at && (
                          <p className="text-xs text-text-tertiary flex items-center gap-1 mt-1">
                            <span>📅 Thanh toán:</span>
                            <span className="font-medium">{new Date(p.paid_at).toLocaleString('vi-VN')}</span>
                          </p>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {target && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => setDetailTarget(target)}
                            className="border-border-light text-text-secondary hover:bg-surface-secondary"
                          >
                            Xem chi tiết
                          </Button>
                        )}
                        {(p.status === 'CREATED' || p.status === 'PENDING') && (
                          <>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              onClick={() => setConfirmCancelId(p.id)} 
                              className="text-danger-600 hover:bg-danger-50"
                            >
                              Hủy
                            </Button>
                            <Button 
                              size="sm" 
                              onClick={() => openPaymentFlow(p)}
                              className="shadow-sm"
                            >
                              {p.provider?.toUpperCase() === 'SEPAY' ? 'Quét QR' : 'Thanh toán'}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </SectionPanel>
      )}

      {payments.length === 0 && (
        <EmptyPanel title="Chưa có giao dịch nào" description="Bạn chưa có lịch sử thanh toán nào." />
      )}

      <ConfirmDialog
        open={confirmPayId !== null}
        onClose={() => setConfirmPayId(null)}
        onConfirm={() => confirmPayId && handlePay(confirmPayId)}
        title="Xác nhận thanh toán"
        description={`Bạn sắp thanh toán ${confirmPayId ? parseFloat(payments.find(p => p.id === confirmPayId)?.amount || '0').toLocaleString('vi-VN') : 0}đ. Bạn có chắc chắn muốn tiếp tục?`}
        confirmText="Thanh toán"
        loading={paying === confirmPayId}
      />

      <QRPaymentModal
        open={qrPayment !== null}
        payment={qrPayment}
        onClose={() => setQrPayment(null)}
        onPaid={handleQrPaid}
      />

      <ConfirmDialog
        open={confirmCancelId !== null}
        onClose={() => setConfirmCancelId(null)}
        onConfirm={() => confirmCancelId && handleCancel(confirmCancelId)}
        title="Xác nhận hủy giao dịch"
        description="Bạn có chắc chắn muốn hủy giao dịch này không? Thao tác này không thể hoàn tác."
        confirmText="Hủy giao dịch"
        loading={cancelling === confirmCancelId}
      />

      <LearningDetailModal
        target={detailTarget}
        onClose={() => setDetailTarget(null)}
      />
    </PortalPage>
  );
}
