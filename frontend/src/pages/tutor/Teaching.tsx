import { useEffect, useState, type FormEvent } from 'react';
import { classApi, scheduleApi, subjectApi, tutorApi } from '../../services/api';
import type { CourseClassResponse, LearningSessionResponse, SubjectResponse, TutorSubjectResponse } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { getStatusBadge } from '../../components/ui/Badge';
import { PageLoading } from '../../components/ui/Spinner';
import { useToast } from '../../components/ui/Toast';
import { BookOpenIcon, CalendarIcon, LayersIcon, WalletIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel } from '../../components/portal/PortalPage';
import { useAuth } from '../../hooks/useAuth';

function currency(value: string | number | null | undefined) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

export default function TutorTeaching() {
  const { tutorProfile } = useAuth();
  const [subjects, setSubjects] = useState<TutorSubjectResponse[]>([]);
  const [allSubjects, setAllSubjects] = useState<SubjectResponse[]>([]);
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [sessions, setSessions] = useState<LearningSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const { toast } = useToast();

  const load = () => {
    Promise.all([
      tutorApi.getSubjects().catch(() => []),
      subjectApi.list().catch(() => []),
      classApi.list().catch(() => []),
      scheduleApi.listSessions().catch(() => []),
    ]).then(([subjectList, allSubjectList, classList, sessionList]) => {
      setSubjects(subjectList);
      setAllSubjects(allSubjectList);
      setClasses(classList);
      setSessions(sessionList);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleDeleteSubject = async (id: number) => {
    if (!confirm('Xóa môn dạy này?')) return;
    try {
      await tutorApi.deleteSubject(id);
      toast('success', 'Đã xóa môn dạy');
      load();
    } catch {
      toast('error', 'Xóa thất bại');
    }
  };

  const tutorProfileId = tutorProfile?.id;
  const teachingClassIds = new Set(sessions.filter((session) => session.class_id).map((session) => session.class_id as number));
  const ownedClasses = classes.filter((course) => {
    const isPrimaryTutor = Boolean(tutorProfileId && course.primary_tutor_id === tutorProfileId);
    return isPrimaryTutor || teachingClassIds.has(course.id);
  });

  const activeSessions = sessions.filter((session) => session.status === 'SCHEDULED');
  const approvedSubjects = subjects.filter((subject) => subject.status === 'APPROVED');
  const pendingSubjects = subjects.filter((subject) => subject.status === 'PENDING');

  if (loading) return <PageLoading />;

  return (
    <PortalPage
      title="Lớp và môn dạy"
      description="Tách khỏi hồ sơ cá nhân để gia sư nhìn nhanh mình đang dạy gì, còn môn nào đang chờ duyệt."
      actions={<Button onClick={() => setShowAdd(true)}>Thêm môn dạy</Button>}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={LayersIcon} label="Lớp đang phụ trách" value={ownedClasses.length} hint="Lớp có lịch hoặc đã gán gia sư." />
        <MetricTile icon={CalendarIcon} label="Buổi sắp tới" value={activeSessions.length} hint="Các buổi còn cần dạy hoặc điểm danh." tone="success" />
        <MetricTile icon={BookOpenIcon} label="Môn đã duyệt" value={approvedSubjects.length} hint="Đã sẵn sàng xuất hiện trong gợi ý." tone="neutral" />
        <MetricTile icon={WalletIcon} label="Môn chờ duyệt" value={pendingSubjects.length} hint="Staff cần kiểm tra trước khi mở nhận lớp." tone="warning" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <SectionPanel title="Lớp đang dạy" description="Nếu lớp chưa được gán hoặc chưa có lịch, nó sẽ chưa xuất hiện trong danh sách này.">
          {ownedClasses.length === 0 ? (
            <EmptyPanel title="Chưa có lớp đang dạy" description="Khi staff chọn bạn cho lớp hoặc tạo buổi học, lớp sẽ nằm tại đây." />
          ) : (
            <div className="space-y-3">
              {ownedClasses.map((course) => (
                <article key={course.id} className="rounded-lg border border-border-light bg-surface-secondary p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-text-primary">{course.title}</h3>
                        {getStatusBadge(course.status)}
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">
                        {course.grade_level} · {course.total_sessions} buổi · {course.min_students}-{course.max_students} học viên
                      </p>
                      <p className="mt-1 text-xs text-text-tertiary">
                        {course.mode === 'ONLINE' ? 'Online' : course.location || 'Trực tiếp'}
                      </p>
                    </div>
                    <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-primary-800">
                      {currency(course.fee_per_session_per_student)}/HV
                    </span>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionPanel>

        <SectionPanel title="Môn có thể dạy" description="Đây là năng lực dạy học, nhưng đặt cạnh lớp để gia sư hiểu môn nào đang mở cơ hội nhận lớp.">
          {subjects.length === 0 ? (
            <EmptyPanel title="Chưa đăng ký môn dạy" description="Thêm môn, cấp lớp và học phí để staff duyệt." action={<Button onClick={() => setShowAdd(true)}>Thêm môn dạy</Button>} />
          ) : (
            <div className="space-y-3">
              {subjects.map((subject) => (
                <article key={subject.id} className="rounded-lg border border-border-light bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-text-primary">{subject.subject_name || `Môn #${subject.subject_id}`}</h3>
                        {getStatusBadge(subject.status)}
                      </div>
                      <p className="mt-1 text-sm text-text-secondary">{subject.grade_level}</p>
                      <p className="mt-1 text-sm font-semibold text-primary-800">{currency(subject.fee_per_session)}/buổi</p>
                    </div>
                    <Button size="sm" variant="ghost" className="text-danger-600 hover:bg-danger-50" onClick={() => handleDeleteSubject(subject.id)}>
                      Xóa
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionPanel>
      </div>

      <AddSubjectModal open={showAdd} onClose={() => setShowAdd(false)} allSubjects={allSubjects} onAdded={() => { setShowAdd(false); load(); }} toast={toast} />
    </PortalPage>
  );
}

function AddSubjectModal({ open, onClose, allSubjects, onAdded, toast }: { open: boolean; onClose: () => void; allSubjects: SubjectResponse[]; onAdded: () => void; toast: (t: 'success' | 'error', m: string) => void }) {
  const [form, setForm] = useState({ subject_id: 0, grade_level: '', fee_per_session: '' });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      await tutorApi.addSubject({
        subject_id: form.subject_id,
        grade_level: form.grade_level,
        fee_per_session: form.fee_per_session,
      });
      toast('success', 'Đã thêm môn dạy');
      onAdded();
    } catch {
      toast('error', 'Thêm môn thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Thêm môn dạy"
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button loading={saving} onClick={(event) => handleSubmit(event as unknown as FormEvent)}>Thêm môn</Button>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Môn học"
          options={allSubjects.map((subject) => ({ value: String(subject.id), label: subject.name }))}
          placeholder="Chọn môn"
          value={String(form.subject_id || '')}
          onChange={(event) => setForm((current) => ({ ...current, subject_id: Number(event.target.value) }))}
        />
        <Input label="Cấp lớp" placeholder="VD: Lớp 10-12" value={form.grade_level} onChange={(event) => setForm((current) => ({ ...current, grade_level: event.target.value }))} required />
        <Input label="Học phí (VNĐ/buổi)" type="number" placeholder="200000" value={form.fee_per_session} onChange={(event) => setForm((current) => ({ ...current, fee_per_session: event.target.value }))} required />
      </form>
    </Modal>
  );
}
