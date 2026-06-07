import { useState, type ComponentType } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';
import ChatBubble from '../chat/ChatBubble';
import Avatar from '../ui/Avatar';
import AccountSettingsModal from '../auth/AccountSettingsModal';
import {
  BookOpenIcon,
  CalendarIcon,
  ChartIcon,
  ClipboardCheckIcon,
  LayersIcon,
  SearchIcon,
  SettingsIcon,
  UserCheckIcon,
  UsersIcon,
  WalletIcon,
} from '../ui/Icons';

interface MenuItem {
  label: string;
  path: string;
  icon: ComponentType<{ className?: string }>;
  match?: string[];
}

interface MenuSection {
  title: string;
  items: MenuItem[];
}

const menuConfig: Record<UserRole, MenuSection[]> = {
  STUDENT: [
    {
      title: 'Không gian học',
      items: [
        { label: 'Khám phá', path: '/student', icon: SearchIcon },
        { label: 'Thời khóa biểu', path: '/student/schedule', icon: CalendarIcon },
        { label: 'Lớp của tôi', path: '/student/my-learning', icon: BookOpenIcon },
        { label: 'Thanh toán', path: '/student/payments', icon: WalletIcon },
        { label: 'Đánh giá', path: '/student/reviews', icon: UserCheckIcon },
      ],
    },
  ],
  TUTOR: [
    {
      title: 'Không gian gia sư',
      items: [
        { label: 'Tổng quan', path: '/tutor', icon: ChartIcon },
        { label: 'Lịch dạy', path: '/tutor/schedule', icon: CalendarIcon, match: ['/tutor/sessions', '/tutor/availability'] },
        { label: 'Lớp & môn dạy', path: '/tutor/teaching', icon: BookOpenIcon, match: ['/tutor/subjects'] },
        { label: 'Cơ hội dạy', path: '/tutor/opportunities', icon: ClipboardCheckIcon, match: ['/tutor/private-requests', '/tutor/applications'] },
        { label: 'Hồ sơ gia sư', path: '/tutor/profile', icon: UserCheckIcon, match: ['/tutor/qualifications'] },
      ],
    },
  ],
  STAFF: [
    {
      title: 'Vận hành trung tâm',
      items: [
        { label: 'Tổng quan', path: '/staff', icon: ChartIcon },
        { label: 'Gia sư', path: '/staff/tutors', icon: UserCheckIcon },
        { label: 'Học viên', path: '/staff/students', icon: UsersIcon },
        { label: 'Học vụ', path: '/staff/classes', icon: LayersIcon, match: ['/staff/subjects'] },
        { label: 'Lịch & hợp đồng', path: '/staff/operations', icon: ClipboardCheckIcon },
        { label: 'Tài chính', path: '/staff/payments', icon: WalletIcon },
      ],
    },
  ],
  SUPER_ADMIN: [
    {
      title: 'Owner console',
      items: [
        { label: 'Tổng quan', path: '/admin', icon: ChartIcon },
        { label: 'Quản lý staff', path: '/admin/staff', icon: UsersIcon },
        { label: 'Nhật ký hệ thống', path: '/admin/audit', icon: ClipboardCheckIcon },
        { label: 'Cấu hình', path: '/admin/system', icon: SettingsIcon },
      ],
    },
  ],
};

const rolePortalNames: Record<UserRole, string> = {
  STUDENT: 'Learning Market',
  TUTOR: 'Tutor Portal',
  STAFF: 'Staff Portal',
  SUPER_ADMIN: 'Admin Console',
};

const roleBadges: Record<UserRole, string> = {
  STUDENT: 'Học viên',
  TUTOR: 'Gia sư',
  STAFF: 'Staff',
  SUPER_ADMIN: 'Super Admin',
};

