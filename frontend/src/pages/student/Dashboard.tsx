import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  classApi,
  learningNeedApi,
  recommendationApi,
  subjectApi,
  tutorApi,
  privateRequestApi,
  extractErrorMessage,
} from '../../services/api';
import type {
  CourseClassResponse,
  RecommendedTutor,
  RecommendationResponse,
  SubjectResponse,
  TutorPublicResponse,
  LearningNeedCreate,
  LearningNeedResponse,
  LearningNeedScheduleCreate,
} from '../../types';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { getStatusBadge } from '../../components/ui/Badge';
import { PageLoading } from '../../components/ui/Spinner';
import Avatar from '../../components/ui/Avatar';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import {
  BookOpenIcon,
  CalendarIcon,
  SearchIcon,
  UsersIcon,
} from '../../components/ui/Icons';
import dashboardHero from '../../assets/dashboard-hero.png';

const dayNames = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
const timeSlotOptions = [
  { value: '', label: 'Chọn buổi' },
  { value: 'MORNING', label: 'Sáng' },
  { value: 'AFTERNOON', label: 'Chiều' },
  { value: 'EVENING', label: 'Tối' },
];
const PAGE_SIZE = 9;

type ResultTab = 'ALL' | 'CLASS' | 'TUTOR' | 'RECOMMENDATION';
type ModeFilter = 'ALL' | 'ONLINE' | 'OFFLINE';
type DetailTarget =
  | { type: 'CLASS'; data: CourseClassResponse }
  | { type: 'TUTOR'; data: RecommendedTutor }
  | null;

function createEmptyLearningNeedForm(): LearningNeedCreate {
  return {
    preferred_mode: 'BOTH',
    preferred_learning_type: 'BOTH',
    schedules: [],
  };
}

function toCurrency(value: string | number | null | undefined) {
  const amount = typeof value === 'number' ? value : Number(value || 0);
  return `${amount.toLocaleString('vi-VN')}đ`;
}

function includesQuery(values: Array<string | null | undefined>, query: string) {
  if (!query) return true;
  return values.filter(Boolean).join(' ').toLowerCase().includes(query);
}

function matchesMode(value: string | null | undefined, filter: ModeFilter) {
  if (filter === 'ALL') return true;
  return value === filter || value === 'BOTH';
}

