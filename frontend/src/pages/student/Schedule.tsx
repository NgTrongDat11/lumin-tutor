import { useEffect, useState } from 'react';
import { scheduleApi } from '../../services/api';
import type { LearningSessionResponse } from '../../types';
import { PortalPage } from '../../components/portal/PortalPage';
import { PageLoading } from '../../components/ui/Spinner';
import { ClockIcon, ArrowRightIcon } from '../../components/ui/Icons';
import Button from '../../components/ui/Button';
import { SessionDetailModal } from '../../components/learning/SessionDetailModal';

// Utility functions for dates
function getStartOfWeek(date: Date) {
  const d = new Date(date);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPeriod(timeStr: string) {
  const [hours] = timeStr.split(':').map(Number);
  if (hours < 12) return 0; // Morning
  if (hours < 17 || (hours === 17 && timeStr < '17:30')) return 1; // Afternoon
  return 2; // Evening
}

const PERIODS = ['Sáng', 'Chiều', 'Tối'];
const DAYS = ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'];

export default function StudentSchedule() {
  const [sessions, setSessions] = useState<LearningSessionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(getStartOfWeek(new Date()));
  const [selectedSession, setSelectedSession] = useState<LearningSessionResponse | null>(null);

  useEffect(() => {
    scheduleApi.listSessions()
      .then((data) => setSessions(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageLoading />;

  // Navigate weeks
  const prevWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() - 7);
    setCurrentWeekStart(d);
  };
  const nextWeek = () => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + 7);
    setCurrentWeekStart(d);
  };
  const todayWeek = () => {
    setCurrentWeekStart(getStartOfWeek(new Date()));
  };

  // Build grid data for current week
  const weekEnd = new Date(currentWeekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);

  // Filter sessions in this week
  const weekSessions = sessions.filter(s => {
    const d = new Date(s.session_date);
    return d >= currentWeekStart && d <= weekEnd;
  });

  // grid[period][dayIndex] = array of sessions
  const grid: LearningSessionResponse[][][] = [
    [[], [], [], [], [], [], []], // Morning
    [[], [], [], [], [], [], []], // Afternoon
    [[], [], [], [], [], [], []], // Evening
  ];

  weekSessions.forEach(session => {
    const d = new Date(session.session_date);
    // JS getDay(): 0 is Sunday. We want 0=Monday, 6=Sunday.
    const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
    const period = getPeriod(session.start_time);
    grid[period][dayIndex].push(session);
  });

  // Helper to format dates for column headers
  const getDayHeader = (index: number) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + index);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };

  const isToday = (index: number) => {
    const d = new Date(currentWeekStart);
    d.setDate(d.getDate() + index);
    const today = new Date();
    return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear();
  };

  return (
    <PortalPage
      title="Thời khóa biểu"
      description="Xem và tham gia các buổi học theo lịch tuần của bạn."
    >
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white p-4 rounded-2xl shadow-sm border border-border-light">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={todayWeek}>Hôm nay</Button>
          <div className="flex items-center gap-2">
            <button onClick={prevWeek} className="p-2 rounded-lg hover:bg-surface-secondary transition-colors text-text-secondary">
              <ArrowRightIcon className="w-5 h-5 rotate-180" />
            </button>
            <span className="font-bold text-text-primary min-w-[200px] text-center">
              Tuần {currentWeekStart.getDate()}/{currentWeekStart.getMonth() + 1} - {weekEnd.getDate()}/{weekEnd.getMonth() + 1}
            </span>
            <button onClick={nextWeek} className="p-2 rounded-lg hover:bg-surface-secondary transition-colors text-text-secondary">
              <ArrowRightIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid Container (scrollable on mobile) */}
      <div className="bg-white rounded-2xl shadow-sm border border-border-light overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[900px]">
            {/* Grid Header */}
            <div className="grid grid-cols-[100px_repeat(7,1fr)] bg-surface-secondary border-b border-border-light">
              <div className="p-4 flex items-center justify-center border-r border-border-light font-medium text-text-secondary">
                Ca học
              </div>
              {DAYS.map((day, idx) => (
                <div key={day} className={`p-3 text-center border-r border-border-light last:border-r-0 ${isToday(idx) ? 'bg-primary-50' : ''}`}>
                  <div className={`font-bold ${isToday(idx) ? 'text-primary-600' : 'text-text-primary'}`}>{day}</div>
                  <div className={`text-sm mt-1 ${isToday(idx) ? 'text-primary-500 font-medium' : 'text-text-tertiary'}`}>
                    {getDayHeader(idx)}
                  </div>
                </div>
              ))}
            </div>

            {/* Grid Body */}
            {PERIODS.map((period, pIdx) => (
              <div key={period} className="grid grid-cols-[100px_repeat(7,1fr)] border-b border-border-light last:border-b-0">
                {/* Period Label */}
                <div className="p-4 flex items-center justify-center border-r border-border-light bg-surface-secondary/50 font-bold text-text-secondary">
                  {period}
                </div>

                {/* Days */}
                {DAYS.map((day, dIdx) => (
                  <div key={`${period}-${day}`} className={`p-2 border-r border-border-light last:border-r-0 min-h-[140px] ${isToday(dIdx) ? 'bg-primary-50/30' : ''}`}>
                    <div className="space-y-2">
                      {grid[pIdx][dIdx].map(session => (
                        <SessionBlock key={session.id} session={session} onClick={() => setSelectedSession(session)} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Session Detail Modal */}
      <SessionDetailModal session={selectedSession} onClose={() => setSelectedSession(null)} />
    </PortalPage>
  );
}

function SessionBlock({ session, onClick }: { session: LearningSessionResponse; onClick: () => void }) {
  const isPast = new Date(session.session_date) < new Date(new Date().setHours(0, 0, 0, 0));
  const isCancelled = session.status === 'CANCELLED' || session.status === 'NO_SHOW';

  return (
    <div
      onClick={onClick}
      className={`
        p-3 rounded-xl border flex flex-col gap-2 transition-all hover:shadow-md cursor-pointer
        ${isPast || isCancelled ? 'bg-surface-secondary border-border-light opacity-70' : 'bg-primary-50 border-primary-200 hover:border-primary-400'}
      `}
    >
      <div className="flex justify-between items-start">
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isPast ? 'bg-surface-tertiary text-text-secondary' : 'bg-primary-100 text-primary-700'}`}>
          Buổi {session.session_number}
        </span>
      </div>

      <h4 className={`font-bold text-sm leading-tight line-clamp-2 ${isPast ? 'text-text-secondary' : 'text-primary-900'}`}>
        {session.class_title || session.private_request_title || (session.private_request_id ? `Học 1-1` : `Buổi học #${session.session_number}`)}
      </h4>

      <div className={`flex items-center gap-1.5 text-xs font-medium ${isPast ? 'text-text-tertiary' : 'text-primary-700/80'}`}>
        <ClockIcon className="w-3.5 h-3.5" />
        <span>{session.start_time.slice(0, 5)} - {session.end_time.slice(0, 5)}</span>
      </div>
    </div>
  );
}
