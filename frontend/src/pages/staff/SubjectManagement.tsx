import { useEffect, useState, type FormEvent } from 'react';
import { subjectApi } from '../../services/api';
import type { SubjectResponse } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { getStatusBadge } from '../../components/ui/Badge';
import { CardGridSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';

export default function StaffSubjects() {
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const { toast } = useToast();

  const load = () => { subjectApi.list().then(setSubjects).catch(() => {}).finally(() => setLoading(false)); };
  useEffect(load, []);

  const handleDelete = async (id: number) => {
    if (!confirm('Ẩn môn học này?')) return;
    try { await subjectApi.delete(id); toast('success', 'Đã ẩn môn học'); load(); }
    catch { toast('error', 'Thất bại'); }
  };

  if (loading) return <CardGridSkeleton />;

  return (
    <div className="animate-slide-up">
      <PageHeader title="Quản lý môn học" description="Thêm, sửa và quản lý danh mục môn học." action={<Button onClick={() => setShowAdd(true)}>+ Thêm môn</Button>} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {subjects.map((s) => (
          <Card key={s.id}>
            <div className="flex justify-between items-start">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{s.name}</h3>
                  {getStatusBadge(s.status)}
                </div>
                {s.description && <p className="text-sm text-text-secondary">{s.description}</p>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(s.id)}>🗑️</Button>
            </div>
          </Card>
        ))}
      </div>

      <AddSubjectModal open={showAdd} onClose={() => setShowAdd(false)} onAdded={() => { setShowAdd(false); load(); }} toast={toast} />
    </div>
  );
}

function AddSubjectModal({ open, onClose, onAdded, toast }: { open: boolean; onClose: () => void; onAdded: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try { await subjectApi.create({ name, description: desc || undefined }); toast('success', 'Thêm thành công!'); onAdded(); }
    catch { toast('error', 'Thêm thất bại'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Thêm môn học" footer={<><Button variant="outline" onClick={onClose}>Huỷ</Button><Button loading={loading} onClick={(e) => handleSubmit(e as unknown as FormEvent)}>Thêm</Button></>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Tên môn" placeholder="VD: Toán" value={name} onChange={(e) => setName(e.target.value)} required />
        <Input label="Mô tả" placeholder="Mô tả ngắn..." value={desc} onChange={(e) => setDesc(e.target.value)} />
      </form>
    </Modal>
  );
}
