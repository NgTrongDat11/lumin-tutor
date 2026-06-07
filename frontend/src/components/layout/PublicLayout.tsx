import { Outlet } from 'react-router-dom';
import authHero from '../../assets/auth-hero.png';

export default function PublicLayout() {
  return (
    <div className="min-h-screen bg-white flex">
      {/* Left — hero image, clean overlay */}
      <div className="hidden lg:flex lg:w-[52%] relative overflow-hidden">
        <img
          src={authHero}
          alt="Học viên đang học tập"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-primary-950/50" />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-white/15 rounded-lg flex items-center justify-center border border-white/10">
              <span className="text-sm font-bold">L</span>
            </div>
            <span className="text-xl font-bold tracking-tight">Lumin</span>
          </div>

          <div>
            <h1 className="text-4xl font-bold leading-[1.15] tracking-tight max-w-lg">
              Nền tảng kết nối
              <br />
              học viên — gia sư.
            </h1>
            <p className="mt-4 text-sm text-white/60 max-w-sm leading-6">
              Gợi ý gia sư và lớp học phù hợp dựa trên mục tiêu, lịch rảnh và khu vực của từng học viên.
            </p>
          </div>

          <div className="flex gap-10 border-t border-white/12 pt-6">
            <div>
              <p className="text-2xl font-bold">500+</p>
              <p className="text-white/50 text-xs mt-0.5">Gia sư xác minh</p>
            </div>
            <div>
              <p className="text-2xl font-bold">2K+</p>
              <p className="text-white/50 text-xs mt-0.5">Học viên</p>
            </div>
            <div>
              <p className="text-2xl font-bold">98%</p>
              <p className="text-white/50 text-xs mt-0.5">Hài lòng</p>
            </div>
          </div>
        </div>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-12 bg-surface-secondary">
        <div className="w-full max-w-md animate-fade-in">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 bg-primary-950 rounded-lg flex items-center justify-center">
              <span className="text-sm font-bold text-white">L</span>
            </div>
            <span className="text-xl font-bold tracking-tight text-text-primary">Lumin</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
