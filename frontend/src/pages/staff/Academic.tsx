import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { classApi, subjectApi } from '../../services/api';
import type { ClassRegistrationResponse, CourseClassResponse, SubjectResponse, TutorApplicationResponse } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import { getStatusBadge } from '../../components/ui/Badge';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { BookOpenIcon, ClipboardCheckIcon, LayersIcon, UsersIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel, SegmentedTabs } from '../../components/portal/PortalPage';

type AcademicTab = 'classes' | 'subjects';

function currency(value: string | number | null | undefined) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

/* ── Next action helper ──────────────────────────── */

const nextStepMap: Record<string, { label: string; next: CourseClassResponse['status'] } | null> = {
  DRAFT: { label: 'Mở tuyển GS', next: 'TUTOR_RECRUITING' },
  TUTOR_RECRUITING: { label: 'Mở đăng ký HV', next: 'ENROLLING' },
  ENROLLING: { label: 'Sẵn sàng', next: 'READY' },
  READY: { label: 'Bắt đầu lớp', next: 'ONGOING' },
};

/* ── Main ────────────────────────────────────────── */

export default function StaffAcademic({ initialTab = 'classes' }: { initialTab?: AcademicTab }) {
  const [activeTab, setActiveTab] = useState<AcademicTab>(initialTab);
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateClass, setShowCreateClass] = useState(false);
  const [showCreateSubject, setShowCreateSubject] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [confirmHide, setConfirmHide] = useState<SubjectResponse | null>(null);
  const { toast } = useToast();

  const load = () => {
    Promise.all([
      classApi.list().catch(() => []),
      subjectApi.list().catch(() => []),
    ]).then(([classList, subjectList]) => {
      setClasses(classList);
      setSubjects(subjectList);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleClassStatus = async (id: number, status: CourseClassResponse['status']) => {
    try {
      await classApi.updateStatus(id, { status });
      toast('success', 'Đã cập nhật trạng thái lớp');
      load();
    } catch {
      toast('error', 'Cập nhật thất bại');
    }
  };

  const handleDeleteSubject = async () => {
    if (!confirmHide) return;
    try {
      await subjectApi.delete(confirmHide.id);
      toast('success', 'Đã ẩn môn học');
      load();
    } catch {
      toast('error', 'Thao tác thất bại');
    } finally {
      setConfirmHide(null);
    }
  };

  const classStats = useMemo(() => ({
    draft: classes.filter((c) => c.status === 'DRAFT').length,
    recruiting: classes.filter((c) => c.status === 'TUTOR_RECRUITING').length,
    enrolling: classes.filter((c) => c.status === 'ENROLLING').length,
    active: classes.filter((c) => ['READY', 'ONGOING'].includes(c.status)).length,
  }), [classes]);

  if (loading) return <DashboardSkeleton />;

  return (
    <PortalPage
      title="Học vụ"
      description="Quản lý lớp học và danh mục môn."
      actions={activeTab === 'classes'
        ? <Button onClick={() => setShowCreateClass(true)}>+ Tạo lớp</Button>
        : <Button onClick={() => setShowCreateSubject(true)}>+ Thêm môn</Button>}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={BookOpenIcon} label="Môn học" value={subjects.length} hint="Danh mục hệ thống." />
        <MetricTile icon={LayersIcon} label="Đang chuẩn bị" value={classStats.draft + classStats.recruiting} hint="Cần mở tuyển hoặc chọn GS." tone="warning" />
        <MetricTile icon={UsersIcon} label="Tuyển học viên" value={classStats.enrolling} hint="Đang mở đăng ký." tone="primary" />
        <MetricTile icon={ClipboardCheckIcon} label="Đang mở" value={classStats.active} hint="Sẵn sàng hoặc đang học." tone="success" />
      </div>

      <SegmentedTabs
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'classes', label: 'Lớp nhóm', count: classes.length },
          { value: 'subjects', label: 'Môn học', count: subjects.length },
        ]}
      />

      {activeTab === 'classes' ? (
        <SectionPanel title="Danh sách lớp" description={`${classes.length} lớp.`}>
          {classes.length === 0 ? (
            <EmptyPanel title="Chưa có lớp" action={<Button onClick={() => setShowCreateClass(true)}>Tạo lớp</Button>} />
          ) : (
            <div className="divide-y divide-border-light">
              {classes.map((course) => {
                const step = nextStepMap[course.status];
                return (
                  <div key={course.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="truncate text-sm font-semibold text-text-primary">{course.title}</h3>
                        {getStatusBadge(course.status)}
                      </div>
                      <p className="mt-0.5 text-xs text-text-tertiary">
                        {course.grade_level} · {course.total_sessions} buổi · {currency(course.fee_per_session_per_student)}/buổi · {course.min_students}-{course.max_students} HV
                        · {course.mode === 'ONLINE' ? 'Trực tuyến' : course.location || 'Trực tiếp'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {step && (
                        <Button size="sm" variant="secondary" onClick={() => handleClassStatus(course.id, step.next)}>
                          {step.label}
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDetailId(course.id)}>Chi tiết</Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </SectionPanel>
      ) : (
        <SectionPanel title="Danh mục môn học" description={`${subjects.length} môn.`}>
          {subjects.length === 0 ? (
            <EmptyPanel title="Chưa có môn học" action={<Button onClick={() => setShowCreateSubject(true)}>Thêm môn</Button>} />
          ) : (
            <div className="divide-y divide-border-light">
              {subjects.map((subject) => (
                <div key={subject.id} className="flex items-center justify-between gap-4 py-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">{subject.name}</h3>
                      {getStatusBadge(subject.status)}
                    </div>
                    {subject.description && <p className="mt-0.5 text-xs text-text-tertiary truncate">{subject.description}</p>}
                  </div>
                  <Button size="sm" variant="ghost" className="text-danger-600 hover:bg-danger-50 shrink-0" onClick={() => setConfirmHide(subject)}>
                    Ẩn
                  </Button>
                </div>
              ))}
            </div>
          )}
        </SectionPanel>
      )}

      <CreateClassModal open={showCreateClass} onClose={() => setShowCreateClass(false)} subjects={subjects} onCreated={() => { setShowCreateClass(false); load(); }} toast={toast} />
      <CreateSubjectModal open={showCreateSubject} onClose={() => setShowCreateSubject(false)} onCreated={() => { setShowCreateSubject(false); load(); }} toast={toast} />
      {detailId && <ClassDetailModal classId={detailId} onClose={() => setDetailId(null)} toast={toast} />}

      {/* Confirm hide subject */}
      {confirmHide && (
        <Modal
          open={true}
          onClose={() => setConfirmHide(null)}
          title="Ẩn môn học"
          size="sm"
          footer={(
            <>
              <Button variant="outline" onClick={() => setConfirmHide(null)}>Hủy</Button>
              <Button variant="danger" onClick={handleDeleteSubject}>Ẩn môn</Button>
            </>
          )}
        >
          <p className="text-sm leading-6 text-text-secondary">Ẩn môn "<strong>{confirmHide.name}</strong>"? Các lớp đang dùng môn này sẽ không bị ảnh hưởng.</p>
        </Modal>
      )}
    </PortalPage>
  );
}

/* ── Create Class Modal ──────────────────────────── */

function CreateClassModal({ open, onClose, subjects, onCreated, toast }: { open: boolean; onClose: () => void; subjects: SubjectResponse[]; onCreated: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [form, setForm] = useState({ subject_id: 0, title: '', grade_level: '', goal: '', fee_per_session_per_student: '', total_sessions: 10, min_students: 3, max_students: 15, mode: 'OFFLINE', location: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await classApi.create({ ...form, goal: form.goal || undefined, location: form.location || undefined });
      toast('success', 'Đã tạo lớp');
      onCreated();
    } catch {
      toast('error', 'Tạo lớp thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Tạo lớp nhóm mới" size="lg" footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button loading={saving} onClick={(event) => handleSubmit(event as unknown as FormEvent)}>Tạo lớp</Button></>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Tên lớp" placeholder="VD: Luyện thi Toán 12" value={form.title} onChange={(event) => setForm((c) => ({ ...c, title: event.target.value }))} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select label="Môn học" options={subjects.map((s) => ({ value: String(s.id), label: s.name }))} placeholder="Chọn môn" value={String(form.subject_id || '')} onChange={(event) => setForm((c) => ({ ...c, subject_id: Number(event.target.value) }))} />
          <Input label="Cấp lớp" placeholder="Lớp 12" value={form.grade_level} onChange={(event) => setForm((c) => ({ ...c, grade_level: event.target.value }))} required />
        </div>
        <Textarea label="Mục tiêu" placeholder="Mô tả mục tiêu lớp học..." value={form.goal} onChange={(event) => setForm((c) => ({ ...c, goal: event.target.value }))} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input label="Học phí (VNĐ/buổi/HV)" type="number" value={form.fee_per_session_per_student} onChange={(event) => setForm((c) => ({ ...c, fee_per_session_per_student: event.target.value }))} required />
          <Input label="Tổng buổi" type="number" value={form.total_sessions} onChange={(event) => setForm((c) => ({ ...c, total_sessions: Number(event.target.value) }))} />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Input label="Tối thiểu HV" type="number" value={form.min_students} onChange={(event) => setForm((c) => ({ ...c, min_students: Number(event.target.value) }))} />
          <Input label="Tối đa HV" type="number" value={form.max_students} onChange={(event) => setForm((c) => ({ ...c, max_students: Number(event.target.value) }))} />
          <Select label="Hình thức" options={[{ value: 'OFFLINE', label: 'Trực tiếp' }, { value: 'ONLINE', label: 'Trực tuyến' }]} value={form.mode} onChange={(event) => setForm((c) => ({ ...c, mode: event.target.value }))} />
        </div>
        <Input label="Địa điểm" placeholder="VD: 123 Nguyễn Văn A, Q.1" value={form.location} onChange={(event) => setForm((c) => ({ ...c, location: event.target.value }))} />
      </form>
    </Modal>
  );
}

/* ── Create Subject Modal ────────────────────────── */

function CreateSubjectModal({ open, onClose, onCreated, toast }: { open: boolean; onClose: () => void; onCreated: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await subjectApi.create({ name, description: description || undefined });
      toast('success', 'Đã thêm môn học');
      onCreated();
    } catch {
      toast('error', 'Thêm môn thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Thêm môn học" footer={<><Button variant="outline" onClick={onClose}>Hủy</Button><Button loading={saving} onClick={(event) => handleSubmit(event as unknown as FormEvent)}>Thêm môn</Button></>}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input label="Tên môn" placeholder="VD: Toán" value={name} onChange={(event) => setName(event.target.value)} required />
        <Input label="Mô tả" placeholder="Mô tả ngắn..." value={description} onChange={(event) => setDescription(event.target.value)} />
      </form>
    </Modal>
  );
}

/* ── Class Detail Modal ──────────────────────────── */

function ClassDetailModal({ classId, onClose, toast }: { classId: number; onClose: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [applications, setApplications] = useState<TutorApplicationResponse[]>([]);
  const [registrations, setRegistrations] = useState<ClassRegistrationResponse[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      classApi.getApplications(classId).catch(() => []),
      classApi.getRegistrations(classId).catch(() => []),
    ]).then(([appList, regList]) => {
      setApplications(appList);
      setRegistrations(regList);
      setLoading(false);
    });
  }, [classId]);

  const handleAcceptApplication = async (appId: number) => {
    try {
      await classApi.acceptApplication(classId, appId);
      toast('success', 'Đã chọn gia sư');
      onClose();
    } catch {
      toast('error', 'Thao tác thất bại');
    }
  };

  const handleReviewRegistration = async (regId: number, action: 'APPROVED' | 'REJECTED') => {
    try {
      await classApi.reviewRegistration(classId, regId, { action });
      toast('success', 'Đã cập nhật đăng ký');
      onClose();
    } catch {
      toast('error', 'Thao tác thất bại');
    }
  };

  return (
    <Modal open={true} onClose={onClose} title={`Chi tiết lớp #${classId}`} size="lg" footer={<Button variant="outline" onClick={onClose}>Đóng</Button>}>
      {loading ? <p className="text-sm text-text-tertiary py-8 text-center">Đang tải...</p> : (
        <div className="space-y-5">
          <div>
            <h4 className="mb-2 text-sm font-semibold text-text-secondary">Ứng tuyển gia sư ({applications.length})</h4>
            {applications.length === 0 ? <p className="text-sm text-text-tertiary">Chưa có ứng tuyển.</p> : (
              <div className="divide-y divide-border-light">
                {applications.map((app) => (
                  <div key={app.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Gia sư #{app.tutor_id}</span>
                      {getStatusBadge(app.status)}
                    </div>
                    {app.status === 'APPLIED' && <Button size="sm" onClick={() => handleAcceptApplication(app.id)}>Chọn</Button>}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div>
            <h4 className="mb-2 text-sm font-semibold text-text-secondary">Đăng ký học viên ({registrations.length})</h4>
            {registrations.length === 0 ? <p className="text-sm text-text-tertiary">Chưa có đăng ký.</p> : (
              <div className="divide-y divide-border-light">
                {registrations.map((reg) => (
                  <div key={reg.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Học viên #{reg.student_account_id}</span>
                      {getStatusBadge(reg.status)}
                    </div>
                    {reg.status === 'PENDING' && (
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => handleReviewRegistration(reg.id, 'APPROVED')}>Duyệt</Button>
                        <Button size="sm" variant="outline" className="text-danger-600 hover:bg-danger-50" onClick={() => handleReviewRegistration(reg.id, 'REJECTED')}>Từ chối</Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
