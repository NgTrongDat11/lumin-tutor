import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  classApi,
  learningNeedApi,
  recommendationApi,
  subjectApi,
  tutorApi,
  privateRequestApi,
  messageApi,
  extractErrorMessage,
} from '../../services/api';
import type {
  CourseClassResponse,
  RecommendedClass,
  RecommendedTutor,
  RecommendationResponse,
  SubjectResponse,
  TutorPublicResponse,
  PrivateRequestResponse,
  LearningNeedCreate,
  LearningNeedResponse,
  LearningNeedScheduleCreate,
} from '../../types';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import { getStatusBadge } from '../../components/ui/Badge';
import { StudentDashboardSkeleton } from '../../components/ui/Skeleton';
import Avatar from '../../components/ui/Avatar';
import Input from '../../components/ui/Input';
import Select from '../../components/ui/Select';
import Textarea from '../../components/ui/Textarea';
import { useToast } from '../../components/ui/Toast';
import {
  BookOpenIcon,
  CalendarIcon,
  CheckCircleIcon,
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
  | { type: 'RECOMMENDED_CLASS'; data: RecommendedClass }
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
      label: 'Trực tuyến',
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
    detail: course.location ? `Trực tuyến hoặc ${course.location}` : 'Trực tuyến hoặc trực tiếp',
    classes: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  };
}

function getTeachingModeLabel(mode: string | null | undefined) {
  if (mode === 'ONLINE') return 'Trực tuyến';
  if (mode === 'OFFLINE') return 'Trực tiếp';
  return 'Linh hoạt';
}

function getCourseTotalFee(course: CourseClassResponse) {
  return Number(course.fee_per_session_per_student || 0) * course.total_sessions;
}

