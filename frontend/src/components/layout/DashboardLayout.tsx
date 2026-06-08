import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { messageApi, notificationApi } from '../../services/api';
import type { NotificationResponse, UserRole } from '../../types';
import ChatBubble from '../chat/ChatBubble';
import Avatar from '../ui/Avatar';
import AccountSettingsModal from '../auth/AccountSettingsModal';
import {
  BookOpenIcon,
  CalendarIcon,
  ChartIcon,
  ClipboardCheckIcon,
  LayersIcon,
  MessageCircleIcon,
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
        { label: 'Tin nhắn', path: '/student/messages', icon: MessageCircleIcon },
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
        { label: 'Tin nhắn', path: '/tutor/messages', icon: MessageCircleIcon },
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
        { label: 'Tin nhắn', path: '/staff/messages', icon: MessageCircleIcon },
      ],
    },
  ],
  SUPER_ADMIN: [
    {
      title: 'Bảng quản trị',
      items: [
        { label: 'Tổng quan', path: '/admin', icon: ChartIcon },
        { label: 'Quản lý nhân viên', path: '/admin/staff', icon: UsersIcon },
        { label: 'Nhật ký hệ thống', path: '/admin/audit', icon: ClipboardCheckIcon },
        { label: 'Cấu hình', path: '/admin/system', icon: SettingsIcon },
        { label: 'Tin nhắn', path: '/admin/messages', icon: MessageCircleIcon },
      ],
    },
  ],
};

const rolePortalNames: Record<UserRole, string> = {
  STUDENT: 'Không gian học tập',
  TUTOR: 'Không gian gia sư',
  STAFF: 'Bảng vận hành',
  SUPER_ADMIN: 'Bảng quản trị',
};

const roleBadges: Record<UserRole, string> = {
  STUDENT: 'Học viên',
  TUTOR: 'Gia sư',
  STAFF: 'Nhân viên',
  SUPER_ADMIN: 'Quản trị viên',
};

