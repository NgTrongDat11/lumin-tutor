import { useEffect, useState, type FormEvent } from 'react';
import { classApi, scheduleApi, subjectApi, tutorApi } from '../../services/api';
import type { CourseClassResponse, LearningSessionResponse, SubjectResponse, TutorSubjectResponse } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { getStatusBadge } from '../../components/ui/Badge';
import { DashboardSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { BookOpenIcon, CalendarIcon, LayersIcon, WalletIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel } from '../../components/portal/PortalPage';
import { useAuth } from '../../hooks/useAuth';

function currency(value: string | number | null | undefined) {
  return `${Number(value || 0).toLocaleString('vi-VN')}đ`;
}

const gradeSuggestions = ['Lớp 1-5', 'Lớp 6-9', 'Lớp 10-12', 'IELTS 5.0-6.5', 'IELTS 6.5-7.5+'];
const feeSuggestions = ['150000', '200000', '280000', '350000'];

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

  if (loading) return <DashboardSkeleton />;

  return (
    <PortalPage
      title="Môn dạy và lớp phụ trách"
      description="Đăng ký môn là khai báo năng lực dạy, không tạo lớp mới. Môn được duyệt dùng cho gợi ý 1-1 và điều kiện ứng tuyển lớp nhóm."
      actions={<Button onClick={() => setShowAdd(true)}>Đăng ký môn dạy</Button>}
    >
      <div className="grid gap-4 md:grid-cols-4">
        <MetricTile icon={LayersIcon} label="Lớp đang phụ trách" value={ownedClasses.length} hint="Lớp có lịch hoặc đã gán gia sư." />
        <MetricTile icon={CalendarIcon} label="Buổi sắp tới" value={activeSessions.length} hint="Các buổi còn cần dạy hoặc điểm danh." tone="success" />
        <MetricTile icon={BookOpenIcon} label="Môn đã duyệt" value={approvedSubjects.length} hint="Được dùng cho gợi ý 1-1 và ứng tuyển lớp." tone="neutral" />
        <MetricTile icon={WalletIcon} label="Môn chờ duyệt" value={pendingSubjects.length} hint="Chỉ môn mới chờ duyệt, hồ sơ vẫn hoạt động." tone="warning" />
      </div>

      <SectionPanel title="Luồng nhận việc" description="Hai luồng dùng chung năng lực dạy đã duyệt, nhưng cách vận hành khác nhau.">
        <div className="grid gap-3 lg:grid-cols-2">
          <article className="rounded-lg border border-primary-100 bg-primary-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-primary-700">1-1</p>
            <h3 className="mt-2 font-semibold text-text-primary">Học viên gửi yêu cầu trực tiếp</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Gia sư trao đổi và xác nhận học phí theo buổi. Hệ thống tạo hợp đồng và thanh toán, không cần nhân viên duyệt riêng.
            </p>
          </article>
          <article className="rounded-lg border border-warning-100 bg-warning-50 p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-warning-700">Lớp nhóm</p>
            <h3 className="mt-2 font-semibold text-text-primary">Nhân viên mở lớp và chọn gia sư</h3>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Gia sư ứng tuyển lớp đang tuyển. Nhân viên chọn gia sư, sau đó đăng ký học viên của lớp được nhân viên duyệt.
            </p>
          </article>
        </div>
      </SectionPanel>

      <div className="grid gap-6 xl:grid-cols-[1fr_0.95fr]">
        <SectionPanel title="Lớp đang dạy" description="Nếu lớp chưa được gán hoặc chưa có lịch, nó sẽ chưa xuất hiện trong danh sách này.">
          {ownedClasses.length === 0 ? (
            <EmptyPanel title="Chưa có lớp đang dạy" description="Khi nhân viên chọn bạn cho lớp hoặc tạo buổi học, lớp sẽ nằm tại đây." />
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
                        {course.mode === 'ONLINE' ? 'Trực tuyến' : course.location || 'Trực tiếp'}
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

        <SectionPanel title="Môn đăng ký dạy" description="Môn đã duyệt giúp học viên thấy gia sư trong gợi ý 1-1 và giúp hệ thống kiểm tra khi gia sư ứng tuyển lớp nhóm.">
          {subjects.length === 0 ? (
            <EmptyPanel title="Chưa đăng ký môn dạy" description="Đăng ký môn, cấp lớp và học phí để nhân viên duyệt năng lực dạy." action={<Button onClick={() => setShowAdd(true)}>Đăng ký môn dạy</Button>} />
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
  const selectedSubject = allSubjects.find((subject) => subject.id === form.subject_id);
  const feeNumber = Number(form.fee_per_session || 0);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.subject_id) {
      toast('error', 'Vui lòng chọn môn học');
      return;
    }
    if (!form.grade_level.trim()) {
      toast('error', 'Vui lòng nhập cấp lớp hoặc band điểm');
      return;
    }
    if (!feeNumber || feeNumber <= 0) {
      toast('error', 'Vui lòng nhập học phí hợp lệ');
      return;
    }

    setSaving(true);
    try {
      await tutorApi.addSubject({
        subject_id: form.subject_id,
        grade_level: form.grade_level.trim(),
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
      title="Đăng ký môn dạy"
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button loading={saving} onClick={(event) => handleSubmit(event as unknown as FormEvent)}>Đăng ký môn</Button>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        <section className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Thông tin năng lực</p>
            <p className="mt-1 text-sm text-text-secondary">Chọn môn và phạm vi cấp lớp/band điểm bạn muốn được xét duyệt.</p>
          </div>
          <Select
            label="Môn học"
            options={allSubjects.map((subject) => ({ value: String(subject.id), label: subject.name }))}
            placeholder="Chọn môn"
            value={String(form.subject_id || '')}
            onChange={(event) => setForm((current) => ({ ...current, subject_id: Number(event.target.value) }))}
          />
          <Input
            label="Cấp lớp hoặc band điểm"
            placeholder="VD: Lớp 10-12, IELTS 6.5-7.5+"
            value={form.grade_level}
            onChange={(event) => setForm((current) => ({ ...current, grade_level: event.target.value }))}
            required
          />
          <div className="flex flex-wrap gap-2">
            {gradeSuggestions.map((grade) => (
              <button
                key={grade}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  form.grade_level === grade
                    ? 'border-primary-300 bg-primary-50 text-primary-800'
                    : 'border-border-light bg-white text-text-secondary hover:border-primary-200 hover:text-primary-700'
                }`}
                onClick={() => setForm((current) => ({ ...current, grade_level: grade }))}
              >
                {grade}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Đơn giá tham chiếu</p>
            <p className="mt-1 text-sm text-text-secondary">Đơn giá này dùng làm mức đề xuất khi học viên gửi 1-1 và để staff tham khảo khi mở lớp nhóm.</p>
          </div>
          <Input
            label="Học phí (VNĐ/buổi)"
            type="number"
            min="1"
            placeholder="200000"
            value={form.fee_per_session}
            onChange={(event) => setForm((current) => ({ ...current, fee_per_session: event.target.value }))}
            required
          />
          <div className="flex flex-wrap gap-2">
            {feeSuggestions.map((fee) => (
              <button
                key={fee}
                type="button"
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  form.fee_per_session === fee
                    ? 'border-primary-300 bg-primary-50 text-primary-800'
                    : 'border-border-light bg-white text-text-secondary hover:border-primary-200 hover:text-primary-700'
                }`}
                onClick={() => setForm((current) => ({ ...current, fee_per_session: fee }))}
              >
                {currency(fee)}
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border-light bg-surface-secondary p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Sau khi gửi</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs font-bold text-primary-700">Chờ duyệt môn</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Chỉ môn này ở trạng thái chờ duyệt.</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs font-bold text-primary-700">1-1 vẫn hoạt động</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Hồ sơ verified hiện có không bị khóa.</p>
            </div>
            <div className="rounded-lg bg-white p-3">
              <p className="text-xs font-bold text-primary-700">Lớp nhóm riêng</p>
              <p className="mt-1 text-xs leading-5 text-text-secondary">Staff vẫn là người mở lớp và chọn gia sư.</p>
            </div>
          </div>
        </section>

        <div className="rounded-lg border border-primary-100 bg-primary-50 p-4">
          <p className="text-sm font-semibold text-primary-900">Tóm tắt đăng ký</p>
          <p className="mt-2 text-sm leading-6 text-primary-800">
            {selectedSubject?.name || 'Chưa chọn môn'} · {form.grade_level || 'Chưa nhập cấp lớp'} · {feeNumber > 0 ? `${currency(feeNumber)}/buổi` : 'Chưa nhập học phí'}
          </p>
        </div>
      </form>
    </Modal>
  );
}
