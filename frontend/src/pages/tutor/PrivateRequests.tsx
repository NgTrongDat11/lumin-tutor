import { useEffect, useState } from 'react';
import { privateRequestApi } from '../../services/api';
import type { PrivateRequestResponse } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { getStatusBadge } from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { CardGridSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

export default function TutorPrivateRequests() {
  const [requests, setRequests] = useState<PrivateRequestResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => { privateRequestApi.list().then(setRequests).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleReject = async (id: number) => {
    if (!confirm('Từ chối yêu cầu này?')) return;
    try { await privateRequestApi.reject(id); toast('success', 'Đã từ chối'); load(); }
    catch { toast('error', 'Thao tác thất bại'); }
  };

  if (loading) return <CardGridSkeleton />;

  const pending = requests.filter((r) => r.status === 'SENT');
  const others = requests.filter((r) => r.status !== 'SENT');

  return (
    <div className="animate-slide-up">
      <PageHeader title="Yêu cầu dạy kèm 1-1" description="Quản lý các yêu cầu dạy kèm từ học viên." />

      {requests.length === 0 ? (
        <EmptyState title="Chưa có yêu cầu nào" />
      ) : (
        <div className="space-y-6">
          {pending.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">📩 Chờ xử lý ({pending.length})</h2>
              <div className="space-y-3">
                {pending.map((req) => (
                  <Card key={req.id}>
                    <div className="flex flex-col sm:flex-row justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold">Yêu cầu #{req.id}</h3>
                          {getStatusBadge(req.status)}
                        </div>
                        <p className="text-sm text-text-secondary">{req.requested_sessions} buổi • {req.mode === 'ONLINE' ? '🌐 Trực tuyến' : '📍 Trực tiếp'}</p>
                        {req.goal && <p className="text-sm text-text-tertiary mt-1">🎯 {req.goal}</p>}
                      </div>
                      <div className="flex gap-2 items-start">
                        <Button size="sm" onClick={() => setConfirmId(req.id)}>✓ Xác nhận</Button>
                        <Button size="sm" variant="danger" onClick={() => handleReject(req.id)}>✕ Từ chối</Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {others.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold mb-3">Lịch sử</h2>
              <div className="space-y-3">
                {others.map((req) => (
                  <Card key={req.id}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2"><h3 className="font-semibold text-sm">#{req.id}</h3>{getStatusBadge(req.status)}</div>
                        <p className="text-xs text-text-tertiary">{req.requested_sessions} buổi{req.agreed_fee_per_session && ` • ${parseFloat(req.agreed_fee_per_session).toLocaleString('vi-VN')}đ/buổi`}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal requestId={confirmId} onClose={() => setConfirmId(null)} onConfirmed={() => { setConfirmId(null); load(); }} toast={toast} />
    </div>
  );
}

function ConfirmModal({ requestId, onClose, onConfirmed, toast }: { requestId: number | null; onClose: () => void; onConfirmed: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [fee, setFee] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleConfirm = async () => {
    if (!requestId || !fee) return;
    setLoading(true);
    try {
      await privateRequestApi.confirm(requestId, { agreed_fee_per_session: fee, response_note: note || undefined });
      toast('success', 'Đã xác nhận yêu cầu!');
      onConfirmed();
    } catch { toast('error', 'Xác nhận thất bại'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={!!requestId} onClose={onClose} title="Xác nhận yêu cầu" footer={<><Button variant="outline" onClick={onClose}>Huỷ</Button><Button loading={loading} onClick={handleConfirm}>Xác nhận</Button></>}>
      <div className="space-y-4">
        <Input label="Học phí thỏa thuận (VNĐ/buổi)" type="number" placeholder="200000" value={fee} onChange={(e) => setFee(e.target.value)} required />
        <Input label="Ghi chú (tuỳ chọn)" placeholder="VD: Sẽ bắt đầu tuần sau" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
    </Modal>
  );
}
