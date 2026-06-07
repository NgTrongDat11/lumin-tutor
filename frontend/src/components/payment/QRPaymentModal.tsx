import { useCallback, useEffect, useMemo, useState } from 'react';
import { paymentApi } from '../../services/api';
import type { PaymentResponse, PaymentStatus } from '../../types';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CheckCircleIcon, ClipboardCheckIcon, ClockIcon, WalletIcon } from '../ui/Icons';
import { useToast } from '../ui/Toast';

interface QRPaymentModalProps {
  open: boolean;
  payment: PaymentResponse | null;
  onClose: () => void;
  onPaid: () => void;
}

function currency(value: number | string | null | undefined) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

function formatRemaining(seconds: number) {
  if (seconds <= 0) return 'Hết hạn';
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0');
  const rest = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${minutes}:${rest}`;
}

export default function QRPaymentModal({ open, payment, onClose, onPaid }: QRPaymentModalProps) {
  const [status, setStatus] = useState<PaymentStatus | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const [copied, setCopied] = useState<string | null>(null);
  const { toast } = useToast();

  const isSucceeded = status === 'SUCCEEDED';
  const bankInfo = payment?.bank_info;

  const expiresAtMs = useMemo(() => {
    if (!payment?.expires_at) return null;
    const parsed = new Date(payment.expires_at).getTime();
    return Number.isNaN(parsed) ? null : parsed;
  }, [payment?.expires_at]);

  const refreshStatus = useCallback(async () => {
    if (!payment) return;
    const next = await paymentApi.checkStatus(payment.id);
    setStatus(next.status);
    if (next.status === 'SUCCEEDED') {
      onPaid();
    }
  }, [onPaid, payment]);

  useEffect(() => {
    if (!open || !payment) return;
    setStatus(payment.status);
    setCopied(null);
  }, [open, payment]);

  useEffect(() => {
    if (!open || !payment || isSucceeded) return;
    const id = window.setInterval(() => {
      refreshStatus().catch(() => {
        toast('warning', 'Chưa cập nhật được trạng thái thanh toán.');
      });
    }, 5000);
    return () => window.clearInterval(id);
  }, [isSucceeded, open, payment, refreshStatus, toast]);

  useEffect(() => {
    if (!open || !expiresAtMs) {
      setRemainingSeconds(0);
      return;
    }

    const updateRemaining = () => {
      setRemainingSeconds(Math.max(Math.ceil((expiresAtMs - Date.now()) / 1000), 0));
    };

    updateRemaining();
    const id = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(id);
  }, [expiresAtMs, open]);

  const copyText = async (label: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined || value === '') return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopied(label);
      toast('success', 'Đã sao chép.');
    } catch {
      toast('error', 'Không sao chép được nội dung.');
    }
  };

  if (!payment) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thanh toán chuyển khoản"
      size="lg"
      footer={(
        <>
          <Button variant="outline" onClick={() => refreshStatus()} icon={<ClockIcon className="h-4 w-4" />}>
            Kiểm tra
          </Button>
          <Button variant={isSucceeded ? 'secondary' : 'primary'} onClick={onClose}>
            {isSucceeded ? 'Đóng' : 'Đã hiểu'}
          </Button>
        </>
      )}
    >
      <div className="space-y-5">
        {payment.is_test_mode && (
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-4 py-3 text-sm text-warning-700">
            <p className="font-semibold">CHẾ ĐỘ TEST</p>
            <p>
              Số tiền chuyển thực tế là {currency(payment.qr_amount)}. Giá gốc{' '}
              {currency(payment.display_amount || payment.amount)}
              {payment.amount_divisor && payment.amount_divisor > 1 ? ` chia ${payment.amount_divisor}` : ''}.
            </p>
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-[240px_1fr]">
          <div className="flex flex-col items-center gap-3">
            <div className="aspect-square w-full max-w-[240px] overflow-hidden rounded-lg border border-border-light bg-white p-2">
              {payment.qr_data_url ? (
                <img src={payment.qr_data_url} alt="QR thanh toán VietQR" className="h-full w-full object-contain" />
              ) : (
                <div className="flex h-full items-center justify-center text-center text-sm text-text-tertiary">
                  Chưa có mã QR
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-surface-secondary px-3 py-2 text-sm text-text-secondary">
              {isSucceeded ? <CheckCircleIcon className="h-4 w-4 text-success-600" /> : <ClockIcon className="h-4 w-4" />}
              <span>{isSucceeded ? 'Đã thanh toán' : `Còn ${formatRemaining(remainingSeconds)}`}</span>
            </div>
          </div>

          <div className="space-y-3">
            <InfoRow label="Ngân hàng" value={bankInfo?.bank_name || 'TPBank'} />
            <InfoRow
              label="Số tài khoản"
              value={bankInfo?.account_number}
              onCopy={() => copyText('account_number', bankInfo?.account_number)}
              copied={copied === 'account_number'}
            />
            <InfoRow label="Chủ tài khoản" value={bankInfo?.account_name} />
            <InfoRow
              label="Số tiền chuyển"
              value={currency(payment.qr_amount || bankInfo?.amount)}
              onCopy={() => copyText('amount', payment.qr_amount || bankInfo?.amount)}
              copied={copied === 'amount'}
              emphasized
            />
            <InfoRow
              label="Nội dung chuyển khoản"
              value={payment.transfer_content || bankInfo?.transfer_content}
              onCopy={() => copyText('transfer_content', payment.transfer_content || bankInfo?.transfer_content)}
              copied={copied === 'transfer_content'}
              emphasized
            />
          </div>
        </div>

        <div className="rounded-lg border border-border-light bg-surface-secondary px-4 py-3">
          <div className="flex items-start gap-3">
            <WalletIcon className="mt-0.5 h-5 w-5 text-text-secondary" />
            <div>
              <p className="text-sm font-semibold text-text-primary">
                Giá trị học phí ghi nhận: {currency(payment.display_amount || payment.amount)}
              </p>
              <p className="mt-1 text-sm text-text-secondary">
                Hệ thống sẽ tự cập nhật khi SePay gửi xác nhận giao dịch đến.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

interface InfoRowProps {
  label: string;
  value: string | number | null | undefined;
  onCopy?: () => void;
  copied?: boolean;
  emphasized?: boolean;
}

function InfoRow({ label, value, onCopy, copied = false, emphasized = false }: InfoRowProps) {
  return (
    <div className="rounded-lg border border-border-light bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase text-text-tertiary">{label}</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className={`${emphasized ? 'text-lg font-bold text-text-primary' : 'text-sm font-semibold text-text-secondary'} break-all`}>
          {value || 'Chưa có'}
        </p>
        {onCopy && (
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
            title={copied ? 'Đã sao chép' : 'Sao chép'}
          >
            <ClipboardCheckIcon className={`h-4 w-4 ${copied ? 'text-success-600' : ''}`} />
          </button>
        )}
      </div>
    </div>
  );
}