function getMatchScoreNumber(score: string | number | null | undefined) {
  const value = Number(score || 0);
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getMatchScoreMeta(score: string | number | null | undefined) {
  const percent = getMatchScoreNumber(score);

  if (percent >= 80) {
    return {
      percent,
      label: 'Rất phù hợp',
      description: 'Khớp hầu hết tiêu chí chính trong nhu cầu học.',
      badgeClass: 'border-emerald-200 bg-emerald-700 text-white',
      softClass: 'border-emerald-100 bg-emerald-50 text-emerald-900',
      barClass: 'bg-emerald-600',
    };
  }

  if (percent >= 60) {
    return {
      percent,
      label: 'Phù hợp',
      description: 'Khớp nhiều tiêu chí, vẫn nên kiểm tra thêm lịch và chi phí.',
      badgeClass: 'border-primary-200 bg-primary-700 text-white',
      softClass: 'border-primary-100 bg-primary-50 text-primary-900',
      barClass: 'bg-primary-600',
    };
  }

  if (percent >= 40) {
    return {
      percent,
      label: 'Cần cân nhắc',
      description: 'Có tiêu chí khớp, nhưng còn dữ liệu hoặc điều kiện cần xác nhận.',
      badgeClass: 'border-amber-200 bg-amber-100 text-amber-800',
      softClass: 'border-amber-100 bg-amber-50 text-amber-900',
      barClass: 'bg-amber-500',
    };
  }

  return {
    percent,
    label: 'Ít phù hợp',
    description: 'Chỉ khớp một phần nhỏ tiêu chí hiện tại.',
    badgeClass: 'border-border-light bg-surface-secondary text-text-secondary',
    softClass: 'border-border-light bg-surface-secondary text-text-secondary',
    barClass: 'bg-text-tertiary',
  };
}

function getScoreSignals(score: string | number | null | undefined, reasons: string[]) {
  const text = reasons.join(' ').toLowerCase();
  const missingSignals: string[] = [];

  if (!/(ngân sách|học phí|phí|giá|budget|fee)/i.test(text)) {
    missingSignals.push('Chưa thấy tiêu chí ngân sách được chấm rõ');
  }
  if (!/(lịch|thời gian|buổi|rảnh|schedule|slot)/i.test(text)) {
    missingSignals.push('Chưa thấy lịch rảnh khớp rõ');
  }
  if (!/(hình thức|trực tuyến|trực tiếp|online|offline|khu vực|mode)/i.test(text)) {
    missingSignals.push('Cần kiểm tra thêm hình thức hoặc khu vực học');
  }

  if (getMatchScoreNumber(score) >= 80 && missingSignals.length === 0) {
    missingSignals.push('Không có tiêu chí yếu nổi bật trong dữ liệu gợi ý');
  }

  if (missingSignals.length === 0) {
    missingSignals.push('Một số tiêu chí phụ chưa đủ dữ liệu để nâng điểm');
  }

  return {
    positive: reasons.length > 0 ? reasons : ['Hệ thống đã có dữ liệu gợi ý nhưng chưa trả về lý do chi tiết'],
    missing: missingSignals,
  };
}

function MatchScoreBadge({ score }: { score: string | number | null | undefined }) {
  const meta = getMatchScoreMeta(score);

  return (
    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
      <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${meta.badgeClass}`}>
        {meta.percent.toFixed(0)}% phù hợp
      </span>
      <span className="text-[11px] font-bold uppercase tracking-wide text-text-tertiary">{meta.label}</span>
    </div>
  );
}

function ScoreExplanationPanel({
  score,
  reasons,
  compact,
}: {
  score: string | number | null | undefined;
  reasons: string[];
  compact?: boolean;
}) {
  const meta = getMatchScoreMeta(score);
  const signals = getScoreSignals(score, reasons);
  const positiveReasons = signals.positive.slice(0, compact ? 3 : 5);
  const missingReasons = signals.missing.slice(0, compact ? 2 : 3);

  return (
    <div className={`rounded-xl border p-3 ${meta.softClass}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-text-primary">Vì sao ra {meta.percent.toFixed(0)}%?</p>
          <p className="mt-1 text-xs leading-5 text-text-secondary">{meta.description}</p>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/80 sm:w-32">
          <div className={`h-full rounded-full ${meta.barClass}`} style={{ width: `${meta.percent}%` }} />
        </div>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-tertiary">Điểm cộng</p>
          <div className="space-y-1">
            {positiveReasons.map((reason, index) => (
              <p key={`${reason}-${index}`} className="flex gap-2 text-xs leading-5 text-text-secondary">
                <CheckCircleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary-600" />
                <span>{reason}</span>
              </p>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-text-tertiary">Cần kiểm tra</p>
          <div className="space-y-1">
            {missingReasons.map((reason, index) => (
              <p key={`${reason}-${index}`} className="flex gap-2 text-xs leading-5 text-text-secondary">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-text-tertiary" />
                <span>{reason}</span>
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function getModeLabel(mode: string | null | undefined) {
  if (mode === 'ONLINE') return 'Trực tuyến';
  if (mode === 'OFFLINE') return 'Trực tiếp';
  return 'Linh hoạt';
}

function getLearningTypeLabel(type: string | null | undefined) {
  if (type === 'PRIVATE') return 'Gia sư 1-1';
  if (type === 'GROUP') return 'Lớp nhóm';
  return 'Cả lớp nhóm và 1-1';
}

function getTimeSlotLabel(slot: string | null | undefined) {
  if (slot === 'MORNING') return 'Sáng';
  if (slot === 'AFTERNOON') return 'Chiều';
  if (slot === 'EVENING') return 'Tối';
  return 'Cả ngày';
}

export default function StudentDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [subjects, setSubjects] = useState<SubjectResponse[]>([]);
  const [classes, setClasses] = useState<CourseClassResponse[]>([]);
  const [browseTutors, setBrowseTutors] = useState<TutorPublicResponse[]>([]);
  const [learningNeeds, setLearningNeeds] = useState<LearningNeedResponse[]>([]);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [activeNeed, setActiveNeed] = useState<LearningNeedResponse | null>(null);
  
  const [searchDraft, setSearchDraft] = useState('');
  const [submittedSearch, setSubmittedSearch] = useState('');
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

  const fetchRecommendation = async (need: LearningNeedResponse) => {
    setActiveNeed(need);
    setRecommendation(null);
    setActiveTab('RECOMMENDATION');
    setRecLoading(true);
    try {
      const rec = await recommendationApi.forNeed(need.id);
      setRecommendation(rec);
    } catch {
      toast('error', 'Không thể tải kết quả gợi ý.');
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
      setClasses(c.filter((course) => !course.private_request_id));
      setSubjects(s);
      setBrowseTutors(t);
      setLearningNeeds(n);

      const firstActiveNeed = n.find((need) => need.status === 'ACTIVE') ?? n[0] ?? null;
      setActiveNeed((current) => current ? n.find((need) => need.id === current.id) ?? firstActiveNeed : firstActiveNeed);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const queryFromUrl = searchParams.get('search') || '';
    setSearchDraft(queryFromUrl);
    setSubmittedSearch(queryFromUrl);
  }, [searchParams]);

  const normalizedQuery = submittedSearch.trim().toLowerCase();
  const recommendedTutors = useMemo(() => recommendation?.recommended_tutors ?? [], [recommendation]);
  const recommendedClasses = useMemo(() => recommendation?.recommended_classes ?? [], [recommendation]);
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

  const recommendationClassResults = useMemo(() => {
    return recommendedClasses.filter((rec) => {
      const course = rec.course_class;
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
    });
  }, [recommendedClasses, normalizedQuery, modeFilter, subjectFilter]);

  const visibleClasses = activeTab === 'ALL' || activeTab === 'CLASS' ? classResults : [];
  const visibleRecommendedClasses = activeTab === 'RECOMMENDATION' ? recommendationClassResults : [];
  const visibleTutors = (activeTab === 'ALL' || activeTab === 'TUTOR' || activeTab === 'RECOMMENDATION') ? tutorResults : [];
  const pagedClasses = visibleClasses.slice(0, classPage * PAGE_SIZE);
  const pagedRecommendedClasses = visibleRecommendedClasses.slice(0, classPage * PAGE_SIZE);
  const pagedTutors = visibleTutors.slice(0, tutorPage * PAGE_SIZE);
  const hasMoreClasses = visibleClasses.length > pagedClasses.length;
  const hasMoreRecommendedClasses = visibleRecommendedClasses.length > pagedRecommendedClasses.length;
  const hasMoreTutors = visibleTutors.length > pagedTutors.length;
  const hasRecommendationResults = visibleRecommendedClasses.length > 0 || visibleTutors.length > 0;
  const hasResults = visibleClasses.length > 0 || visibleTutors.length > 0 || visibleRecommendedClasses.length > 0 || (activeTab === 'RECOMMENDATION' && recLoading);

  const submitSearch = (event?: React.FormEvent) => {
    event?.preventDefault();
    const nextQuery = searchDraft.trim();
    setSubmittedSearch(nextQuery);
    const nextParams = new URLSearchParams(searchParams);
    if (nextQuery) {
      nextParams.set('search', nextQuery);
    } else {
      nextParams.delete('search');
    }
    setSearchParams(nextParams, { replace: true });
    if (activeTab === 'RECOMMENDATION' && !recommendation) {
      setActiveTab('ALL');
    }
  };

  const clearSearch = () => {
    setSearchDraft('');
    setSubmittedSearch('');
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('search');
    setSearchParams(nextParams, { replace: true });
  };

  if (loading) return <StudentDashboardSkeleton />;

  return (
    <div className="mx-auto w-full animate-slide-up space-y-6 md:space-y-8">
      {/* Recommendation banner */}
      <section className="relative overflow-hidden rounded-xl bg-primary-950 text-white shadow-lg">
        <img src={dashboardHero} alt="" className="absolute inset-0 h-full w-full object-cover opacity-30" />
        <div className="relative z-10 grid gap-5 p-5 md:gap-8 md:p-8 lg:grid-cols-[1.05fr_0.95fr] lg:p-10">
          <div className="max-w-2xl">
            <h1 className="text-xl font-bold leading-snug tracking-tight md:text-4xl">
              Khám phá lớp học và gợi ý thông minh trong một luồng rõ ràng.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-white/70 md:text-base">
              Tìm thủ công khi bạn đã biết mình cần gì, hoặc tạo cấu hình để hệ thống chấm điểm theo môn học, cấp lớp, ngân sách, hình thức và lịch rảnh.
            </p>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap md:mt-7">
              <Button size="lg" className="w-full border-none bg-white font-semibold !text-primary-950 hover:bg-white/90 sm:w-auto" onClick={() => setShowSmartMatch(true)}>
                Tạo cấu hình và nhận gợi ý
              </Button>
              {activeNeed && (
                <Button
                  size="lg"
                  variant="outline"
                  className="hidden border-white/15 !text-white/80 hover:bg-white/5 sm:inline-flex"
                  onClick={() => {
                    setRecommendation(null);
                    setActiveTab('RECOMMENDATION');
                  }}
                >
                  Xem lại cấu hình gợi ý
                </Button>
              )}
            </div>
            <div className="mt-5 grid grid-cols-3 gap-2 sm:hidden">
              <SmartMatchStepCompact index="1" title="Cấu hình" />
              <SmartMatchStepCompact index="2" title="Tiêu chí" />
              <SmartMatchStepCompact index="3" title="Lý do" />
            </div>
          </div>
          <div className="hidden rounded-xl border border-white/12 bg-white/10 p-4 backdrop-blur-md sm:block">
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <SmartMatchStep index="1" title="Tạo cấu hình" desc="Chọn môn, mục tiêu, hình thức, ngân sách và lịch rảnh." />
              <SmartMatchStep index="2" title="Xem tiêu chí" desc="Bạn thấy hệ thống đang dùng dữ liệu nào để so khớp." />
              <SmartMatchStep index="3" title="Đọc lý do" desc="Mỗi kết quả có điểm phù hợp và các lý do cụ thể." />
            </div>
          </div>
        </div>
      </section>

      {/* Search Bar */}
      <section className="rounded-xl border border-border-light bg-white p-3 shadow-xs sm:p-4">
        <form onSubmit={submitSearch} className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex flex-1 items-center gap-3 rounded-lg border border-border-light bg-surface-secondary px-4 py-3 transition-all focus-within:border-primary-300 focus-within:ring-2 focus-within:ring-primary-100">
          <SearchIcon className="h-6 w-6 shrink-0 text-text-tertiary" />
          <input
            value={searchDraft}
            onChange={(event) => setSearchDraft(event.target.value)}
            placeholder="Tìm trực tiếp Toán, IELTS, tên gia sư..."
            className="min-w-0 flex-1 bg-transparent text-base font-medium outline-none placeholder:text-text-tertiary"
          />
          {(searchDraft || submittedSearch) && (
            <button
              type="button"
              onClick={clearSearch}
              className="text-xs font-semibold text-text-tertiary hover:text-text-primary px-2"
            >
              XÓA
            </button>
          )}
          </div>
          <Button type="submit" className="w-full md:min-w-[128px] md:w-auto">Tìm kiếm</Button>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-medium text-text-tertiary">
          {submittedSearch ? (
            <span className="rounded-full bg-primary-50 px-3 py-1 text-primary-700">Đang áp dụng: "{submittedSearch}"</span>
          ) : (
            <span>Danh sách chưa bị lọc theo từ khóa. Nhập xong rồi bấm Tìm kiếm để áp dụng.</span>
          )}
          {searchDraft.trim() !== submittedSearch && searchDraft.trim() && (
            <span className="rounded-full bg-warning-50 px-3 py-1 text-warning-700">Từ khóa mới chưa áp dụng</span>
          )}
        </div>
        <div className="mt-4 grid gap-3 lg:grid-cols-[auto_1fr_auto] lg:items-start">
          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Hình thức</p>
            <div className="flex max-w-full overflow-x-auto rounded-xl border border-border bg-surface-secondary p-1">
              {(['ALL', 'ONLINE', 'OFFLINE'] as ModeFilter[]).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setModeFilter(mode)}
                  className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition-all ${
                    modeFilter === mode
                      ? 'bg-white text-text-primary shadow-sm'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {mode === 'ALL' ? 'Mọi hình thức' : mode === 'ONLINE' ? 'Trực tuyến' : 'Trực tiếp'}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-bold uppercase tracking-wide text-text-tertiary">Môn học</p>
            <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {visibleSubjectFilters.map((subject) => (
                <button
                  key={subject.id}
                  type="button"
                  onClick={() => setSubjectFilter((current) => current === subject.id ? null : subject.id)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
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

      <section className="grid gap-3 md:grid-cols-2">
        <article className="rounded-xl border border-border-light bg-white p-4 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-600">Lớp nhóm</p>
          <h3 className="mt-2 font-semibold text-text-primary">Đăng ký lớp đã được trung tâm mở</h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Bạn chọn lớp có sẵn, gửi đăng ký, trung tâm duyệt trước khi thanh toán và xếp lịch.
          </p>
        </article>
        <article className="rounded-xl border border-primary-100 bg-primary-50 p-4 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Học 1-1</p>
          <h3 className="mt-2 font-semibold text-text-primary">Gửi yêu cầu riêng cho gia sư</h3>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Bạn không tạo lớp mới. Bạn chọn gia sư, gửi yêu cầu, trao đổi trong tin nhắn, rồi thanh toán khi gia sư xác nhận.
          </p>
        </article>
      </section>

      {/* Tabs */}
      <section className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-text-primary">
            {activeTab === 'RECOMMENDATION' ? 'Gợi ý thông minh' : 'Tìm lớp nhóm hoặc gia sư 1-1'}
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            {activeTab === 'RECOMMENDATION'
              ? 'Chọn một cấu hình để xem hệ thống chấm điểm và lý do phù hợp.'
              : submittedSearch ? `Đang hiển thị kết quả cho "${submittedSearch}".` : 'Lớp nhóm là đăng ký lớp có sẵn; gia sư 1-1 là gửi yêu cầu riêng để trao đổi.'}
          </p>
        </div>

        <div className="custom-scrollbar flex w-full max-w-full overflow-x-auto rounded-full border border-border bg-white p-1 shadow-sm md:w-auto">
          {([
            ['ALL', `Tất cả`],
            ['CLASS', `Lớp nhóm`],
            ['TUTOR', `Học 1-1`],
            ['RECOMMENDATION', `Gợi ý của tôi`],
          ] as [ResultTab, string][]).map(([tab, label]) => {
            if (tab === 'RECOMMENDATION' && learningNeeds.length === 0) return null;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  if (tab === 'RECOMMENDATION') setRecommendation(null);
                  setActiveTab(tab);
                }}
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
      {activeTab === 'RECOMMENDATION' && !recLoading && !recommendation ? (
        <RecommendationWorkspace
          needs={learningNeeds}
          activeNeed={activeNeed}
          subjects={subjects}
          onCreate={() => setShowSmartMatch(true)}
          onRun={(need) => void fetchRecommendation(need)}
        />
      ) : activeTab === 'RECOMMENDATION' && recLoading ? (
        <Card padding="lg" className="text-center bg-white py-16">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full border-4 border-primary-200 border-t-primary-600 animate-spin" />
          <p className="text-sm font-semibold text-text-secondary">Đang so khớp cấu hình với gia sư và lớp đang mở...</p>
          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-text-tertiary">Hệ thống đang lọc theo môn học, hình thức học, ngân sách, lịch rảnh, đánh giá và kinh nghiệm rồi sắp xếp theo điểm phù hợp.</p>
        </Card>
      ) : activeTab === 'RECOMMENDATION' && recommendation && !hasRecommendationResults ? (
        <RecommendationResultsShell activeNeed={activeNeed} subjects={subjects} recommendation={recommendation}>
          <Card padding="lg" className="border-dashed border-2 text-center bg-white py-12">
            <h3 className="text-xl font-bold text-text-primary">Chưa có kết quả phù hợp với bộ lọc hiện tại</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
              Thử xóa từ khóa, nới hình thức học hoặc tạo cấu hình mới với tiêu chí rộng hơn.
            </p>
          </Card>
        </RecommendationResultsShell>
      ) : !hasResults ? (
        <Card padding="lg" className="border-dashed border-2 text-center bg-transparent py-16">
          <div className="mx-auto w-16 h-16 rounded-full bg-surface-secondary flex items-center justify-center mb-4">
            <SearchIcon className="h-8 w-8 text-text-tertiary" />
          </div>
          <h3 className="text-xl font-bold text-text-primary">Chưa tìm thấy kết quả</h3>
          <p className="mt-2 text-sm text-text-secondary max-w-sm mx-auto">
            Hãy thử đổi từ khóa hoặc dùng tính năng gợi ý thông minh để hệ thống tự động tìm kiếm cho bạn.
          </p>
        </Card>
      ) : (
        <div className="space-y-10">
          {activeTab === 'RECOMMENDATION' && recommendation && (
            <RecommendationResultsShell activeNeed={activeNeed} subjects={subjects} recommendation={recommendation}>
              <div className="space-y-8">
                {visibleRecommendedClasses.length > 0 && (
                  <section>
                    <div className="mb-5 flex items-center justify-between">
                      <h3 className="text-xl font-bold text-text-primary">Lớp nhóm được gợi ý ({visibleRecommendedClasses.length})</h3>
                    </div>
                    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                      {pagedRecommendedClasses.map((rec) => (
                        <RecommendedClassCard
                          key={rec.course_class.id}
                          rec={rec}
                          subjectName={subjectNameById.get(rec.course_class.subject_id)}
                          tutorProfile={rec.course_class.primary_tutor_id ? tutorRecById.get(rec.course_class.primary_tutor_id)?.tutor : undefined}
                          onOpen={() => setDetailTarget({ type: 'RECOMMENDED_CLASS', data: rec })}
                          onOpenTutor={() => openTutorProfile(rec.course_class.primary_tutor_id)}
                        />
                      ))}
                    </div>
                    {hasMoreRecommendedClasses && (
                      <div className="mt-6 text-center">
                        <Button variant="outline" className="px-8" onClick={() => setClassPage((page) => page + 1)}>
                          Xem thêm {visibleRecommendedClasses.length - pagedRecommendedClasses.length} lớp học
                        </Button>
                      </div>
                    )}
                  </section>
                )}
              </div>
            </RecommendationResultsShell>
          )}

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

      {/* Recommendation modal */}
      <CreateNeedModal
        open={showSmartMatch}
        onClose={() => setShowSmartMatch(false)}
        subjects={subjects}
        onCreated={(need) => {
          setShowSmartMatch(false);
          setLearningNeeds((current) => [need, ...current.filter((item) => item.id !== need.id)]);
          void fetchRecommendation(need);
          void loadData();
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
          onCreated={async (request) => {
            const thread = await messageApi.ensureThread({
              private_request_id: request.id,
              title: `Yêu cầu 1-1 với ${tutorForRequest.tutor.full_name}`,
            }).catch(() => undefined);
            setTutorForRequest(null);
            if (thread) {
              navigate(`/student/messages?threadId=${thread.id}`);
            }
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
            const registration = await classApi.register(classId, { learning_need_id: activeNeed?.id });
            await messageApi.ensureThread({
              class_registration_id: registration.id,
              title: 'Trao đổi về đăng ký lớp nhóm',
            }).catch(() => undefined);
            toast('success', 'Đã gửi đăng ký lớp nhóm. Trung tâm sẽ xác nhận trước bước thanh toán.');
            setDetailTarget(null);
          } catch (err: any) {
            toast('error', 'Đăng ký thất bại: ' + extractErrorMessage(err));
          }
        }}
      />
    </div>
  );
}

function SmartMatchStep({ index, title, desc }: { index: string; title: string; desc: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-white/10 bg-white/8 p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-extrabold text-primary-950">
        {index}
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="mt-1 text-xs leading-5 text-white/62">{desc}</p>
      </div>
    </div>
  );
}

function SmartMatchStepCompact({ index, title }: { index: string; title: string }) {
  return (
    <div className="rounded-lg border border-white/12 bg-white/10 px-2 py-2 text-center backdrop-blur-md">
      <div className="mx-auto flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-extrabold text-primary-950">
        {index}
      </div>
      <p className="mt-1 text-[11px] font-bold leading-tight text-white/85">{title}</p>
    </div>
  );
}

function getSubjectName(subjects: SubjectResponse[], subjectId: number | null | undefined) {
  return subjects.find((subject) => subject.id === subjectId)?.name || 'Chưa chọn môn';
}

function NeedCriteria({ need, subjects }: { need: LearningNeedResponse; subjects: SubjectResponse[] }) {
  const scheduleText = need.schedules.length > 0
    ? need.schedules.map((schedule) => `${dayNames[schedule.day_of_week]} ${getTimeSlotLabel(schedule.time_slot)}`).join(', ')
    : 'Chưa giới hạn lịch';
  const budgetText = need.budget_per_session_max
    ? `Tối đa ${toCurrency(need.budget_per_session_max)} / buổi`
    : 'Chưa giới hạn ngân sách';

  return (
    <div className="flex flex-wrap gap-2">
      {[
        getSubjectName(subjects, need.subject_id),
        need.grade_level || 'Chưa nêu cấp lớp',
        getModeLabel(need.preferred_mode),
        getLearningTypeLabel(need.preferred_learning_type),
        budgetText,
        scheduleText,
      ].map((item) => (
        <span key={item} className="rounded-full border border-border-light bg-white px-3 py-1 text-xs font-semibold text-text-secondary">
          {item}
        </span>
      ))}
    </div>
  );
}

function RecommendationWorkspace({
  needs,
  activeNeed,
  subjects,
  onCreate,
  onRun,
}: {
  needs: LearningNeedResponse[];
  activeNeed: LearningNeedResponse | null;
  subjects: SubjectResponse[];
  onCreate: () => void;
  onRun: (need: LearningNeedResponse) => void;
}) {
  return (
    <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
      <Card padding="lg" className="bg-white">
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-xl font-bold tracking-tight text-text-primary">Chọn cấu hình để nhận gợi ý</h3>
            <p className="mt-1 text-sm leading-6 text-text-secondary">
              Mỗi cấu hình là một bộ tiêu chí riêng. Chọn đúng cấu hình trước khi chạy lại thuật toán.
            </p>
          </div>
          <Button onClick={onCreate}>Tạo cấu hình mới</Button>
        </div>

        {needs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-surface-secondary p-8 text-center">
            <h4 className="font-bold text-text-primary">Bạn chưa có cấu hình học tập</h4>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">
              Tạo cấu hình để hệ thống có dữ liệu so khớp thay vì chỉ duyệt danh sách thủ công.
            </p>
            <div className="mt-4">
              <Button onClick={onCreate}>Tạo cấu hình</Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {needs.map((need) => {
              const active = activeNeed?.id === need.id;
              return (
                <article
                  key={need.id}
                  className={`rounded-lg border p-4 transition-all ${
                    active ? 'border-primary-300 bg-primary-50/60 shadow-sm' : 'border-border-light bg-white hover:border-primary-200'
                  }`}
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h4 className="font-bold text-text-primary">
                          {getSubjectName(subjects, need.subject_id)} {need.grade_level ? `· ${need.grade_level}` : ''}
                        </h4>
                        {active && (
                          <span className="rounded-full bg-primary-100 px-2.5 py-1 text-xs font-bold text-primary-700">Đang chọn</span>
                        )}
                      </div>
                      {need.goal && <p className="mt-2 line-clamp-2 text-sm leading-6 text-text-secondary">{need.goal}</p>}
                    </div>
                    <Button size="sm" onClick={() => onRun(need)}>
                      Nhận gợi ý
                    </Button>
                  </div>
                  <div className="mt-3">
                    <NeedCriteria need={need} subjects={subjects} />
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Card padding="lg" className="bg-white">
        <div className="mb-5">
          <h3 className="text-xl font-bold tracking-tight text-text-primary">Gợi ý thông minh chấm điểm như thế nào?</h3>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Hệ thống lọc ứng viên không phù hợp trước, sau đó cộng điểm theo từng tiêu chí.
          </p>
        </div>
        <div className="space-y-3">
          {[
            ['Môn học', '30 điểm', 'Bắt buộc khớp môn khi cấu hình có môn học.'],
            ['Cấp lớp', '15 điểm', 'Ưu tiên gia sư/lớp có cấp học gần mục tiêu.'],
            ['Ngân sách', '15 điểm', 'Ưu tiên học phí nằm trong mức bạn khai báo.'],
            ['Lịch rảnh', '15 điểm', 'So lịch mong muốn với lịch rảnh của gia sư.'],
            ['Hình thức', '10 điểm', 'Trực tuyến, trực tiếp hoặc linh hoạt.'],
            ['Đánh giá và kinh nghiệm', '15 điểm', 'Cộng thêm theo điểm đánh giá, số lượt đánh giá và năm kinh nghiệm.'],
          ].map(([label, value, desc]) => (
            <div key={label} className="flex gap-3 rounded-lg border border-border-light bg-surface-secondary p-3">
              <CheckCircleIcon className="mt-0.5 h-5 w-5 shrink-0 text-primary-700" />
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold text-text-primary">{label}</p>
                  <span className="shrink-0 text-xs font-extrabold text-primary-700">{value}</span>
                </div>
                <p className="mt-1 text-xs leading-5 text-text-secondary">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </section>
  );
}

function RecommendationResultsShell({
  activeNeed,
  subjects,
  recommendation,
  children,
}: {
  activeNeed: LearningNeedResponse | null;
  subjects: SubjectResponse[];
  recommendation: RecommendationResponse;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-5">
      <div className="rounded-xl border border-primary-100 bg-white p-5 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-700">Kết quả gợi ý</p>
            <h3 className="mt-2 text-2xl font-bold tracking-tight text-text-primary">
              {activeNeed ? `${getSubjectName(subjects, activeNeed.subject_id)} ${activeNeed.grade_level ? `· ${activeNeed.grade_level}` : ''}` : 'Kết quả gợi ý'}
            </h3>
            {activeNeed?.goal && <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{activeNeed.goal}</p>}
            {activeNeed && (
              <div className="mt-4">
                <NeedCriteria need={activeNeed} subjects={subjects} />
              </div>
            )}
          </div>
          <div className="grid min-w-[220px] grid-cols-2 gap-2">
            <div className="rounded-lg border border-border-light bg-surface-secondary p-3 text-center">
              <p className="text-2xl font-extrabold text-text-primary">{recommendation.recommended_classes.length}</p>
              <p className="text-xs font-semibold text-text-tertiary">Lớp nhóm</p>
            </div>
            <div className="rounded-lg border border-border-light bg-surface-secondary p-3 text-center">
              <p className="text-2xl font-extrabold text-text-primary">{recommendation.recommended_tutors.length}</p>
              <p className="text-xs font-semibold text-text-tertiary">Gia sư 1-1</p>
            </div>
          </div>
        </div>
        <div className="mt-4 rounded-lg border border-border-light bg-surface-secondary p-3 text-xs leading-5 text-text-secondary">
          <strong className="text-text-primary">Cách đọc điểm:</strong> phần trăm là mức khớp tổng hợp từ môn/lớp, hình thức học, ngân sách, lịch rảnh và dữ liệu lớp hoặc gia sư. Mỗi thẻ có phần “Vì sao ra điểm này?” để thấy tiêu chí nào kéo điểm lên và tiêu chí nào cần kiểm tra thêm.
        </div>
      </div>
      {children}
    </section>
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

function RecommendedClassCard({
  rec,
  subjectName,
  tutorProfile,
  onOpen,
  onOpenTutor,
}: {
  rec: RecommendedClass;
  subjectName?: string;
  tutorProfile?: TutorPublicResponse;
  onOpen: () => void;
  onOpenTutor: () => void;
}) {
  const course = rec.course_class;
  const modeMeta = getClassModeMeta(course);
  const totalFee = getCourseTotalFee(course);

  return (
    <article className="group flex h-full cursor-pointer flex-col rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg sm:p-5" onClick={onOpen}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-bold uppercase tracking-[0.14em] text-primary-600">
            {subjectName || 'Lớp nhóm'} · {course.grade_level}
          </p>
          <h4 className="line-clamp-2 text-lg font-bold leading-snug text-text-primary group-hover:text-primary-800">
            {course.title}
          </h4>
        </div>
        <MatchScoreBadge score={rec.score} />
      </div>

      <div className="space-y-2 rounded-lg border border-border-light bg-surface-secondary p-3">
        <p className="flex items-center gap-2 text-sm font-medium text-text-secondary">
          <CalendarIcon className="h-4 w-4 shrink-0 text-primary-600" />
          <span>{course.total_sessions} buổi · {modeMeta.detail}</span>
        </p>
        {course.tutor_name && (
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium text-text-secondary">
              GV: <span className="font-bold text-text-primary">{course.tutor_name}</span>
            </p>
            {tutorProfile && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenTutor();
                }}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-bold text-primary-700 hover:bg-primary-50"
              >
                Hồ sơ
              </button>
            )}
          </div>
        )}
        <div className="flex items-end justify-between gap-3 border-t border-border-light pt-3">
          <p className="text-xl font-extrabold text-primary-800">{toCurrency(totalFee)}</p>
          <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${modeMeta.classes}`}>{modeMeta.label}</span>
        </div>
      </div>

      <div className="mt-4">
        <ScoreExplanationPanel score={rec.score} reasons={rec.reasons} compact />
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onOpen();
        }}
        className="mt-auto w-full rounded-lg border border-primary-100 bg-white px-3 py-2 text-sm font-bold text-primary-700 transition-colors hover:bg-primary-50"
      >
        Xem chi tiết lớp
      </button>
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
    <article className="flex h-full cursor-pointer flex-col rounded-xl border border-border bg-white p-4 shadow-sm transition-all hover:-translate-y-1 hover:border-primary-200 hover:shadow-lg sm:p-6" onClick={onOpen}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={rec.tutor.full_name} size="lg" shape="square" />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary-600 mb-1">Nhận yêu cầu 1-1</p>
            <h4 className="text-lg font-bold text-text-primary line-clamp-1">{rec.tutor.full_name}</h4>
            <p className="mt-1 text-xs font-bold text-text-tertiary">{modeLabel} · {rec.tutor.teaching_area || 'Chưa cập nhật khu vực'}</p>
          </div>
        </div>
        {isRecommendation && <MatchScoreBadge score={rec.score} />}
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
        
        {isRecommendation && <ScoreExplanationPanel score={rec.score} reasons={rec.reasons} compact />}

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

  if (target.type === 'CLASS' || target.type === 'RECOMMENDED_CLASS') {
    const recommendationItem = target.type === 'RECOMMENDED_CLASS' ? target.data : null;
    const course = target.type === 'RECOMMENDED_CLASS' ? target.data.course_class : target.data;
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

          {recommendationItem && (
            <div className="rounded-xl border border-border-light bg-white p-4">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary-700">Điểm phù hợp</p>
                  <p className="mt-1 text-sm leading-6 text-text-secondary">
                    Điểm được tính từ các tiêu chí trong nhu cầu học và dữ liệu lớp hiện có.
                  </p>
                </div>
                <MatchScoreBadge score={recommendationItem.score} />
              </div>
              <ScoreExplanationPanel score={recommendationItem.score} reasons={recommendationItem.reasons} />
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
          <InfoTile icon={UsersIcon} label="Trình độ" value={rec.tutor.qualification_level || 'Chưa cập nhật'} />
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

        {isRecommendation && (
          <div>
            <h4 className="text-sm font-bold text-text-primary mb-3">Vì sao gia sư này được gợi ý?</h4>
            <ScoreExplanationPanel score={rec.score} reasons={rec.reasons} />
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

/* ── Create Need Modal ───────────── */
function CreateNeedModal({
  open, onClose, subjects, onCreated, toast,
}: {
  open: boolean;
  onClose: () => void;
  subjects: SubjectResponse[];
  onCreated: (need: LearningNeedResponse) => void;
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
      const need = await learningNeedApi.create(form);
      toast('success', 'Đã khởi tạo hồ sơ gợi ý thành công!');
      onCreated(need);
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
      title="Khởi tạo hồ sơ gợi ý"
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
          <p>Hệ thống sẽ phân tích nhu cầu của bạn và so khớp với dữ liệu gia sư để tìm lựa chọn phù hợp nhất.</p>
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
              { value: 'ONLINE', label: 'Chỉ trực tuyến' },
              { value: 'OFFLINE', label: 'Chỉ trực tiếp' },
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
  onCreated: (request: PrivateRequestResponse) => void | Promise<void>;
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
  const initialSubjectId =
    tutor.subjects.find((s) => activeNeed?.subject_id && s.subject_id === activeNeed.subject_id)?.subject_id ||
    tutor.subjects[0]?.subject_id ||
    0;
  const shouldPrefillGoal = !activeNeed?.subject_id || activeNeed.subject_id === initialSubjectId;
  const [loading, setLoading] = useState(false);
  const [subjectId, setSubjectId] = useState<number>(initialSubjectId);
  const [requestedSessions, setRequestedSessions] = useState<number>(10);
  const [mode, setMode] = useState<string>('ONLINE');
  const [goal, setGoal] = useState<string>(shouldPrefillGoal ? activeNeed?.goal || '' : '');

  // Find the selected subject details to obtain grade_level
  const selectedSubject = tutor.subjects.find((s) => s.subject_id === subjectId);
  const gradeLevel = selectedSubject?.grade_level || '';
  const feePerSession = Number(selectedSubject?.fee_per_session || 0);
  const estimatedTotal = feePerSession * Math.max(requestedSessions || 0, 0);
  const subjectSummary = selectedSubject
    ? `${selectedSubject.subject_name || 'Môn học'} - ${selectedSubject.grade_level}`
    : 'môn gia sư đã được duyệt';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectId) {
      toast('error', 'Vui lòng chọn năng lực dạy muốn học 1-1');
      return;
    }
    setLoading(true);
    try {
      const request = await privateRequestApi.create({
        tutor_id: tutor.id,
        learning_need_id: activeNeed?.id || undefined,
        subject_id: subjectId,
        grade_level: gradeLevel,
        goal,
        requested_sessions: requestedSessions,
        mode: mode as any,
      });
      toast('success', 'Đã gửi yêu cầu học 1-1. Mở tin nhắn để trao đổi với gia sư.');
      await onCreated(request);
    } catch (err) {
      toast('error', 'Không thể gửi yêu cầu: ' + extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Mời ${tutor.full_name} dạy 1-1`}
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Hủy</Button>
          <Button onClick={handleSubmit} loading={loading}>Gửi lời mời và mở tin nhắn</Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-lg border border-primary-100 bg-primary-50 p-3">
          <p className="text-sm font-semibold text-primary-900">Đây là lời mời học riêng, chưa phải lớp học</p>
          <p className="mt-1 text-sm leading-6 text-primary-800">
            Học viên chọn một năng lực dạy đã được duyệt của gia sư để gửi yêu cầu 1-1. Lớp 1-1 chỉ được hệ thống tạo sau khi gia sư xác nhận lịch và học phí.
          </p>
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ['1', 'Gửi lời mời'],
            ['2', 'Nhắn tin chốt lịch'],
            ['3', 'Tạo buổi 1-1'],
          ].map(([step, label]) => (
            <div key={step} className="rounded-lg border border-border-light bg-surface-secondary p-3">
              <p className="text-xs font-bold text-primary-700">Bước {step}</p>
              <p className="mt-1 text-xs font-semibold text-text-secondary">{label}</p>
            </div>
          ))}
        </div>
        <div>
          <label className="block text-sm font-bold text-text-secondary mb-1">Năng lực dạy muốn mời học</label>
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
          <p className="mt-1 text-xs leading-5 text-text-tertiary">
            Danh sách này lấy từ môn gia sư đã đăng ký và được duyệt. Đây không phải lớp nhóm có sẵn.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
          <label className="block text-sm font-bold text-text-secondary mb-1">Số buổi học dự kiến</label>
            <Input
              type="number"
              min={1}
              value={requestedSessions}
              onChange={(e) => setRequestedSessions(Math.max(Number(e.target.value), 1))}
              required
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-text-secondary mb-1">Hình thức học</label>
            <Select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="ONLINE">Trực tuyến</option>
              <option value="OFFLINE">Trực tiếp</option>
            </Select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-text-secondary mb-1">Nội dung muốn trao đổi với gia sư</label>
          <Textarea
            rows={4}
            placeholder={`VD: Mình muốn học 1-1 ${subjectSummary}, cần trao đổi lịch học, mục tiêu và mức học phí phù hợp.`}
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
          />
        </div>

        <div className="rounded-lg border border-border-light bg-surface-secondary p-3 text-sm leading-6 text-text-secondary">
          Đơn giá tham khảo: <strong>{toCurrency(feePerSession)}/buổi</strong>. Tạm tính {requestedSessions || 0} buổi là <strong>{toCurrency(estimatedTotal)}</strong>. Hệ thống chỉ tạo khoản thanh toán sau khi gia sư xác nhận yêu cầu.
        </div>
      </form>
    </Modal>
  );
}
