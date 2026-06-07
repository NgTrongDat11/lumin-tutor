import { Link } from 'react-router-dom';
import type { ComponentType } from 'react';
import { useAuth } from '../../hooks/useAuth';
import type { UserRole } from '../../types';
import Button from '../../components/ui/Button';
import {
  ArrowRightIcon,
  BookOpenIcon,
  CalendarIcon,
  SearchIcon,
  ShieldCheckIcon,
  UserCheckIcon,
  UsersIcon,
} from '../../components/ui/Icons';
import heroImage from '../../assets/lumin-hero-premium.png';

type IconType = ComponentType<{ className?: string }>;

const roleDashboard: Record<UserRole, string> = {
  STUDENT: '/student',
  TUTOR: '/tutor',
  STAFF: '/staff',
  SUPER_ADMIN: '/admin',
};

const tutorCards = [
  { name: 'Minh Anh', subject: 'Toán 12', rating: '4.9', price: '220k', match: '96%' },
  { name: 'Quốc Huy', subject: 'IELTS', rating: '4.8', price: '280k', match: '92%' },
  { name: 'Khánh Linh', subject: 'Vật lý', rating: '4.9', price: '240k', match: '89%' },
];

const classCards = [
  { title: 'Lớp Toán nền tảng', meta: 'Tối 2-4-6 · 6 học viên', tone: 'emerald' },
  { title: 'IELTS Speaking Lab', meta: 'Online · nhóm nhỏ', tone: 'amber' },
];

const tutorBenefits: { icon: IconType; title: string; desc: string }[] = [
  { icon: UserCheckIcon, title: 'Hồ sơ có thể trình bày', desc: 'Bio, môn dạy, học phí, chứng chỉ và rating được đóng gói thành profile đáng tin.' },
  { icon: CalendarIcon, title: 'Lịch và cơ hội rõ ràng', desc: 'Lớp đang tuyển và yêu cầu 1-1 nổi bật theo khả năng nhận việc.' },
  { icon: BookOpenIcon, title: 'Không gian phát triển', desc: 'Gia sư biết cần bổ sung gì để được duyệt và xuất hiện trong gợi ý.' },
];

const operationItems: { title: string; desc: string; icon: IconType }[] = [
  { title: 'Duyệt gia sư', desc: '8 hồ sơ chờ xác minh', icon: UserCheckIcon },
  { title: 'Chốt lớp nhóm', desc: '3 lớp cần chọn gia sư', icon: UsersIcon },
  { title: 'Thanh toán', desc: '5 giao dịch cần kiểm tra', icon: ShieldCheckIcon },
];

