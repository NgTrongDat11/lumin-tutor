import { useCallback, useEffect, useMemo, useState } from 'react';
import { paymentApi } from '../../services/api';
import type { PaymentResponse, PaymentStatus } from '../../types';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { CheckCircleIcon, ClockIcon } from '../ui/Icons';
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
  const { toast } = useToast();

  const isSucceeded = status === 'SUCCEEDED';

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
  }, [open, payment]);

  // Poll every 5s
  useEffect(() => {
    if (!open || !payment || isSucceeded) return;
    const id = window.setInterval(() => {
      refreshStatus().catch(() => {});
    }, 5000);
    return () => window.clearInterval(id);
  }, [isSucceeded, open, payment, refreshStatus]);

  // Countdown
  useEffect(() => {
    if (!open || !expiresAtMs) {
      setRemainingSeconds(0);
      return;
    }
    const update = () => setRemainingSeconds(Math.max(Math.ceil((expiresAtMs - Date.now()) / 1000), 0));
    update();
    const id = window.setInterval(update, 1000);
    return () => window.clearInterval(id);
  }, [expiresAtMs, open]);

  if (!payment) return null;

  const displayAmount = payment.display_amount || Number(payment.amount);

  return (
    <Modal open={open} onClose={onClose} title="" size="sm" footer={null}>
      {isSucceeded ? (
        /* ── Success ── */
        <div className="flex flex-col items-center gap-5 py-8 text-center">
          <div className="w-20 h-20 rounded-full bg-success-50 flex items-center justify-center animate-[scaleIn_0.3s_ease]">
            <CheckCircleIcon className="w-10 h-10 text-success-600" />
          </div>
          <div>
            <p className="text-xl font-bold text-text-primary">Thanh toán thành công!</p>
            <p className="text-sm text-text-secondary mt-2">Học phí <span className="font-bold text-primary-700">{currency(displayAmount)}</span> đã được ghi nhận.</p>
          </div>
          <Button onClick={onClose} className="mt-2 px-8">Hoàn tất</Button>
        </div>
      ) : (
        /* ── QR Scan ── */
        <div className="flex flex-col items-center gap-5 py-2">
          {/* Heading */}
          <div className="text-center">
            <p className="text-lg font-bold text-text-primary">Quét mã để thanh toán</p>
            <p className="text-2xl font-extrabold text-primary-700 mt-1">{currency(displayAmount)}</p>
            {payment.is_test_mode && (
              <p className="text-xs text-warning-600 mt-1 font-medium">
                Test: chuyển {currency(payment.qr_amount)} thay vì {currency(displayAmount)}
              </p>
            )}
          </div>

          {/* QR */}
          <div className="w-60 h-60 rounded-2xl border-2 border-primary-100 bg-white p-1.5 shadow-sm">
            {payment.qr_data_url ? (
              <img
                src={payment.qr_data_url}
                alt="Mã QR thanh toán"
                className="h-full w-full object-contain rounded-xl"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-text-tertiary">
                Đang tải mã QR...
              </div>
            )}
          </div>

          {/* Timer */}
          {expiresAtMs && (
            <div className="flex items-center gap-2 text-sm text-text-tertiary">
              <ClockIcon className="h-4 w-4" />
              <span>Hết hạn sau {formatRemaining(remainingSeconds)}</span>
            </div>
          )}

          {/* Instruction */}
          <p className="text-xs text-text-tertiary text-center leading-relaxed max-w-[240px]">
            Mở app ngân hàng → Quét mã → Bấm chuyển.<br />
            Hệ thống tự xác nhận sau vài giây.
          </p>

          {/* Manual check button */}
          <button
            type="button"
            onClick={() => refreshStatus()}
            className="text-xs font-semibold text-primary-600 hover:text-primary-700 hover:underline transition-colors"
          >
            Đã chuyển? Kiểm tra ngay
          </button>
        </div>
      )}
    </Modal>
  );
}
