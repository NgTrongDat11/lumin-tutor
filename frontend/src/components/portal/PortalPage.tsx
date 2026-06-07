import type { ComponentType, ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'neutral';

const toneClasses: Record<Tone, string> = {
  primary: 'bg-primary-50 text-primary-800 border-primary-100',
  success: 'bg-success-50 text-success-700 border-success-100',
  warning: 'bg-warning-50 text-warning-700 border-warning-100',
  danger: 'bg-danger-50 text-danger-600 border-danger-100',
  neutral: 'bg-surface-tertiary text-text-secondary border-border-light',
};

interface PortalPageProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function PortalPage({ title, description, actions, children, className = '' }: PortalPageProps) {
  return (
    <div className={`mx-auto max-w-7xl animate-slide-up space-y-6 ${className}`}>
      <div className="rounded-lg border border-border-light bg-white px-5 py-5 shadow-xs md:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tight text-text-primary md:text-3xl">{title}</h1>
            {description && <p className="mt-2 max-w-3xl text-sm leading-6 text-text-secondary">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
        </div>
      </div>
      {children}
    </div>
  );
}

interface MetricTileProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  tone?: Tone;
  href?: string;
}

export function MetricTile({ label, value, hint, icon: Icon, tone = 'primary', href }: MetricTileProps) {
  const content = (
    <div className="h-full rounded-lg border border-border-light bg-white p-4 shadow-xs transition-all duration-200 hover:border-primary-200 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg border ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
        {href && <span className="text-xs font-semibold text-primary-700">Mở</span>}
      </div>
      <p className="mt-4 text-2xl font-semibold tracking-tight text-text-primary">{value}</p>
      <p className="mt-1 text-sm font-semibold text-text-primary">{label}</p>
      {hint && <p className="mt-1 text-xs leading-5 text-text-tertiary">{hint}</p>}
    </div>
  );

  if (!href) return content;
  return <Link to={href}>{content}</Link>;
}

interface SectionPanelProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function SectionPanel({ title, description, action, children, className = '' }: SectionPanelProps) {
  return (
    <section className={`rounded-lg border border-border-light bg-white p-5 shadow-xs md:p-6 ${className}`}>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">{title}</h2>
          {description && <p className="mt-1 text-sm leading-6 text-text-secondary">{description}</p>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      {children}
    </section>
  );
}

interface SegmentedTabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  tabs: { value: T; label: string; count?: number }[];
}

export function SegmentedTabs<T extends string>({ value, onChange, tabs }: SegmentedTabsProps<T>) {
  return (
    <div className="flex w-full gap-1 overflow-x-auto rounded-lg border border-border-light bg-surface-secondary p-1">
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            type="button"
            onClick={() => onChange(tab.value)}
            className={`flex shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
              active
                ? 'bg-white text-text-primary shadow-xs'
                : 'text-text-secondary hover:bg-white/70 hover:text-text-primary'
            }`}
          >
            {tab.label}
            {typeof tab.count === 'number' && (
              <span className={`rounded-full px-2 py-0.5 text-xs ${active ? 'bg-primary-50 text-primary-700' : 'bg-white text-text-tertiary'}`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export interface WeekEvent {
  id: string | number;
  dayOfWeek: number;
  title: string;
  time: string;
  meta?: string;
  tone?: Tone;
}

const dayLabels = [
  { value: 2, label: 'T2' },
  { value: 3, label: 'T3' },
  { value: 4, label: 'T4' },
  { value: 5, label: 'T5' },
  { value: 6, label: 'T6' },
  { value: 7, label: 'T7' },
  { value: 1, label: 'CN' },
];

export function WeekPlanner({ events, emptyText = 'Chưa có lịch trong tuần.', maxEventsPerDay = 3 }: { events: WeekEvent[]; emptyText?: string; maxEventsPerDay?: number }) {
  return (
    <div className="grid gap-2 md:grid-cols-7">
      {dayLabels.map((day) => {
        const dayEvents = events.filter((event) => event.dayOfWeek === day.value);
        const visibleEvents = dayEvents.slice(0, maxEventsPerDay);
        const hiddenCount = Math.max(dayEvents.length - visibleEvents.length, 0);
        return (
          <div key={day.value} className="min-h-[148px] rounded-lg border border-border-light bg-surface-secondary p-3">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-bold text-text-primary">{day.label}</p>
              <span className="text-xs font-semibold text-text-tertiary">{dayEvents.length}</span>
            </div>
            {dayEvents.length === 0 ? (
              <p className="text-xs leading-5 text-text-tertiary">{emptyText}</p>
            ) : (
              <div className="space-y-2">
                {visibleEvents.map((event) => (
                  <div key={event.id} className={`rounded-md border px-2.5 py-2 ${toneClasses[event.tone || 'primary']}`}>
                    <p className="truncate text-xs font-bold">{event.time}</p>
                    <p className="mt-1 line-clamp-2 text-xs leading-4">{event.title}</p>
                    {event.meta && <p className="mt-1 truncate text-[11px] opacity-75">{event.meta}</p>}
                  </div>
                ))}
                {hiddenCount > 0 && (
                  <div className="rounded-md border border-border-light bg-white px-2.5 py-2 text-xs font-semibold text-text-secondary">
                    +{hiddenCount} buổi nữa
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function EmptyPanel({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-surface-secondary p-6 text-center">
      <h3 className="font-semibold text-text-primary">{title}</h3>
      {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-text-secondary">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
