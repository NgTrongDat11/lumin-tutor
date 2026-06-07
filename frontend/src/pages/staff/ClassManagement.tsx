import { useEffect, useState, type FormEvent } from 'react';
import { classApi, subjectApi } from '../../services/api';
import type { CourseClassResponse, SubjectResponse, TutorApplicationResponse, ClassRegistrationResponse } from '../../types';
import PageHeader from '../../components/ui/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import Modal from '../../components/ui/Modal';
import { getStatusBadge } from '../../components/ui/Badge';
import EmptyState from '../../components/ui/EmptyState';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';

export default function StaffClassManagement() {
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const { toast } = useToast();

  const load = () => {
    Promise.all([classApi.list(), subjectApi.list()]).then(([c, s]) => { setClasses(c); setSubjects(s); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(load, []);

  const handleStatusChange = async (id: number, status: string) => {
    try {
      await classApi.updateStatus(id, { status: status as CourseClassResponse['status'] });
      toast('success', 'Cập nhật trạng thái thành công');
      load();
    } catch { toast('error', 'Cập nhật thất bại'); }
  };

  if (loading) return <PageLoading />;

  return (
    <div className="animate-slide-up">
      <PageHeader title="Quản lý lớp nhóm" description="Tạo, quản lý trạng thái và duyệt lớp nhóm." action={<Button onClick={() => setShowCreate(true)}>+ Tạo lớp mới</Button>} />

      {classes.length === 0 ? (
        <EmptyState title="Chưa có lớp nhóm" action={<Button onClick={() => setShowCreate(true)}>+ Tạo lớp</Button>} />
      ) : (
        <div className="space-y-3">
          {classes.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{c.title}</h3>
                    {getStatusBadge(c.status)}
                  </div>
                  <p className="text-sm text-text-secondary">
                    {c.grade_level} • {c.total_sessions} buổi • {parseFloat(c.fee_per_session_per_student).toLocaleString('vi-VN')}đ/buổi
                    • {c.min_students}–{c.max_students} HV
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-start">
                  {c.status === 'DRAFT' && <Button size="sm" variant="secondary" onClick={() => handleStatusChange(c.id, 'TUTOR_RECRUITING')}>Mở tuyển GS</Button>}
                  {c.status === 'TUTOR_RECRUITING' && <Button size="sm" variant="secondary" onClick={() => handleStatusChange(c.id, 'ENROLLING')}>Mở đăng ký HV</Button>}
                  {c.status === 'ENROLLING' && <Button size="sm" variant="secondary" onClick={() => handleStatusChange(c.id, 'READY')}>Sẵn sàng</Button>}
                  {c.status === 'READY' && <Button size="sm" variant="primary" onClick={() => handleStatusChange(c.id, 'ONGOING')}>Bắt đầu</Button>}
                  <Button size="sm" variant="ghost" onClick={() => setDetailId(c.id)}>Chi tiết</Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <CreateClassModal open={showCreate} onClose={() => setShowCreate(false)} subjects={subjects} onCreated={() => { setShowCreate(false); load(); }} toast={toast} />
      {detailId && <ClassDetailModal classId={detailId} onClose={() => setDetailId(null)} toast={toast} />}
    </div>
  );
}

function CreateClassModal({ open, onClose, subjects, onCreated, toast }: { open: boolean; onClose: () => void; subjects: SubjectResponse[]; onCreated: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [form, setForm] = useState({ subject_id: 0, title: '', grade_level: '', goal: '', fee_per_session_per_student: '', total_sessions: 10, min_students: 3, max_students: 15, mode: 'OFFLINE', location: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await classApi.create({ ...form, goal: form.goal || undefined, location: form.location || undefined });
      toast('success', 'Tạo lớp thành công!');
      onCreated();
    } catch { toast('error', 'Tạo lớp thất bại'); }
    finally { setLoading(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Tạo lớp nhóm mới" size="lg" footer={<><Button variant="outline" onClick={onClose}>Huỷ</Button><Button loading={loading} onClick={(e) => handleSubmit(e as unknown as FormEvent)}>Tạo</Button></>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Tên lớp" placeholder="VD: Luyện thi Toán 12" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Môn học" options={subjects.map((s) => ({ value: String(s.id), label: s.name }))} placeholder="Chọn môn" value={String(form.subject_id || '')} onChange={(e) => setForm((f) => ({ ...f, subject_id: Number(e.target.value) }))} />
          <Input label="Cấp lớp" placeholder="Lớp 12" value={form.grade_level} onChange={(e) => setForm((f) => ({ ...f, grade_level: e.target.value }))} required />
        </div>
        <Textarea label="Mục tiêu" placeholder="Mô tả mục tiêu lớp học..." value={form.goal} onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))} />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Học phí (VNĐ/buổi/SV)" type="number" value={form.fee_per_session_per_student} onChange={(e) => setForm((f) => ({ ...f, fee_per_session_per_student: e.target.value }))} required />
          <Input label="Tổng buổi" type="number" value={form.total_sessions} onChange={(e) => setForm((f) => ({ ...f, total_sessions: Number(e.target.value) }))} />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input label="Tối thiểu HV" type="number" value={form.min_students} onChange={(e) => setForm((f) => ({ ...f, min_students: Number(e.target.value) }))} />
          <Input label="Tối đa HV" type="number" value={form.max_students} onChange={(e) => setForm((f) => ({ ...f, max_students: Number(e.target.value) }))} />
          <Select label="Hình thức" options={[{ value: 'OFFLINE', label: 'Trực tiếp' }, { value: 'ONLINE', label: 'Trực tuyến' }]} value={form.mode} onChange={(e) => setForm((f) => ({ ...f, mode: e.target.value }))} />
        </div>
        <Input label="Địa điểm" placeholder="VD: 123 Nguyễn Văn A, Q.1" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} />
      </form>
    </Modal>
  );
}

function ClassDetailModal({ classId, onClose, toast }: { classId: number; onClose: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [apps, setApps] = useState<TutorApplicationResponse[]>([]);
  const [regs, setRegs] = useState<ClassRegistrationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      classApi.getApplications(classId).catch(() => []),
      classApi.getRegistrations(classId).catch(() => []),
    ]).then(([a, r]) => { setApps(a); setRegs(r); setLoading(false); });
  }, [classId]);

  const handleAcceptApp = async (appId: number) => {
    try { await classApi.acceptApplication(classId, appId); toast('success', 'Đã chọn gia sư!'); onClose(); }
    catch { toast('error', 'Thất bại'); }
  };

  const handleReviewReg = async (regId: number, action: 'APPROVED' | 'REJECTED') => {
    try { await classApi.reviewRegistration(classId, regId, { action }); toast('success', 'Đã cập nhật!'); onClose(); }
    catch { toast('error', 'Thất bại'); }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Chi tiết lớp #${classId}`} size="lg" footer={<Button variant="outline" onClick={onClose}>Đóng</Button>}>
      {loading ? <p className="text-sm text-text-tertiary">Đang tải...</p> : (
        <div className="space-y-5">
          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-2">Ứng tuyển gia sư ({apps.length})</h4>
            {apps.length === 0 ? <p className="text-xs text-text-tertiary">Chưa có</p> : apps.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-1.5 border-b border-border-light last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">GS #{a.tutor_id}</span>
                  {getStatusBadge(a.status)}
                </div>
                {a.status === 'APPLIED' && <Button size="sm" onClick={() => handleAcceptApp(a.id)}>Chọn</Button>}
              </div>
            ))}
          </div>
          <div>
            <h4 className="text-sm font-medium text-text-secondary mb-2">Đăng ký học viên ({regs.length})</h4>
            {regs.length === 0 ? <p className="text-xs text-text-tertiary">Chưa có</p> : regs.map((r) => (
              <div key={r.id} className="flex items-center justify-between py-1.5 border-b border-border-light last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm">HV #{r.student_account_id}</span>
                  {getStatusBadge(r.status)}
                </div>
                {r.status === 'PENDING' && (
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => handleReviewReg(r.id, 'APPROVED')}>Duyệt</Button>
                    <Button size="sm" variant="danger" onClick={() => handleReviewReg(r.id, 'REJECTED')}>Từ chối</Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
