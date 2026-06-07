import { useEffect, useMemo, useState } from 'react';
import { paymentApi } from '../../services/api';
import type { PaymentResponse, PaymentStatus } from '../../types';
import { getStatusBadge } from '../../components/ui/Badge';
import { PageLoading } from '../../components/ui/Spinner';
import { WalletIcon, ClipboardCheckIcon, UserCheckIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel } from '../../components/portal/PortalPage';

function currency(value: string | number | null | undefined) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export default function StaffPayments() {
  const [payments, setPayments] = useState<PaymentResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'ALL' | PaymentStatus>('ALL');

  useEffect(() => {
    paymentApi.list().then(setPayments).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const filteredPayments = useMemo(() => {
    if (filter === 'ALL') return payments;
    return payments.filter((payment) => payment.status === filter);
  }, [payments, filter]);

  const stats = useMemo(() => ({
    totalRevenue: payments.filter((payment) => payment.status === 'SUCCEEDED').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    totalPending: payments.filter((payment) => payment.status === 'PENDING' || payment.status === 'CREATED').reduce((sum, payment) => sum + Number(payment.amount || 0), 0),
    totalRefunded: payments.filter((payment) => payment.status === 'REFUNDED').reduce((sum, payment) => sum + Number(payment.refund_amount || 0), 0),
    queue: payments.filter((payment) => ['CREATED', 'PENDING', 'REFUND_PENDING'].includes(payment.status)).length,
  }), [payments]);

  if (loading) return <PageLoading />;

  return (
    <PortalPage title="Tài chính" description="Theo dõi thanh toán theo hàng chờ xử lý, doanh thu ghi nhận và hoàn tiền.">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={WalletIcon} label="Doanh thu" value={currency(stats.totalRevenue)} hint="Từ giao dịch thành công." tone="success" />
        <MetricTile icon={ClipboardCheckIcon} label="Chờ thanh toán" value={currency(stats.totalPending)} hint="CREATED hoặc PENDING." tone="warning" />
        <MetricTile icon={WalletIcon} label="Đã hoàn tiền" value={currency(stats.totalRefunded)} hint="Tổng refund đã ghi nhận." tone="neutral" />
        <MetricTile icon={UserCheckIcon} label="Hàng chờ" value={stats.queue} hint="Cần staff kiểm tra." />
      </div>

      <SectionPanel
        title="Giao dịch"
        description="Danh sách vẫn giữ đủ thông tin nghiệp vụ, nhưng bộ lọc và metric giúp đọc nhanh hơn."
        action={(
          <div className="flex gap-1 rounded-lg border border-border-light bg-surface-secondary p-1">
            {(['ALL', 'PENDING', 'SUCCEEDED', 'REFUNDED'] as const).map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFilter(item)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold ${filter === item ? 'bg-white text-text-primary shadow-xs' : 'text-text-secondary hover:bg-white/70'}`}
              >
                {item === 'ALL' ? 'Tất cả' : item === 'PENDING' ? 'Chờ' : item === 'SUCCEEDED' ? 'Thành công' : 'Hoàn tiền'}
              </button>
            ))}
          </div>
        )}
      >
        {filteredPayments.length === 0 ? (
          <EmptyPanel title="Không có giao dịch phù hợp" />
        ) : (
          <div className="space-y-3">
            {filteredPayments.map((payment) => (
              <article key={payment.id} className="rounded-lg border border-border-light bg-white p-4">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-lg font-semibold text-text-primary">{currency(payment.amount)}</h3>
                      {getStatusBadge(payment.status)}
                    </div>
                    <p className="mt-1 text-sm font-medium text-text-secondary">
                      {payment.subject_name ? `${payment.subject_name} · ` : ''}{payment.tutor_name || 'Hệ thống'}
                    </p>
                    <p className="mt-1 text-sm text-text-tertiary">
                      HV #{payment.student_account_id} · {payment.target_type === 'PRIVATE_TUTORING_REQUEST' ? 'Yêu cầu 1-1' : 'Đăng ký lớp'} · {payment.target_name || `#${payment.target_id}`}
                    </p>
                    {payment.paid_at && <p className="mt-1 text-xs text-text-tertiary">Thanh toán: {new Date(payment.paid_at).toLocaleString('vi-VN')}</p>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionPanel>
    </PortalPage>
  );
}