function getClassModeMeta(course: CourseClassResponse) {
  if (course.mode === 'ONLINE') {
    return {
      label: 'Online',
      detail: 'Học trực tuyến',
      classes: 'border-sky-200 bg-sky-50 text-sky-700',
    };
  }
  if (course.mode === 'OFFLINE') {
    return {
      label: 'Trực tiếp',
      detail: course.location || 'Học tại lớp',
      classes: 'border-amber-200 bg-amber-50 text-amber-700',
    };
  }
  return {
    label: 'Linh hoạt',
    detail: course.location ? `Online hoặc ${course.location}` : 'Online hoặc trực tiếp',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

function getTeachingModeLabel(mode: string | null | undefined) {
  if (mode === 'ONLINE') return 'Online';
  if (mode === 'OFFLINE') return 'Trực tiếp';
  return 'Linh hoạt';
}

function getCourseTotalFee(course: CourseClassResponse) {
  return Number(course.fee_per_session_per_student || 0) * course.total_sessions;
}

export default function StudentDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [browseTutors, setBrowseTutors] = useState<TutorPublicResponse[]>([]);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [activeNeed, setActiveNeed] = useState<LearningNeedResponse | null>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [modeFilter, setModeFilter] = useState<ModeFilter>('ALL');
  const [subjectFilter, setSubjectFilter] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<ResultTab>('ALL');
  const [classPage, setClassPage] = useState(1);
  const [tutorPage, setTutorPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<DetailTarget>(null);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(false);
  const [showSmartMatch, setShowSmartMatch] = useState(false);
  const [tutorForRequest, setTutorForRequest] = useState<RecommendedTutor | null>(null);

  const fetchRecommendation = async (needId: number) => {
    setRecLoading(true);
    try {
      const rec = await recommendationApi.forNeed(needId);
      setRecommendation(rec);
    } catch {
      toast('error', 'Không thể tải kết quả Smart Match.');
    } finally {
      setRecLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const [n, c, s, t] = await Promise.all([
        learningNeedApi.list().catch(() => []),
        classApi.list().catch(() => []),
        subjectApi.list().catch(() => []),
        tutorApi.browse().catch(() => []),
      ]);
      setClasses(c);
      setSubjects(s);
      setBrowseTutors(t);

      const firstActiveNeed = n.find((need) => need.status === 'ACTIVE') ?? n[0] ?? null;
      setActiveNeed(firstActiveNeed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === 'RECOMMENDATION' && activeNeed && !recommendation) {
      void fetchRecommendation(activeNeed.id);
    }
  }, [activeTab, activeNeed, recommendation]);

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const recommendedTutors = useMemo(() => recommendation?.recommended_tutors ?? [], [recommendation]);
  const visibleSubjectFilters = useMemo(() => subjects.slice(0, 6), [subjects]);
  const subjectNameById = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject.name])),
    [subjects],
  );
  const tutorRecById = useMemo(() => {
    const data = new Map<number, RecommendedTutor>();
    browseTutors.forEach((tutor) => {
      data.set(tutor.id, { tutor, score: '0', reasons: [] });
    });
    recommendedTutors.forEach((rec) => {
      data.set(rec.tutor.id, rec);
    });
    return data;
  }, [browseTutors, recommendedTutors]);

  const openTutorProfile = (tutorId: number | null | undefined) => {
    if (!tutorId) {
      toast('error', 'Lớp này chưa phân công giảng viên.');
      return;
    }
    const rec = tutorRecById.get(tutorId);
    if (!rec) {
      toast('error', 'Chưa có hồ sơ công khai của giảng viên này.');
      return;
    }
    setDetailTarget({ type: 'TUTOR', data: rec });
  };

  const classResults = useMemo(() => {
    return classes
      .filter((course) => {
        if (!includesQuery([
          course.title,
          course.grade_level,
          course.goal,
          course.location,
          course.mode,
          String(course.fee_per_session_per_student),
        ], normalizedQuery)) return false;
        if (!matchesMode(course.mode, modeFilter)) return false;
        if (subjectFilter && course.subject_id !== subjectFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.status === 'ENROLLING' && b.status !== 'ENROLLING') return -1;
        if (a.status !== 'ENROLLING' && b.status === 'ENROLLING') return 1;
        return a.title.localeCompare(b.title);
      });
  }, [classes, normalizedQuery, modeFilter, subjectFilter]);

  const tutorResults = useMemo(() => {
    const dataSource = activeTab === 'RECOMMENDATION'
      ? recommendedTutors
      : browseTutors.map(tutor => ({ tutor, score: '0', reasons: [] } as RecommendedTutor));

    return dataSource.filter((rec) => {
      if (!includesQuery([
        rec.tutor.full_name,
        rec.tutor.bio,
        rec.tutor.qualification_level,
        rec.tutor.teaching_area,
        ...rec.tutor.subjects.flatMap((subject) => [subject.subject_name, subject.grade_level]),
      ], normalizedQuery)) return false;
      if (!matchesMode(rec.tutor.teaching_mode, modeFilter)) return false;
      if (subjectFilter && !rec.tutor.subjects.some((subject) => subject.subject_id === subjectFilter)) return false;
      return true;
    });
  }, [recommendedTutors, browseTutors, activeTab, normalizedQuery, modeFilter, subjectFilter]);

  useEffect(() => {
    setClassPage(1);
    setTutorPage(1);
  }, [normalizedQuery, modeFilter, subjectFilter, activeTab]);

  const visibleClasses = activeTab === 'ALL' || activeTab === 'CLASS' ? classResults : [];
  const visibleTutors = (activeTab === 'ALL' || activeTab === 'TUTOR' || activeTab === 'RECOMMENDATION') ? tutorResults : [];
  const pagedClasses = visibleClasses.slice(0, classPage * PAGE_SIZE);
  const pagedTutors = visibleTutors.slice(0, tutorPage * PAGE_SIZE);
  const hasMoreClasses = visibleClasses.length > pagedClasses.length;
  const hasMoreTutors = visibleTutors.length > pagedTutors.length;
  const hasResults = visibleClasses.length > 0 || visibleTutors.length > 0 || (activeTab === 'RECOMMENDATION' && recLoading);

  if (loading) return <PageLoading />;

  return (
    <div className="mx-auto w-full animate-slide-up space-y-8">
      {/* Smart Match Banner */}
      <section className="relative overflow-hidden rounded-2xl bg-primary-950 text-white">
        <img src={dashboardHero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="relative z-10 p-8 md:p-10">
          <div className="max-w-2xl">
            <span className="inline-block px-3 py-1 bg-white/10 rounded-full text-xs font-semibold tracking-wide mb-5 border border-white/10">
              Smart Match
            </span>
            <h1 className="text-2xl font-bold leading-snug tracking-tight md:text-4xl">
              Chưa biết học gì?
              <br />
              Để AI gợi ý cho bạn.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/60">
              Tạo hồ sơ nhu cầu học tập trong 1 phút. Hệ thống sẽ tìm gia sư và lớp học phù hợp nhất.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Button size="lg" className="bg-white !text-primary-950 hover:bg-white/90 border-none font-semibold" onClick={() => setShowSmartMatch(true)}>
                Tạo cấu hình & nhận gợi ý
              </Button>
              {activeNeed && (
                <Button size="lg" variant="outline" className="!text-white/80 border-white/15 hover:bg-white/5" onClick={() => setActiveTab('RECOMMENDATION')}>
                  Xem lại gợi ý cũ
                </Button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="bg-white rounded-2xl p-4 shadow-sm border border-border">
        <div className="flex items-center gap-3 bg-surface-secondary rounded-xl px-4 py-3 border border-border-light focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
          <SearchIcon className="h-6 w-6 shrink-0 text-text-tertiary" />
          <input
            value={searchQuery}
            onChange={(event) => {
              setSearchQuery(event.target.value);
              if (activeTab === 'RECOMMENDATION') setActiveTab('ALL');
            }}
            placeholder="Tìm trực tiếp Toán, IELTS, tên gia sư..."
            className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-text-tertiary"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs font-semibold text-text-tertiary hover:text-text-primary px-2"
            >
              XÓA
            </button>
          )}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-start">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Hình thức</p>
            <div className="inline-flex rounded-xl border border-border bg-surface-secondary p-1">
              {(['ALL', 'ONLINE', 'OFFLINE'] as ModeFilter[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setModeFilter(mode)}
                  className={`rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                    modeFilter === mode
                      ? 'bg-white text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {mode === 'ALL' ? 'Mọi hình thức' : mode === 'ONLINE' ? 'Online' : 'Trực tiếp'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Môn học</p>
            <div className="flex flex-wrap gap-2">
              {visibleSubjectFilters.map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => setSubjectFilter((current) => current === subject.id ? null : subject.id)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                    subjectFilter === subject.id
                      ? 'border-primary-400 bg-primary-50 text-primary-700'
                      : 'border-border bg-white text-text-secondary hover:border-primary-300 hover:text-text-primary'
                  }`}
                >
                  {subject.name}
                </button>
              ))}
            </div>
          </div>

          {(modeFilter !== 'ALL' || subjectFilter !== null) && (
            <button
              type="button"
              onClick={() => {
                setModeFilter('ALL');
                setSubjectFilter(null);
              }}
              className="self-end rounded-lg px-3 py-2 text-xs font-bold text-danger-500 hover:bg-danger-50 hover:text-danger-700"
            >
              Xóa lọc
            </button>
          )}
        </div>
      </section>

      {/* Tabs */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            {activeTab === 'RECOMMENDATION' ? 'Gợi ý thông minh (AI Match)' : 'Kết quả khám phá'}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {activeTab === 'RECOMMENDATION' 
              ? 'Dựa trên cấu hình học tập bạn vừa tạo.' 
              : searchQuery ? `Đang hiển thị kết quả cho "${searchQuery}".` : 'Lớp học được ưu tiên trước, sau đó là gia sư.'}
          </p>
        </div>

        <div className="flex rounded-full border border-border bg-white p-1 overflow-x-auto custom-scrollbar shadow-sm">
          {([
            ['ALL', `Tất cả`],
            ['CLASS', `Lớp học`],
            ['TUTOR', `Gia sư`],
            ['RECOMMENDATION', `Gợi ý của tôi ✨`],
          ] as [ResultTab, string][]).map(([tab, label]) => {
            if (tab === 'RECOMMENDATION' && !activeNeed) return null;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all ${
                  activeTab === tab
                    ? tab === 'RECOMMENDATION' ? 'bg-gradient-to-r from-primary-600 to-primary-700 text-white shadow-md' : 'bg-text-primary text-white shadow-md'
                    : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                }`}
              >
                {label}
              </button>
            )
          })}
        </div>
      </section>

      {/* Results */}
      {activeTab === 'RECOMMENDATION' && recLoading ? (
        <Card padding="lg" className="text-center bg-transparent py-16">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
          <p className="text-sm font-semibold text-text-secondary">AI đang phân tích nhu cầu của bạn...</p>
        </Card>
      ) : !hasResults ? (
        <Card padding="lg" className="border-dashed border-2 text-center bg-transparent py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center mb-4">
            <SearchIcon className="h-8 w-8 text-text-tertiary" />
          </div>
          <h3 className="text-xl font-bold text-text-primary">Chưa tìm thấy kết quả</h3>
          <p className="mt-2 text-sm text-text-secondary max-w-sm mx-auto">
            Hãy thử đổi từ khóa hoặc dùng tính năng Smart Match để AI tự động tìm kiếm cho bạn.
          </p>
        </Card>
      ) : (
        <div className="space-y-10">
          {visibleClasses.length > 0 && activeTab !== 'RECOMMENDATION' && (
            <section>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-text-primary">Lớp học nhóm ({visibleClasses.length})</h3>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 stagger-grid">
                {pagedClasses.map((course) => (
                  <ClassCard
                    key={course.id}
                    course={course}
                    subjectName={subjectNameById.get(course.subject_id)}
                    tutorProfile={course.primary_tutor_id ? tutorRecById.get(course.primary_tutor_id)?.tutor : undefined}
                    onOpen={() => setDetailTarget({ type: 'CLASS', data: course })}
                    onOpenTutor={() => openTutorProfile(course.primary_tutor_id)}
                  />
                ))}
              </div>
              {hasMoreClasses && (
                <div className="mt-6 text-center">
                  <Button variant="outline" className="px-8" onClick={() => setClassPage((page) => page + 1)}>
                    Xem thêm {visibleClasses.length - pagedClasses.length} lớp học
                  </Button>
                </div>
              )}
            </section>
          )}

          {visibleClasses.length > 0 && visibleTutors.length > 0 && activeTab === 'ALL' && (
            <div className="relative flex items-center py-2">
              <div className="flex-1 border-t border-border-light" />
              <span className="bg-surface-primary px-4 text-xs font-bold uppercase tracking-widest text-text-tertiary">
                Gia sư phù hợp
              </span>
              <div className="flex-1 border-t border-border-light" />
            </div>
          )}

          {visibleTutors.length > 0 && (
            <section>
              <div className="mb-5 flex items-center justify-between">
                <h3 className="text-xl font-bold text-text-primary">
                  {activeTab === 'RECOMMENDATION' ? 'Gia sư phù hợp nhất với bạn' : `Gia sư (${visibleTutors.length})`}
                </h3>
              </div>
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3 stagger-grid">
                {pagedTutors.map((rec) => (
                  <TutorCard key={rec.tutor.id} rec={rec} isRecommendation={activeTab === 'RECOMMENDATION'} onOpen={() => setDetailTarget({ type: 'TUTOR', data: rec })} />
                ))}
              </div>
              {hasMoreTutors && (
                <div className="mt-6 text-center">
                  <Button variant="outline" className="px-8" onClick={() => setTutorPage((page) => page + 1)}>
                    Xem thêm {visibleTutors.length - pagedTutors.length} gia sư
                  </Button>
                </div>
              )}
            </section>
          )}
        </div>
      )}

      {/* Smart Match Modal */}
      <CreateNeedModal
        open={showSmartMatch}
        onClose={() => setShowSmartMatch(false)}
        subjects={subjects}
        onCreated={() => { 
          setShowSmartMatch(false); 
          setRecommendation(null);
          loadData().then(() => setActiveTab('RECOMMENDATION')); 
        }}
        toast={toast}
      />

      {/* Send Request Modal */}
      {tutorForRequest && (
        <SendRequestModal
          open={!!tutorForRequest}
          onClose={() => setTutorForRequest(null)}
          tutor={tutorForRequest.tutor}
          activeNeed={activeNeed}
          onCreated={() => {
            setTutorForRequest(null);
            navigate('/student/my-learning');
          }}
          toast={toast}
        />
      )}

      {/* Details Modal */}
      <DetailModal
        target={detailTarget}
        isRecommendation={activeTab === 'RECOMMENDATION'}
        subjectNameById={subjectNameById}
        tutorRecById={tutorRecById}
        onClose={() => setDetailTarget(null)}
        onOpenTutor={openTutorProfile}
        onRequestTutor={(tutor) => {
          setTutorForRequest(tutor);
          setDetailTarget(null);
        }}
        onRegisterClass={async (classId) => {
          try {
            await classApi.register(classId, { learning_need_id: activeNeed?.id });
            toast('success', 'Đăng ký lớp nhóm thành công! Chờ ban quản trị duyệt.');
            setDetailTarget(null);
            navigate('/student/my-learning');
          } catch (err: any) {
            toast('error', 'Đăng ký thất bại: ' + extractErrorMessage(err));
          }
        }}
      />
    </div>
  );
}

function ClassCard({
  course,
  subjectName,
  tutorProfile,
  onOpen,
  onOpenTutor,
}: {
  course: CourseClassResponse;
  subjectName?: string;
  tutorProfile?: TutorPublicResponse;
  onOpen: () => void;
  onOpenTutor: () => void;
}) {
  const modeMeta = getClassModeMeta(course);
  const totalFee = getCourseTotalFee(course);

  return (
    <article className="group relative flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border border-border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg" onClick={onOpen}>
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary-600">
              {subjectName || 'Lớp nhóm'} · {course.grade_level}
            </p>
            <h4 className="line-clamp-2 text-lg font-bold leading-snug text-text-primary transition-colors group-hover:text-primary-800">
              {course.title}
            </h4>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <span className={`rounded-full border px-3 py-1 text-xs font-extrabold uppercase tracking-wide ${modeMeta.classes}`}>
              {modeMeta.label}
            </span>
            {getStatusBadge(course.status)}
          </div>
        </div>

        {course.goal && (
          <p className="mb-4 line-clamp-2 text-xs leading-relaxed text-text-secondary">
            {course.goal}
          </p>
        )}

        <div className="mt-auto space-y-2 rounded-xl border border-border-light bg-surface-secondary/70 p-4">
          {course.tutor_name && (
            <div className="flex items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-sm font-medium text-text-secondary">
                <UsersIcon className="h-4 w-4 shrink-0 text-primary-500" />
                <span>GV:</span>
                <span className="truncate font-bold text-text-primary">{course.tutor_name}</span>
              </p>
              {tutorProfile && (
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenTutor();
                  }}
                  className="shrink-0 rounded-lg px-2 py-1 text-xs font-bold text-primary-700 hover:bg-primary-50"
                >
                  Xem hồ sơ
                </button>
              )}
            </div>
          )}
          <p className="flex items-center gap-2 text-sm font-medium text-text-secondary">
            <CalendarIcon className="h-4 w-4 shrink-0 text-primary-500" />
            <span>{course.total_sessions} buổi · {modeMeta.detail}</span>
          </p>
          <div className="mt-2 border-t border-border-light/70 pt-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">Tạm tính trọn khóa</p>
                <p className="text-2xl font-extrabold leading-tight text-primary-800">
                  {toCurrency(totalFee)}
                </p>
              </div>
              <p className="shrink-0 text-right text-xs leading-5 text-text-tertiary">
                {toCurrency(course.fee_per_session_per_student)} / buổi
                <br />
                {course.min_students}-{course.max_students} học viên
              </p>
            </div>
          </div>
        </div>

        <p className="mt-3 text-center text-xs text-text-tertiary opacity-0 transition-opacity group-hover:opacity-100">
          Bấm để xem chi tiết
        </p>
      </div>
    </article>
  );
}

function TutorCard({ rec, isRecommendation, onOpen }: { rec: RecommendedTutor; isRecommendation?: boolean; onOpen: () => void }) {
  const lowestFee = rec.tutor.subjects.reduce<number | null>((lowest, subject) => {
    const fee = Number(subject.fee_per_session);
    if (!Number.isFinite(fee)) return lowest;
    return lowest === null ? fee : Math.min(lowest, fee);
  }, null);
  const modeLabel = getTeachingModeLabel(rec.tutor.teaching_mode);

  return (
    <article className="flex h-full flex-col rounded-xl border border-border bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg hover:border-primary-200 cursor-pointer" onClick={onOpen}>
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <Avatar name={rec.tutor.full_name} size="lg" shape="square" />
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600 mb-1">Gia sư 1-1</p>
            <h4 className="text-lg font-bold text-text-primary line-clamp-1">{rec.tutor.full_name}</h4>
            <p className="mt-1 text-xs font-bold text-text-tertiary">{modeLabel} · {rec.tutor.teaching_area || 'Chưa cập nhật khu vực'}</p>
          </div>
        </div>
        {isRecommendation && (
          <div className="shrink-0 flex flex-col items-end">
            <span className="rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
              {Number(rec.score || 0).toFixed(0)}% Match
            </span>
          </div>
        )}
      </div>
      
      <p className="text-sm text-text-secondary line-clamp-2 min-h-[2.5rem] mb-4">
        {rec.tutor.bio || 'Gia sư chưa cập nhật giới thiệu chi tiết.'}
      </p>

      <div className="mt-auto space-y-3">
        {rec.tutor.subjects.length > 0 && (
          <div className="rounded-xl bg-surface-secondary p-3">
            <p className="mb-2 text-xs font-bold uppercase text-text-tertiary">Môn dạy</p>
            <div className="flex flex-wrap gap-1.5">
              {rec.tutor.subjects.map((subject) => (
                <span
                  key={subject.id}
                  className="inline-flex max-w-full items-center gap-1 rounded-full border border-primary-100 bg-primary-50 px-2.5 py-1 text-xs font-semibold text-primary-700"
                >
                  <span className="truncate">{subject.subject_name || 'Môn học'}</span>
                  <span className="shrink-0 font-normal text-primary-400">· {subject.grade_level}</span>
                </span>
              ))}
            </div>
            {lowestFee !== null && (
              <p className="mt-2 text-sm font-bold text-primary-700">
                Từ {toCurrency(lowestFee)}
                <span className="text-xs font-normal text-text-tertiary"> / buổi</span>
              </p>
            )}
          </div>
        )}
        
        {isRecommendation && rec.reasons.length > 0 && (
          <div className="pt-3 border-t border-border-light">
            <p className="text-xs font-bold text-text-tertiary uppercase mb-1 flex items-center gap-1">
              <span>✨</span> Lý do phù hợp
            </p>
            <p className="text-xs font-medium text-text-secondary line-clamp-2">
              {rec.reasons[0]}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="w-full rounded-xl border border-primary-100 bg-white px-3 py-2 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50"
        >
          Xem hồ sơ gia sư
        </button>
      </div>
    </article>
  );
}

function DetailModal({
  target,
  isRecommendation,
  subjectNameById,
  tutorRecById,
  onClose,
  onOpenTutor,
  onRequestTutor,
  onRegisterClass,
}: {
  target: DetailTarget;
  isRecommendation?: boolean;
  subjectNameById: Map<number, string>;
  tutorRecById: Map<number, RecommendedTutor>;
  onClose: () => void;
  onOpenTutor: (tutorId: number | null | undefined) => void;
  onRequestTutor: (tutor: RecommendedTutor) => void;
  onRegisterClass: (classId: number) => void;
}) {
  if (!target) return null;

  if (target.type === 'CLASS') {
    const course = target.data;
    const modeMeta = getClassModeMeta(course);
    const subjectName = subjectNameById.get(course.subject_id);
    const tutorRec = course.primary_tutor_id ? tutorRecById.get(course.primary_tutor_id) : undefined;
    const totalFee = getCourseTotalFee(course);

    return (
      <Modal
        open
        onClose={onClose}
        title="Chi tiết Lớp nhóm"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={onClose}>Đóng</Button>
            {course.status === 'ENROLLING' ? (
              <Button onClick={() => onRegisterClass(course.id)}>Đăng ký lớp này</Button>
            ) : (
              <Button disabled>Lớp đã đóng đăng ký</Button>
            )}
          </>
        }
      >
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">{course.title}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-3">
              {getStatusBadge(course.status)}
              {subjectName && (
                <span className="rounded-full bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-700">{subjectName}</span>
              )}
              <span className="rounded-full bg-surface-secondary px-3 py-1.5 text-xs font-bold text-text-secondary">{course.grade_level}</span>
              <span className={`rounded-full border px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide ${modeMeta.classes}`}>{modeMeta.label}</span>
            </div>
          </div>

          {course.tutor_name && (
            <div className="flex flex-col gap-3 rounded-xl border border-primary-100 bg-primary-50 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
              <Avatar name={course.tutor_name} size="md" shape="square" />
              <div>
                <p className="text-xs font-bold text-primary-600 uppercase">Giảng viên phụ trách</p>
                <p className="text-base font-bold text-text-primary">{course.tutor_name}</p>
              </div>
              </div>
              {tutorRec ? (
                <Button variant="outline" size="sm" onClick={() => onOpenTutor(course.primary_tutor_id)}>
                  Xem hồ sơ giảng viên
                </Button>
              ) : (
                <span className="text-xs font-semibold text-text-tertiary">Chưa có hồ sơ công khai</span>
              )}
            </div>
          )}

          <div className="bg-surface-secondary rounded-xl p-4 border border-border-light">
            <h4 className="text-sm font-bold text-text-primary mb-2">Mục tiêu khóa học</h4>
            <p className="text-sm leading-relaxed text-text-secondary">{course.goal || 'Đang cập nhật chi tiết.'}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <InfoTile icon={CalendarIcon} label="Thời lượng" value={`${course.total_sessions} buổi`} />
            <InfoTile icon={UsersIcon} label="Hình thức" value={modeMeta.detail} />
            <InfoTile icon={BookOpenIcon} label="Tạm tính" value={toCurrency(totalFee)} />
          </div>

          <div className="rounded-xl border border-border-light bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Chi phí dự kiến</p>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <p className="text-3xl font-extrabold text-primary-800">{toCurrency(totalFee)}</p>
              <p className="text-sm font-medium text-text-secondary">
                {toCurrency(course.fee_per_session_per_student)} / buổi x {course.total_sessions} buổi · sĩ số {course.min_students}-{course.max_students} học viên
              </p>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  const rec = target.data;
  const modeLabel = rec.tutor.teaching_mode === 'ONLINE' ? 'Trực tuyến' : rec.tutor.teaching_mode === 'OFFLINE' ? 'Trực tiếp' : 'Cả hai';
  const dayNamesShort = ['', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

  return (
    <Modal
      open
      onClose={onClose}
      title="Hồ sơ Gia sư"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Đóng</Button>
          <Button onClick={() => onRequestTutor(rec)}>Gửi yêu cầu học 1-1</Button>
        </>
      }
    >
      <div className="space-y-6">
        <div className="flex items-center gap-4 border-b border-border-light pb-6">
          <Avatar name={rec.tutor.full_name} size="xl" shape="square" className="rounded-2xl" />
          <div>
            <h2 className="text-2xl font-bold text-text-primary">{rec.tutor.full_name}</h2>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-700">
                {Number(rec.tutor.average_rating || 0).toFixed(1)} ⭐
              </span>
              <span className="rounded-full bg-surface-secondary px-3 py-1 text-xs font-bold text-text-secondary">
                {rec.tutor.years_experience} năm kinh nghiệm
              </span>
            </div>
          </div>
        </div>

        {/* Teaching info */}
        <div className="grid gap-3 sm:grid-cols-3">
          <InfoTile icon={BookOpenIcon} label="Hình thức" value={modeLabel} />
          <InfoTile icon={UsersIcon} label="Trình độ" value={rec.tutor.qualification_level || 'N/A'} />
          <InfoTile icon={SearchIcon} label="Khu vực" value={rec.tutor.teaching_area || 'Chưa rõ'} />
        </div>

        <div>
          <h4 className="text-sm font-bold text-text-primary mb-2">Giới thiệu</h4>
          <p className="text-sm leading-relaxed text-text-secondary bg-surface-secondary p-4 rounded-xl">
            {rec.tutor.bio || 'Chưa cập nhật.'}
          </p>
        </div>

        <div>
          <h4 className="text-sm font-bold text-text-primary mb-3">Môn học phụ trách</h4>
          <div className="grid gap-3 sm:grid-cols-2">
            {rec.tutor.subjects.map((subject) => (
              <div key={subject.id} className="rounded-xl border border-border-light p-4 shadow-sm">
                <p className="font-bold text-text-primary">{subject.subject_name || `Môn #${subject.subject_id}`}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs font-bold text-text-tertiary uppercase">{subject.grade_level}</span>
                  <span className="text-sm font-bold text-primary-700">{toCurrency(subject.fee_per_session)}<span className="font-normal text-xs text-text-tertiary">/buổi</span></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Availability */}
        {rec.tutor.availabilities.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-text-primary mb-3">Lịch rảnh</h4>
            <div className="flex flex-wrap gap-2">
              {rec.tutor.availabilities.map((a) => (
                <span key={a.id} className="text-xs bg-surface-tertiary text-text-secondary border border-border-light px-3 py-1.5 rounded-lg font-medium">
                  {dayNamesShort[a.day_of_week]} {a.start_time?.slice(0, 5)}–{a.end_time?.slice(0, 5)}
                </span>
              ))}
            </div>
          </div>
        )}

        {isRecommendation && rec.reasons.length > 0 && (
          <div>
            <h4 className="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
              <span className="text-lg">✨</span> Vì sao phù hợp với bạn?
            </h4>
            <div className="bg-primary-50 rounded-xl p-4 border border-primary-100 space-y-2">
              {rec.reasons.map((reason, index) => (
                <div key={index} className="flex gap-2 text-sm text-primary-900">
                  <span className="font-bold text-primary-500">•</span>
                  <span>{reason}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof BookOpenIcon; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border-light bg-surface-secondary p-4 flex flex-col items-center text-center">
      <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm mb-2">
        <Icon className="h-4 w-4 text-primary-600" />
      </div>
      <p className="text-xs font-bold text-text-tertiary uppercase mb-1">{label}</p>
      <p className="font-bold text-text-primary">{value}</p>
    </div>
  );
}

/* ── Create Need Modal (Smart Match) ───────────── */
function CreateNeedModal({
  open, onClose, subjects, onCreated, toast,
}: {
  open: boolean;
  onClose: () => void;
  subjects: SubjectResponse[];
  onCreated: () => void;
  toast: (type: 'success' | 'error', msg: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<LearningNeedCreate>(() => createEmptyLearningNeedForm());

  useEffect(() => {
    if (open) {
      setForm(createEmptyLearningNeedForm());
    }
  }, [open]);

  const updateField = (field: string, value: unknown) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleClose = () => {
    setForm(createEmptyLearningNeedForm());
    onClose();
  };

  const addSchedule = () => {
    const s: LearningNeedScheduleCreate = { day_of_week: 2 };
    setForm((f) => ({ ...f, schedules: [...(f.schedules || []), s] }));
  };

  const updateSchedule = (idx: number, field: string, value: unknown) => {
    setForm((f) => {
      const schedules = [...(f.schedules || [])];
      schedules[idx] = { ...schedules[idx], [field]: value };
      return { ...f, schedules };
    });
  };

  const removeSchedule = (idx: number) => {
    setForm((f) => ({ ...f, schedules: (f.schedules || []).filter((_, i) => i !== idx) }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.subject_id || !form.goal) {
      toast('error', 'Vui lòng chọn môn học và nhập mục tiêu.');
      return;
    }

    setLoading(true);
    try {
      await learningNeedApi.create(form);
      toast('success', 'Đã khởi tạo hồ sơ AI Match thành công!');
      onCreated();
    } catch {
      toast('error', 'Có lỗi xảy ra, vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Khởi tạo Cấu hình Smart Match"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={handleClose}>Huỷ bỏ</Button>
          <Button loading={loading} onClick={(e) => handleSubmit(e as unknown as React.FormEvent)}>✨ Phân tích & Nhận gợi ý</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-primary-50 rounded-xl p-4 text-sm text-primary-800 border border-primary-100 flex gap-3">
          <span className="text-xl">🤖</span>
          <p>Hệ thống AI sẽ phân tích nhu cầu của bạn và so khớp với dữ liệu hàng trăm gia sư để tìm ra người phù hợp nhất.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Select
            label="Môn học mong muốn"
            options={subjects.map((s) => ({ value: String(s.id), label: s.name }))}
            placeholder="Chọn môn học..."
            value={String(form.subject_id || '')}
            onChange={(e) => updateField('subject_id', e.target.value ? Number(e.target.value) : undefined)}
          />
          <Input
            label="Trình độ hiện tại / Cấp lớp"
            placeholder="VD: Lớp 12, Mất gốc..."
            value={form.grade_level || ''}
            onChange={(e) => updateField('grade_level', e.target.value)}
          />
          <div className="md:col-span-2">
            <Textarea
              label="Mục tiêu học tập"
              placeholder="VD: Thi đại học đạt 8 điểm, cần rèn thêm bài tập nâng cao..."
              value={form.goal || ''}
              onChange={(e) => updateField('goal', e.target.value)}
              rows={2}
            />
          </div>
          
          <Select
            label="Hình thức gặp mặt"
            options={[
              { value: 'BOTH', label: 'Linh hoạt' },
              { value: 'ONLINE', label: 'Chỉ Online' },
              { value: 'OFFLINE', label: 'Chỉ Trực tiếp' },
            ]}
            value={form.preferred_mode || 'BOTH'}
            onChange={(e) => updateField('preferred_mode', e.target.value)}
          />
          <Select
            label="Quy mô lớp"
            options={[
              { value: 'BOTH', label: 'Cả nhóm & 1-1' },
              { value: 'PRIVATE', label: 'Chỉ dạy kèm 1-1' },
              { value: 'GROUP', label: 'Chỉ học nhóm' },
            ]}
            value={form.preferred_learning_type || 'BOTH'}
            onChange={(e) => updateField('preferred_learning_type', e.target.value)}
          />
        </div>

        <hr className="border-border-light" />

        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-text-primary">Khung giờ rảnh (Tùy chọn)</h4>
          <Button type="button" variant="outline" size="sm" onClick={addSchedule}>
            + Thêm khung giờ
          </Button>
        </div>
        
        {(form.schedules || []).map((s, i) => (
          <div key={i} className="flex items-center gap-3 bg-surface-secondary p-2 rounded-xl">
            <Select
              options={[2, 3, 4, 5, 6, 7, 1].map((d) => ({ value: String(d), label: dayNames[d] }))}
              value={String(s.day_of_week)}
              onChange={(e) => updateSchedule(i, 'day_of_week', Number(e.target.value))}
              className="flex-1"
            />
            <Select
              options={timeSlotOptions}
              value={s.time_slot || ''}
              onChange={(e) => updateSchedule(i, 'time_slot', e.target.value || undefined)}
              className="flex-1"
            />
            <button type="button" onClick={() => removeSchedule(i)} className="text-text-tertiary hover:text-danger-500 p-2">✕</button>
          </div>
        ))}
      </form>
    </Modal>
  );
}

/* ── Send Request Modal (1-1 Tutoring) ───────────── */
interface SendRequestModalProps {
  open: boolean;
  onClose: () => void;
  tutor: RecommendedTutor['tutor'];
  activeNeed: LearningNeedResponse | null;
  onCreated: () => void;
  toast: (type: 'success' | 'error', msg: string) => void;
}

function SendRequestModal({
  open,
  onClose,
  tutor,
  activeNeed,
  onCreated,
  toast,
}: SendRequestModalProps) {
  const [loading, setLoading] = useState(false);
  const [subjectId, setSubjectId] = useState<number>(tutor.subjects[0]?.subject_id || 0);
  const [requestedSessions, setRequestedSessions] = useState<number>(10);
  const [mode, setMode] = useState<string>('ONLINE');
  const [goal, setGoal] = useState<string>(activeNeed?.goal || '');

  // Find the selected subject details to obtain grade_level
  const selectedSubject = tutor.subjects.find((s) => s.subject_id === subjectId);
  const gradeLevel = selectedSubject?.grade_level || '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) {
      toast('error', 'Vui lòng chọn môn học');
      return;
    }
    setLoading(true);
    try {
      await privateRequestApi.create({
        tutor_id: tutor.id,
        learning_need_id: activeNeed?.id || undefined,
        subject_id: subjectId,
        grade_level: gradeLevel,
        goal,
        requested_sessions: requestedSessions,
        mode: mode as any,
      });
      toast('success', 'Đã gửi yêu cầu học 1-1 thành công!');
      onCreated();
    } catch (err) {
      toast('error', 'Không thể gửi yêu cầu: ' + (err as any).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Gửi yêu cầu học 1-1 đến gia sư ${tutor.full_name}`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Hủy</Button>
          <Button onClick={handleSubmit} loading={loading}>Gửi yêu cầu</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-text-secondary mb-1">Môn học đăng ký</label>
          <Select
            value={subjectId}
            onChange={(e) => setSubjectId(Number(e.target.value))}
            required
          >
            {tutor.subjects.map((s) => (
              <option key={s.id} value={s.subject_id}>
                {s.subject_name} - {s.grade_level} ({toCurrency(s.fee_per_session)}/buổi)
              </option>
            ))}
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Số buổi học dự kiến</label>
            <Input
              type="number"
              min={1}
              value={requestedSessions}
              onChange={(e) => setRequestedSessions(Number(e.target.value))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Hình thức học</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="ONLINE">Trực tuyến (Online)</option>
              <option value="OFFLINE">Trực tiếp (Offline)</option>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-text-secondary mb-1">Mục tiêu học tập của bạn</label>
          <Textarea
            rows={4}
            placeholder="Mô tả chi tiết mục tiêu của bạn để gia sư chuẩn bị tốt hơn..."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>
      </form>
    </Modal>
  );
}