const roleDashboard: Record<UserRole, string> = {
  STUDENT: '/student',
  TUTOR: '/tutor',
  STAFF: '/staff',
  SUPER_ADMIN: '/admin',
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
  const [showHeaderMenu, setShowHeaderMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showHelpMenu, setShowHelpMenu] = useState(false);
  const [showMobileSearch, setShowMobileSearch] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [notifications, setNotifications] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [notiLimit, setNotiLimit] = useState(5);
  const [notiLoading, setNotiLoading] = useState(false);

  const isStudent = user?.role === 'STUDENT';

  useEffect(() => {
    if (!isStudent) return;
    const params = new URLSearchParams(location.search);
    setHeaderSearch(params.get('search') || '');
  }, [isStudent, location.search]);

  // Fetch unread count on mount
  useEffect(() => {
    notificationApi.unreadCount().then((d) => setUnreadCount(d.count)).catch(() => {});
  }, []);

  // Fetch unread messages count on mount + poll every 30s
  const fetchUnreadMessages = useCallback(() => {
    messageApi.listThreads()
      .then((threads) => {
        const total = threads.reduce((sum, t) => sum + (t.unread_count || 0), 0);
        setUnreadMessages(total);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchUnreadMessages();
    const interval = setInterval(fetchUnreadMessages, 30_000);
    return () => clearInterval(interval);
  }, [fetchUnreadMessages]);

  const fetchNotifications = useCallback((limit: number) => {
    setNotiLoading(true);
    notificationApi.list(limit)
      .then((data) => setNotifications(data))
      .catch(() => {})
      .finally(() => setNotiLoading(false));
    notificationApi.unreadCount().then((d) => setUnreadCount(d.count)).catch(() => {});
  }, []);

  const handleOpenNotifications = useCallback(() => {
    const willOpen = !showNotifications;
    setShowNotifications(willOpen);
    setShowHelpMenu(false);
    setShowHeaderMenu(false);
    if (willOpen) {
      setNotiLimit(5);
      fetchNotifications(5);
    }
  }, [showNotifications, fetchNotifications]);

  const handleMarkAllRead = useCallback(async () => {
    await notificationApi.markAllRead().catch(() => {});
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    setUnreadCount(0);
  }, []);

  const handleNotiClick = useCallback(async (noti: NotificationResponse) => {
    if (!noti.is_read) {
      notificationApi.markRead(noti.id).catch(() => {});
      setNotifications((prev) => prev.map((n) => n.id === noti.id ? { ...n, is_read: true } : n));
      setUnreadCount((c) => Math.max(0, c - 1));
    }
    setShowNotifications(false);
    if (noti.reference_type === 'learning_session' && noti.reference_id) {
      navigate(`${roleDashboard[user!.role]}/schedule?sessionId=${noti.reference_id}`);
    } else if (noti.reference_type === 'message_thread' && noti.reference_id) {
      navigate(`${roleDashboard[user!.role]}/messages?threadId=${noti.reference_id}`);
    }
  }, [navigate, user]);

  const handleShowAll = useCallback(() => {
    setNotiLimit(10);
    fetchNotifications(10);
  }, [fetchNotifications]);

  if (!user) return null;

  const sections = menuConfig[user.role] || [];
  const flatMenu = sections.flatMap((section) => section.items);
  const activeItem = flatMenu.find((item) => isActiveItem(item, location.pathname));

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleHeaderSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (!isStudent) return;
    const query = headerSearch.trim();
    const params = new URLSearchParams();
    if (query) params.set('search', query);
    navigate(`/student${params.toString() ? `?${params.toString()}` : ''}`);
    setShowMobileSearch(false);
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
            <Link to={roleDashboard[user.role] || '/'} className="flex min-w-0 items-center gap-3">
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
                      {item.label === 'Tin nhắn' && unreadMessages > 0 && (
                        <span className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full bg-danger-500 px-1.5 text-[10px] font-bold text-white">
                          {unreadMessages > 99 ? '99+' : unreadMessages}
                        </span>
                      )}
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

      <div className="flex min-h-screen max-w-full flex-1 flex-col overflow-hidden pb-24 lg:pb-0">
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
                <Link to={roleDashboard[user.role] || '/'} className="flex shrink-0 items-center gap-2.5 lg:hidden">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-text-primary text-sm font-bold text-white">L</div>
                  <span className="block text-lg font-bold tracking-tight text-text-primary">Lumin</span>
                </Link>
              )}
              <div className="min-w-0">
                <h1 className="hidden truncate text-xl font-bold tracking-tight text-text-primary md:block">{activeItem?.label || 'Tổng quan'}</h1>
                <p className="hidden truncate text-xs font-medium text-text-tertiary md:block mt-0.5">{rolePortalNames[user.role]}</p>
              </div>
            </div>

            {isStudent && (
              <form onSubmit={handleHeaderSearch} className="mx-2 hidden flex-1 md:mx-8 md:flex md:max-w-md">
                <div className="relative w-full group">
                  <input
                    type="text"
                    value={headerSearch}
                    onChange={(event) => setHeaderSearch(event.target.value)}
                    placeholder="Tìm lớp học, gia sư..."
                    className="block w-full pl-4 pr-10 py-2 border border-border-light rounded-full leading-5 bg-surface-secondary text-text-primary placeholder-text-tertiary focus:outline-none focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-all sm:text-sm"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <button type="submit" className="text-text-tertiary hover:text-primary-500 transition-colors focus:outline-none" aria-label="Tìm kiếm">
                      <SearchIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* Right Side Tools */}
            <div className="flex shrink-0 items-center gap-2 sm:gap-3 relative ml-auto">
              {isStudent && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMobileSearch((open) => !open);
                    setShowNotifications(false);
                    setShowHeaderMenu(false);
                    setShowHelpMenu(false);
                  }}
                  className="inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-full border border-border-light bg-surface-secondary px-3 text-text-secondary transition-colors hover:bg-white hover:text-text-primary md:hidden"
                  aria-label="Mở tìm kiếm"
                  aria-expanded={showMobileSearch}
                >
                  <SearchIcon className="h-4 w-4" />
                  <span className="hidden text-xs font-semibold min-[380px]:inline">Tìm</span>
                </button>
              )}

              {/* ── Notification Bell ── */}
              <div className="relative">
                <button
                  onClick={handleOpenNotifications}
                  className="relative p-2 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  aria-label="Thông báo"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifications(false)} />
                    <div className="fixed left-4 right-4 top-[4.5rem] z-50 max-h-[calc(100vh-8rem)] overflow-hidden rounded-xl border border-border-light bg-white shadow-xl ring-1 ring-black/5 animate-scale-in sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-2 sm:w-96 sm:max-w-[calc(100vw-32px)]">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border-light bg-surface-secondary/50">
                        <h3 className="text-sm font-bold text-text-primary">Thông báo</h3>
                        {unreadCount > 0 && (
                          <button onClick={handleMarkAllRead} className="text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors">
                            Đánh dấu đã đọc
                          </button>
                        )}
                      </div>
                      <div className={`${notiLimit > 5 ? 'max-h-96' : 'max-h-80'} overflow-y-auto divide-y divide-border-light`}>
                        {notiLoading && notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center text-sm text-text-tertiary">Đang tải...</div>
                        ) : notifications.length === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <span className="text-3xl">🔔</span>
                            <p className="text-sm text-text-tertiary mt-2">Chưa có thông báo nào</p>
                          </div>
                        ) : (
                          notifications.map((noti) => {
                            const icon = noti.notification_type === 'SESSION_CANCELLED' ? '❌'
                              : noti.notification_type === 'SESSION_RESCHEDULED' ? '🔄'
                              : noti.notification_type === 'NEW_MESSAGE' ? '💬' : '📚';
                            const iconBg = noti.notification_type === 'SESSION_CANCELLED' ? 'bg-danger-100 text-danger-700'
                              : noti.notification_type === 'SESSION_RESCHEDULED' ? 'bg-warning-100 text-warning-700'
                              : 'bg-primary-100 text-primary-700';
                            const timeAgo = _formatTimeAgo(noti.created_at);

                            return (
                              <div
                                key={noti.id}
                                onClick={() => handleNotiClick(noti)}
                                className={`px-4 py-3 transition-colors cursor-pointer ${
                                  noti.is_read ? 'hover:bg-surface-secondary' : 'bg-primary-50/40 hover:bg-primary-50'
                                }`}
                              >
                                <div className="flex items-start gap-3">
                                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${iconBg}`}>{icon}</span>
                                  <div className="min-w-0 flex-1">
                                    <p className={`text-sm ${noti.is_read ? 'font-medium text-text-secondary' : 'font-semibold text-text-primary'}`}>{noti.title}</p>
                                    {noti.body && <p className="text-xs text-text-tertiary mt-0.5 line-clamp-2">{noti.body}</p>}
                                    <p className={`text-[10px] mt-1 ${noti.is_read ? 'text-text-tertiary' : 'text-primary-600 font-semibold'}`}>{timeAgo}</p>
                                  </div>
                                  {!noti.is_read && <span className="mt-1.5 block h-2 w-2 shrink-0 rounded-full bg-primary-500"></span>}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {notifications.length > 0 && notiLimit <= 5 && (
                        <div className="border-t border-border-light px-4 py-2.5 text-center">
                          <button onClick={handleShowAll} className="text-xs font-semibold text-primary-600 hover:text-primary-800 transition-colors">
                            Xem tất cả thông báo
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* ── Help / About ── */}
              <div className="relative hidden sm:block">
                <button
                  onClick={() => { setShowHelpMenu(!showHelpMenu); setShowNotifications(false); setShowHeaderMenu(false); }}
                  className="p-2 text-text-secondary hover:bg-surface-tertiary hover:text-text-primary rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500/20"
                  aria-label="Trợ giúp"
                >
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </button>

                {showHelpMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowHelpMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-64 max-w-[calc(100vw-32px)] rounded-xl border border-border-light bg-white shadow-xl ring-1 ring-black/5 z-50 animate-scale-in overflow-hidden">
                      <div className="px-4 py-3 border-b border-border-light bg-surface-secondary/50">
                        <h3 className="text-sm font-bold text-text-primary">Trợ giúp & Hỗ trợ</h3>
                      </div>
                      <div className="p-1.5">
                        <button
                          onClick={() => setShowHelpMenu(false)}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors flex items-center gap-3"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary-50 text-primary-600 text-xs">📖</span>
                          <span>Hướng dẫn sử dụng</span>
                        </button>
                        <button
                          onClick={() => setShowHelpMenu(false)}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors flex items-center gap-3"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-warning-50 text-warning-600 text-xs">💬</span>
                          <span>Câu hỏi thường gặp</span>
                        </button>
                        <button
                          onClick={() => setShowHelpMenu(false)}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors flex items-center gap-3"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-success-50 text-success-600 text-xs">📧</span>
                          <span>Liên hệ hỗ trợ</span>
                        </button>
                        <button
                          onClick={() => setShowHelpMenu(false)}
                          className="w-full rounded-lg px-3 py-2.5 text-left text-sm font-medium text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors flex items-center gap-3"
                        >
                          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-surface-tertiary text-text-tertiary text-xs">⌨️</span>
                          <span>Phím tắt</span>
                        </button>
                      </div>
                      <div className="border-t border-border-light px-4 py-2.5 flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-text-tertiary">Lumin v1.0.0</span>
                        <span className="text-[10px] text-text-tertiary">© 2026 Lumin Education</span>
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="flex lg:hidden items-center gap-2">
                <div className="h-4 w-[1px] bg-border-light mx-1"></div>
                <button
                  type="button"
                  onClick={() => { setShowHeaderMenu(!showHeaderMenu); setShowNotifications(false); setShowHelpMenu(false); }}
                  className="flex items-center gap-2 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500/20 transition-all cursor-pointer"
                  aria-label="Menu tài khoản"
                >
                  <Avatar name={user.full_name} src={user.avatar_url || undefined} size="sm" />
                </button>

                {showHeaderMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowHeaderMenu(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 max-w-[calc(100vw-32px)] rounded-xl border border-border-light bg-white py-1 shadow-xl ring-1 ring-black/5 z-50 animate-scale-in">
                      <div className="px-4 py-3 border-b border-border-light bg-surface-secondary/50">
                        <p className="truncate text-sm font-bold text-text-primary">{user.full_name}</p>
                        <p className="truncate text-[11px] font-semibold text-text-tertiary mt-0.5">{roleBadges[user.role]}</p>
                      </div>
                      <div className="p-1">
                        <button
                          onClick={() => {
                            setShowHeaderMenu(false);
                            setShowSettings(true);
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-text-secondary hover:bg-surface-secondary hover:text-text-primary transition-colors flex items-center gap-2.5"
                        >
                          <span>⚙️</span>
                          <span>Tài khoản</span>
                        </button>
                        <button
                          onClick={() => {
                            setShowHeaderMenu(false);
                            handleLogout();
                          }}
                          className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-danger-600 hover:bg-danger-50 transition-colors flex items-center gap-2.5"
                        >
                          <span>🚪</span>
                          <span>Đăng xuất</span>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
          {isStudent && showMobileSearch && (
            <form onSubmit={handleHeaderSearch} className="mx-auto mt-3 flex max-w-[1600px] md:hidden">
              <div className="relative w-full">
                <input
                  type="text"
                  value={headerSearch}
                  onChange={(event) => setHeaderSearch(event.target.value)}
                  placeholder="Tìm lớp học, gia sư..."
                  className="block w-full rounded-xl border border-border-light bg-surface-secondary py-3 pl-4 pr-12 text-sm font-medium text-text-primary outline-none transition-all placeholder:text-text-tertiary focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-500/20"
                  autoFocus
                />
                <button
                  type="submit"
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-text-tertiary transition-colors hover:text-primary-600"
                  aria-label="Tìm kiếm"
                >
                  <SearchIcon className="h-4 w-4" />
                </button>
              </div>
            </form>
          )}
        </header>

        {isStudent && (
          <nav className="fixed bottom-0 left-0 right-0 z-40 grid grid-cols-6 border-t border-border-light bg-white/94 px-1 pb-[max(0.35rem,env(safe-area-inset-bottom))] pt-1 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] backdrop-blur-xl lg:hidden">
            {flatMenu.map((item) => {
              const active = isActiveItem(item, location.pathname);
              const mobileLabel = item.label === 'Thời khóa biểu'
                ? 'Lịch'
                : item.label === 'Lớp của tôi'
                  ? 'Lớp'
                  : item.label === 'Tin nhắn'
                    ? 'Nhắn'
                  : item.label;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex h-14 min-w-0 flex-col items-center justify-center rounded-lg px-1 transition-colors ${
                    active ? 'text-primary-700' : 'text-text-tertiary hover:text-text-secondary'
                  }`}
                >
                  <div className="relative">
                    <item.icon className="mb-1 h-5 w-5" />
                    {item.label === 'Tin nhắn' && unreadMessages > 0 && (
                      <span className="absolute -right-1.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-danger-500 px-1 text-[9px] font-bold text-white">
                        {unreadMessages > 99 ? '99+' : unreadMessages}
                      </span>
                    )}
                  </div>
                  <span className="w-full truncate text-center text-[10px] font-medium leading-none">{mobileLabel}</span>
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
                <span>Không gian học tập</span>
              </div>
              <p className="text-xs text-text-tertiary">
                &copy; {new Date().getFullYear()} Lumin Education. Đã đăng ký bản quyền.
              </p>
            </footer>
          </div>
        </main>
      </div>

      {isStudent && <ChatBubble />}
    </div>
  );
}

function _formatTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 1) return 'Vừa xong';
  if (diffMin < 60) return `${diffMin} phút trước`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour} giờ trước`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay === 1) return 'Hôm qua';
  if (diffDay < 30) return `${diffDay} ngày trước`;
  return new Date(dateStr).toLocaleDateString('vi-VN');
}
