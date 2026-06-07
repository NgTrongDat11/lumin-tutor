import { useEffect, useState } from 'react';
import { classApi } from '../../services/api';
import type { CourseClassResponse } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { getStatusBadge } from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';

export default function TutorApplications() {
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    classApi.list().then(setClasses).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleApply = async (classId: number) => {
    setApplying(classId);
    try {
      await classApi.apply(classId, { message: 'Tôi muốn ứng tuyển dạy lớp này.' });
      toast('success', 'Ứng tuyển thành công! Chờ staff duyệt.');
    } catch {
      toast('error', 'Ứng tuyển thất bại. Có thể bạn đã ứng tuyển rồi.');
    } finally {
      setApplying(null);
    }
  };

  if (loading) return <PageLoading />;

  const recruiting = classes.filter((c) => c.status === 'TUTOR_RECRUITING');

  return (
    <div className="animate-slide-up">
      <PageHeader title="Ứng tuyển lớp nhóm" description="Xem và ứng tuyển vào các lớp nhóm đang tuyển gia sư." />

      {recruiting.length === 0 ? (
        <EmptyState title="Chưa có lớp nào đang tuyển gia sư" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {recruiting.map((c) => (
            <Card key={c.id}>
              <div className="flex justify-between items-start mb-2">
                <h3 className="font-semibold">{c.title}</h3>
                {getStatusBadge(c.status)}
              </div>
              <p className="text-sm text-text-secondary">{c.grade_level} • {c.total_sessions} buổi • {parseFloat(c.fee_per_session_per_student).toLocaleString('vi-VN')}đ/buổi/SV</p>
              <p className="text-xs text-text-tertiary mt-1">{c.mode === 'ONLINE' ? '🌐 Trực tuyến' : '📍 ' + (c.location || 'Trực tiếp')}</p>
              {c.goal && <p className="text-sm text-text-secondary mt-2">🎯 {c.goal}</p>}
              <Button size="sm" className="mt-4 w-full" loading={applying === c.id} onClick={() => handleApply(c.id)}>📋 Ứng tuyển</Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
