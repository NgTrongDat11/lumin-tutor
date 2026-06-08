import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { scheduleApi, tutorApi } from '../../services/api';
import type { LearningSessionResponse, TutorAvailabilityResponse } from '../../types';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import Select from '../../components/ui/Select';
import { getStatusBadge } from '../../components/ui/Badge';
import { ScheduleSkeleton } from '../../components/ui/Skeleton';
import { useToast } from '../../components/ui/Toast';
import { CalendarIcon, ClockIcon, UserCheckIcon } from '../../components/ui/Icons';
import { EmptyPanel, MetricTile, PortalPage, SectionPanel, SegmentedTabs, WeekPlanner, type WeekEvent } from '../../components/portal/PortalPage';

type ScheduleTab = 'teaching' | 'availability';

const dayNames = ['', 'Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

function toTutorDay(dateValue: string) {
  const jsDay = new Date(dateValue).getDay();
  return jsDay === 0 ? 1 : jsDay + 1;
}

function timeRange(start?: string, end?: string) {
  return `${start?.slice(0, 5) || '--:--'} - ${end?.slice(0, 5) || '--:--'}`;
}

export default function TutorSchedule({ initialTab = 'teaching' }: { initialTab?: ScheduleTab }) {
  const [activeTab, setActiveTab] = useState<ScheduleTab>(initialTab);
  const [sessions, setSessions] = useState<LearningSessionResponse[]>([]);
  const [availabilities, setAvailabilities] = useState<TutorAvailabilityResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingAvailability, setEditingAvailability] = useState<TutorAvailabilityResponse | null>(null);
  const { toast } = useToast();

  const load = () => {
    Promise.all([
      scheduleApi.listSessions().catch(() => []),
      tutorApi.getAvailabilities().catch(() => []),
    ]).then(([sessionList, availabilityList]) => {
      setSessions(sessionList);
      setAvailabilities(availabilityList);
      setLoading(false);
    });
  };

  useEffect(load, []);

  const handleAttendance = async (id: number, status: string) => {
    try {
      await scheduleApi.updateAttendance(id, { status });
      toast('success', 'Đã cập nhật buổi học');
      load();
    } catch {
      toast('error', 'Cập nhật thất bại');
    }
  };

  const handleDeleteAvailability = async (id: number) => {
    if (!confirm('Xóa lịch rảnh này?')) return;
    try {
      await tutorApi.deleteAvailability(id);
      toast('success', 'Đã xóa lịch rảnh');
      load();
    } catch {
      toast('error', 'Xóa thất bại');
    }
  };

  const openAvailabilityModal = (slot?: TutorAvailabilityResponse) => {
    setEditingAvailability(slot || null);
    setShowAdd(true);
  };

  const closeAvailabilityModal = () => {
    setShowAdd(false);
    setEditingAvailability(null);
  };

  const scheduledSessions = useMemo(() => sessions.filter((session) => session.status === 'SCHEDULED'), [sessions]);
  const completedSessions = useMemo(() => sessions.filter((session) => session.status === 'COMPLETED'), [sessions]);

  const weekEvents: WeekEvent[] = useMemo(() => {
    return scheduledSessions.map((session) => ({
      id: `session-${session.id}`,
      dayOfWeek: toTutorDay(session.session_date),
      title: session.private_request_id ? `Yêu cầu 1-1 #${session.private_request_id}` : `Lớp #${session.class_id}`,
      time: timeRange(session.start_time, session.end_time),
      meta: `Buổi ${session.session_number || '--'}`,
      tone: 'primary',
    }));
  }, [scheduledSessions]);

  const availabilityEvents: WeekEvent[] = useMemo(() => {
    return availabilities.map((slot) => ({
      id: `availability-${slot.id}`,
      dayOfWeek: slot.day_of_week,
      title: slot.mode === 'ONLINE' ? 'Dạy trực tuyến' : slot.mode === 'OFFLINE' ? 'Dạy trực tiếp' : 'Trực tuyến hoặc trực tiếp',
      time: timeRange(slot.start_time, slot.end_time),
      tone: 'success',
    }));
  }, [availabilities]);

  if (loading) return <ScheduleSkeleton />;

  return (
    <PortalPage
      title="Lịch dạy"
      description="Một nơi để xem tuần dạy hiện tại và khai báo lịch rảnh, tránh phải nhảy qua nhiều màn."
      actions={activeTab === 'availability' ? <Button onClick={() => openAvailabilityModal()}>Thêm lịch rảnh</Button> : undefined}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <MetricTile icon={CalendarIcon} label="Buổi sắp dạy" value={scheduledSessions.length} hint="Các buổi đang ở trạng thái đã lên lịch." />
        <MetricTile icon={ClockIcon} label="Khung giờ rảnh" value={availabilities.length} hint="Dùng để gợi ý và ghép lịch, không tự đổi buổi học đã chốt." tone="success" />
        <MetricTile icon={UserCheckIcon} label="Đã hoàn thành" value={completedSessions.length} hint="Tổng buổi đã được điểm danh hoàn thành." tone="neutral" />
      </div>

      <SegmentedTabs
        value={activeTab}
        onChange={setActiveTab}
        tabs={[
          { value: 'teaching', label: 'Lịch dạy theo tuần', count: scheduledSessions.length },
          { value: 'availability', label: 'Lịch rảnh', count: availabilities.length },
        ]}
      />

      {activeTab === 'teaching' ? (
        <div className="space-y-6">
          <SectionPanel title="Tuần này" description="Dạng lịch tuần giúp gia sư nhìn ngay ngày nào có lớp và buổi nào cần điểm danh.">
            <WeekPlanner events={weekEvents} emptyText="Trống" />
          </SectionPanel>

          <SectionPanel title="Danh sách buổi học" description="Các buổi sắp tới có thể điểm danh nhanh sau khi kết thúc.">
            {sessions.length === 0 ? (
              <EmptyPanel title="Chưa có buổi học nào" description="Khi nhân viên tạo lịch học, các buổi sẽ xuất hiện tại đây." />
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => (
                  <article key={session.id} className="rounded-lg border border-border-light bg-white p-4">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="font-semibold text-text-primary">
                            {session.private_request_id ? `Yêu cầu 1-1 #${session.private_request_id}` : `Lớp #${session.class_id}`}
                          </h3>
                          {getStatusBadge(session.status)}
                        </div>
                        <p className="mt-1 text-sm text-text-secondary">
                          {new Date(session.session_date).toLocaleDateString('vi-VN')} · {timeRange(session.start_time, session.end_time)} · Buổi {session.session_number || '--'}
                        </p>
                        {session.attendance_note && <p className="mt-2 text-sm text-text-tertiary">{session.attendance_note}</p>}
                      </div>
                      {session.status === 'SCHEDULED' && (
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" onClick={() => handleAttendance(session.id, 'COMPLETED')}>Hoàn thành</Button>
                          <Button size="sm" variant="outline" onClick={() => handleAttendance(session.id, 'NO_SHOW')}>Vắng</Button>
                          <Button size="sm" variant="ghost" onClick={() => handleAttendance(session.id, 'CANCELLED')}>Hủy</Button>
                        </div>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionPanel>
        </div>
      ) : (
        <div className="space-y-6">
          <SectionPanel title="Lịch rảnh theo tuần" description="Các khung giờ này là dữ liệu nền để ghép lớp, gợi ý gia sư và nhận yêu cầu 1-1. Lịch học đã tạo sẽ không tự thay đổi theo phần này.">
            <WeekPlanner events={availabilityEvents} emptyText="Chưa khai báo" />
          </SectionPanel>

          <SectionPanel title="Quản lý khung giờ rảnh" description="Sửa hoặc xóa nhanh các khung giờ không còn phù hợp.">
            {availabilities.length === 0 ? (
              <EmptyPanel title="Chưa khai báo lịch rảnh" description="Thêm ít nhất một khung giờ để tăng khả năng được xếp lớp." action={<Button onClick={() => openAvailabilityModal()}>Thêm lịch rảnh</Button>} />
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {availabilities.map((slot) => (
                  <article key={slot.id} className="rounded-lg border border-border-light bg-surface-secondary p-4">
                    <p className="font-semibold text-text-primary">{dayNames[slot.day_of_week]}</p>
                    <p className="mt-1 text-sm text-text-secondary">{timeRange(slot.start_time, slot.end_time)}</p>
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-text-secondary">
                        {slot.mode === 'ONLINE' ? 'Trực tuyến' : slot.mode === 'OFFLINE' ? 'Trực tiếp' : 'Linh hoạt'}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" onClick={() => openAvailabilityModal(slot)}>
                          Sửa
                        </Button>
                        <Button size="sm" variant="ghost" className="text-danger-600 hover:bg-danger-50" onClick={() => handleDeleteAvailability(slot.id)}>
                          Xóa
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </SectionPanel>
        </div>
      )}

      <AvailabilityModal
        open={showAdd}
        availability={editingAvailability}
        onClose={closeAvailabilityModal}
        onSaved={() => {
          closeAvailabilityModal();
          load();
        }}
        toast={toast}
      />
    </PortalPage>
  );
}

function AvailabilityModal({
  open,
  availability,
  onClose,
  onSaved,
  toast,
}: {
  open: boolean;
  availability: TutorAvailabilityResponse | null;
  onClose: () => void;
  onSaved: () => void;
  toast: (t: 'success' | 'error', m: string) => void;
}) {
  const [form, setForm] = useState({ day_of_week: 2, start_time: '08:00', end_time: '10:00', mode: 'BOTH' });
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(availability);

  useEffect(() => {
    if (!open) return;
    setForm({
      day_of_week: availability?.day_of_week || 2,
      start_time: availability?.start_time.slice(0, 5) || '08:00',
      end_time: availability?.end_time.slice(0, 5) || '10:00',
      mode: availability?.mode || 'BOTH',
    });
  }, [availability, open]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.start_time >= form.end_time) {
      toast('error', 'Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        day_of_week: form.day_of_week,
        start_time: form.start_time,
        end_time: form.end_time,
        mode: form.mode as 'ONLINE' | 'OFFLINE' | 'BOTH',
      };
      if (availability) {
        await tutorApi.updateAvailability(availability.id, payload);
      } else {
        await tutorApi.addAvailability(payload);
      }
      toast('success', isEditing ? 'Đã cập nhật lịch rảnh' : 'Đã thêm lịch rảnh');
      onSaved();
    } catch {
      toast('error', isEditing ? 'Cập nhật lịch thất bại' : 'Thêm lịch thất bại');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEditing ? 'Sửa lịch rảnh' : 'Thêm lịch rảnh'}
      footer={(
        <>
          <Button variant="outline" onClick={onClose}>Hủy</Button>
          <Button loading={saving} onClick={(event) => handleSubmit(event as unknown as FormEvent)}>
            {isEditing ? 'Lưu thay đổi' : 'Thêm lịch'}
          </Button>
        </>
      )}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Select
          label="Ngày trong tuần"
          options={[2, 3, 4, 5, 6, 7, 1].map((day) => ({ value: String(day), label: dayNames[day] }))}
          value={String(form.day_of_week)}
          onChange={(event) => setForm((current) => ({ ...current, day_of_week: Number(event.target.value) }))}
        />
        <div className="grid grid-cols-2 gap-4">
          <Input label="Bắt đầu" type="time" value={form.start_time} onChange={(event) => setForm((current) => ({ ...current, start_time: event.target.value }))} />
          <Input label="Kết thúc" type="time" value={form.end_time} onChange={(event) => setForm((current) => ({ ...current, end_time: event.target.value }))} />
        </div>
        <Select
          label="Hình thức"
          options={[
            { value: 'BOTH', label: 'Linh hoạt' },
            { value: 'ONLINE', label: 'Trực tuyến' },
            { value: 'OFFLINE', label: 'Trực tiếp' },
          ]}
          value={form.mode}
          onChange={(event) => setForm((current) => ({ ...current, mode: event.target.value }))}
        />
      </form>
    </Modal>
  );
}