function isActiveItem(item: MenuItem, pathname: string) {
  const paths = [item.path, ...(item.match || [])];
  return paths.some((path) => {
    if (path === '/student' || path === '/tutor' || path === '/staff' || path === '/admin') {
      return pathname === path;
    }
    return pathname === path || pathname.startsWith(`${path}/`);
  });
}

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  if (!user) return null;

  const sections = menuConfig[user.role] || [];
  const flatMenu = sections.flatMap((section) => section.items);
  const activeItem = flatMenu.find((item) => isActiveItem(item, location.pathname));
  const isStudent = user.role === 'STUDENT';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-surface-secondary">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/35 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 z-50 flex h-screen w-[18rem] flex-col border-r border-border-light bg-white shadow-xl transition-transform duration-300 lg:sticky lg:translate-x-0 lg:shadow-none
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} ${isStudent ? 'hidden lg:flex' : 'flex'}`}
      >
        <div className="border-b border-border-light px-5 py-5">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="flex min-w-0 items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-text-primary text-lg font-bold text-white">
                L
              </div>
              <div className="min-w-0">
                <span className="block truncate text-xl font-bold tracking-tight text-text-primary">Lumin</span>
                <span className="block truncate text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700">
                  {rolePortalNames[user.role]}
                </span>
              </div>
            </Link>
            <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 text-text-tertiary hover:bg-surface-tertiary hover:text-text-primary lg:hidden">
              x
            </button>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-5">
          {sections.map((section) => (
            <div key={section.title} className="mb-6 last:mb-0">
              <p className="mb-2 px-3 text-[11px] font-bold uppercase tracking-[0.14em] text-text-tertiary">{section.title}</p>
              <div className="space-y-1">
                {section.items.map((item) => {
                  const active = isActiveItem(item, location.pathname);
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setSidebarOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                        active
                          ? 'bg-primary-50 text-primary-800'
                          : 'text-text-secondary hover:bg-surface-secondary hover:text-text-primary'
                      }`}
                    >
                      <item.icon className={`h-[18px] w-[18px] ${active ? 'text-primary-700' : 'text-text-tertiary'}`} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {user.role === 'SUPER_ADMIN' && (
          <div className="px-4 pb-4">
            <Link
              to="/staff"
              className="flex items-center justify-center gap-2 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 text-xs font-semibold text-primary-700 transition-colors hover:bg-primary-100"
            >
              <ChartIcon className="h-4 w-4" />
              Chuyển sang Bảng vận hành
            </Link>
          </div>
        )}

        <div className="mt-auto border-t border-border-light bg-surface-secondary/70 p-4 relative">
          {showUserMenu && (
            <div className="absolute bottom-[4.5rem] left-4 right-4 bg-white border border-border-light rounded-lg shadow-lg overflow-hidden z-10 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  setShowSettings(true);
                }}
                className="w-full px-4 py-3 text-sm font-semibold text-text-secondary hover:bg-surface-secondary hover:text-text-primary text-left border-b border-border-light transition-colors"
              >
                ⚙️ Thông tin tài khoản
              </button>
              <button
                onClick={handleLogout}
                className="w-full px-4 py-3 text-sm font-semibold text-danger-600 hover:bg-danger-50 transition-colors text-left"
              >
                Đăng xuất
              </button>
            </div>
          )}
          
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 rounded-lg bg-white p-2 border border-border-light shadow-sm hover:border-primary-200 hover:shadow transition-all"
          >
            <Avatar name={user.full_name} src={user.avatar_url || undefined} size="sm" shape="square" />
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-sm font-bold text-text-primary">{user.full_name}</p>
              <p className="truncate text-xs font-medium text-text-tertiary">{roleBadges[user.role]}</p>
            </div>
            <svg className={`w-4 h-4 text-text-tertiary transition-transform ${showUserMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
          </button>
        </div>
      </aside>

      {showSettings && <AccountSettingsModal onClose={() => setShowSettings(false)} />}

      <div className="flex min-h-screen max-w-full flex-1 flex-col overflow-hidden pb-16 lg:pb-0">
        <header className="sticky top-0 z-30 border-b border-border-light bg-white/88 px-4 py-3 shadow-xs backdrop-blur-xl md:px-6">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {!isStudent && (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="-ml-2 rounded-lg p-2 text-text-secondary transition-colors hover:bg-surface-tertiary hover:text-text-primary lg:hidden"
                  aria-label="Mở menu"
                >
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              )}
              {isStudent && (
                <Link to="/" className="flex shrink-0 items-center gap-2.5 lg:hidden">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-primary text-sm font-bold text-white">L</div>
                  <span className="block text-lg font-bold tracking-tight text-text-primary">Lumin</span>
                </Link>
              )}
              <div className="min-w-0">
                <p className="hidden truncate text-sm font-semibold text-text-primary md:block">{activeItem?.label || 'Dashboard'}</p>
                <p className="hidden truncate text-xs text-text-tertiary md:block">{rolePortalNames[user.role]}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="rounded-full border border-primary-100 bg-primary-50 px-3 py-1.5 text-xs font-bold text-primary-800">
                {roleBadges[user.role]}
              </span>
              <Avatar name={user.full_name} src={user.avatar_url || undefined} size="sm" />
            </div>
          </div>
        </header>

        {isStudent && (
          <nav className="custom-scrollbar fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around overflow-x-auto border-t border-border-light bg-white/92 px-2 pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] backdrop-blur-xl lg:hidden">
            {flatMenu.slice(0, 4).map((item) => {
              const active = isActiveItem(item, location.pathname);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-lg transition-colors ${
                    active ? 'text-primary-700' : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  <item.icon className="mb-1 h-5 w-5" />
                  <span className="text-center text-[10px] font-medium leading-none">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        )}

        <main className="flex-1 overflow-y-auto bg-surface-secondary">
          <div className="mx-auto flex min-h-full max-w-[1600px] flex-col p-4 md:p-6 lg:p-8">
            <div className="flex-1">
              <Outlet />
            </div>

            <footer className="mt-12 border-t border-border-light pt-8 pb-4 text-center">
              <div className="mb-2 flex items-center justify-center gap-2 text-text-tertiary">
                <span className="font-bold text-primary-700">Lumin</span>
                <span>•</span>
                <span>Learning Market</span>
              </div>
              <p className="text-xs text-text-tertiary">
                &copy; {new Date().getFullYear()} Lumin Education. All rights reserved.
              </p>
            </footer>
          </div>
        </main>
      </div>

      {isStudent && <ChatBubble />}
    </div>
  );
}