export default function LandingPage() {
  const { user } = useAuth();
  const appTarget = user ? roleDashboard[user.role] : '/register';

  return (
    <div className="min-h-screen bg-[#fbfaf6] text-text-primary">
      <header className="fixed inset-x-0 top-0 z-40 border-b border-white/15 bg-text-primary/58 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 sm:px-5 lg:px-8">
          <Link to="/" className="flex items-center gap-3 text-white">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/20 bg-white/12 text-lg font-semibold text-white">
              L
            </span>
            <span className="text-xl font-semibold tracking-tight text-white">Lumin</span>
          </Link>
          <nav className="hidden items-center gap-8 text-sm font-medium text-white/76 md:flex">
            <a href="#discover" className="hover:text-white">Tìm gia sư</a>
            <a href="#tutors" className="hover:text-white">Dành cho gia sư</a>
            <a href="#operations" className="hover:text-white">Vận hành trung tâm</a>
          </nav>
          <div className="flex items-center gap-3">
            {!user && (
              <Link to="/login" className="hidden text-sm font-medium text-white opacity-80 hover:opacity-100 sm:block">
                Đăng nhập
              </Link>
            )}
            <Link
              to={appTarget}
              className="hidden h-10 items-center justify-center rounded-lg bg-white px-3 text-sm font-semibold text-[#17201f] shadow-sm transition-colors hover:bg-primary-50 min-[460px]:inline-flex sm:px-4"
            >
              {user ? 'Vào hệ thống' : 'Bắt đầu'}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative min-h-[92vh] overflow-hidden bg-text-primary">
          <img src={heroImage} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(6,43,41,0.93),rgba(6,43,41,0.76),rgba(6,43,41,0.18))]" />
          <div className="relative mx-auto flex min-h-[92vh] max-w-7xl items-center px-5 pb-16 pt-28 lg:px-8">
            <div className="w-full max-w-3xl min-w-0 text-white">
              <h1 className="max-w-[20rem] text-[2.35rem] font-semibold leading-[1.06] tracking-tight text-balance sm:max-w-[34rem] sm:text-5xl md:max-w-3xl md:text-7xl">
                Tìm gia sư phù hợp như chọn một lộ trình học cá nhân.
              </h1>
              <p className="mt-6 max-w-[20rem] text-base leading-8 text-white/76 sm:max-w-[34rem] sm:text-lg md:max-w-2xl">
                Lumin kết hợp nhu cầu học, lịch rảnh, ngân sách và hồ sơ gia sư đã xác minh để gợi ý lựa chọn đáng tin cậy cho từng học viên.
              </p>

              <div className="mt-9 flex w-full max-w-[20rem] min-w-0 flex-col gap-3 overflow-hidden rounded-lg border border-white/18 bg-white/12 p-2 shadow-2xl backdrop-blur-xl sm:max-w-[34rem] sm:flex-row md:max-w-2xl">
                <div className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-md bg-white px-4 text-text-secondary">
                  <SearchIcon className="h-5 w-5 text-primary-700" />
                  <span className="truncate text-sm">Toán lớp 12, IELTS, Văn ôn thi...</span>
                </div>
                <Link to={appTarget}>
                  <Button className="h-12 w-full bg-warning-500 px-5 text-text-primary hover:bg-warning-600 sm:w-auto">
                    Tìm lộ trình <ArrowRightIcon className="h-4 w-4" />
                  </Button>
                </Link>
              </div>

              <div className="mt-10 grid max-w-[20rem] grid-cols-3 gap-4 border-t border-white/18 pt-7 sm:max-w-[34rem] md:max-w-xl md:gap-6">
                <div>
                  <p className="text-3xl font-semibold">96%</p>
                  <p className="text-sm text-white/62">độ phù hợp cao</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold">24h</p>
                  <p className="text-sm text-white/62">staff phản hồi</p>
                </div>
                <div>
                  <p className="text-3xl font-semibold">1-1</p>
                  <p className="text-sm text-white/62">hoặc lớp nhóm</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="discover" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-center">
            <div>
              <h2 className="text-4xl font-semibold tracking-tight text-balance">
                Student experience chuyển từ dashboard sang khám phá.
              </h2>
              <p className="mt-4 text-base leading-7 text-text-secondary">
                Học viên vào hệ thống để tìm lựa chọn học, không phải đọc số liệu. Giao diện ưu tiên search, bộ lọc, gợi ý gia sư và lớp đang mở.
              </p>
              <div className="mt-8 grid gap-4">
                {[
                  ['Nhu cầu học', 'Mục tiêu, cấp lớp, ngân sách và lịch rảnh được gom thành một hồ sơ tìm kiếm.'],
                  ['Gợi ý có lý do', 'Mỗi gia sư/lớp hiển thị điểm phù hợp, môn dạy, phí, lịch và lý do đề xuất.'],
                  ['Tư vấn rõ bước', 'Staff can thiệp ở các bước cần xác minh, điều phối hoặc chốt lịch.'],
                ].map(([title, desc]) => (
                  <div key={title} className="flex gap-4">
                    <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary-50 text-primary-800">
                      <ShieldCheckIcon className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="text-sm leading-6 text-text-secondary">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border/70 bg-white p-4 shadow-xl">
              <div className="flex items-center justify-between border-b border-border-light pb-4">
                <div>
                  <p className="text-sm font-semibold text-text-primary">Gợi ý hôm nay</p>
                  <p className="text-xs text-text-tertiary">Dựa trên nhu cầu Toán 12 · Online buổi tối</p>
                </div>
                <span className="rounded-full bg-primary-50 px-3 py-1 text-xs font-semibold text-primary-800">
                  12 lựa chọn
                </span>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {tutorCards.map((tutor) => (
                  <article key={tutor.name} className="rounded-lg border border-border-light bg-[#fbfaf6] p-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-text-primary text-sm font-semibold text-white">
                      {tutor.name.charAt(0)}
                    </div>
                    <h3 className="mt-4 font-semibold">{tutor.name}</h3>
                    <p className="text-sm text-text-secondary">{tutor.subject}</p>
                    <div className="mt-4 flex items-center justify-between text-xs">
                      <span className="font-semibold text-primary-800">{tutor.match}</span>
                      <span className="text-text-tertiary">{tutor.rating} · {tutor.price}/buổi</span>
                    </div>
                  </article>
                ))}
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {classCards.map((item) => (
                  <div key={item.title} className="rounded-lg border border-border-light p-4">
                    <div className={`mb-4 h-1.5 w-16 rounded-full ${item.tone === 'amber' ? 'bg-warning-500' : 'bg-primary-500'}`} />
                    <h3 className="font-semibold">{item.title}</h3>
                    <p className="text-sm text-text-secondary">{item.meta}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="tutors" className="bg-white py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 lg:grid-cols-3 lg:px-8">
            <div className="lg:col-span-1">
              <h2 className="text-4xl font-semibold tracking-tight text-balance">Gia sư có workspace như một hồ sơ nghề nghiệp.</h2>
              <p className="mt-4 text-text-secondary">
                Tutor không chỉ nhập dữ liệu. Họ thấy mức hoàn thiện hồ sơ, cơ hội lớp phù hợp, lịch dạy và trạng thái xác minh.
              </p>
            </div>
            {tutorBenefits.map((item) => (
              <article key={item.title} className="rounded-lg border border-border/80 bg-[#fbfaf6] p-6">
                <item.icon className="h-7 w-7 text-primary-800" />
                <h3 className="mt-6 text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text-secondary">{item.desc}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="operations" className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div className="rounded-lg border border-border/80 bg-text-primary p-6 text-white shadow-xl">
              <div className="flex items-center justify-between border-b border-white/12 pb-5">
                <div>
                  <p className="text-sm font-semibold">Operation cockpit</p>
                  <p className="text-xs text-white/55">Dành cho staff và admin</p>
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs text-white/72">Today</span>
              </div>
              <div className="mt-5 grid gap-3">
                {operationItems.map((item) => (
                  <div key={item.title} className="flex items-center gap-4 rounded-lg bg-white/8 p-4">
                    <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-primary-200">
                      <item.icon className="h-5 w-5" />
                    </span>
                    <div>
                      <p className="font-semibold">{item.title}</p>
                      <p className="text-sm text-white/58">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2 className="text-4xl font-semibold tracking-tight text-balance">
                Backoffice vẫn tồn tại, nhưng chỉ ở đúng nơi cần vận hành.
              </h2>
              <p className="mt-4 text-base leading-7 text-text-secondary">
                Staff và admin được thiết kế như bảng điều phối công việc: hàng chờ, cảnh báo, quyết định cần xử lý và báo cáo chủ hệ thống.
              </p>
              <Link to={appTarget} className="mt-8 inline-flex">
                <Button>
                  Xem trải nghiệm <ArrowRightIcon className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
