import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi, extractErrorMessage } from '../../services/api';
import { useToast } from '../../components/ui/Toast';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';

type RegisterRole = 'STUDENT' | 'TUTOR';

export default function RegisterPage() {
  const [role, setRole] = useState<RegisterRole>('STUDENT');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    phone: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  const handleChange = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        email: formData.email,
        password: formData.password,
        full_name: formData.full_name,
        phone: formData.phone || undefined,
      };

      if (role === 'STUDENT') {
        await authApi.registerStudent(payload);
      } else {
        await authApi.registerTutor(payload);
      }

      toast('success', 'Đăng ký thành công! Vui lòng đăng nhập.');
      navigate('/login');
    } catch (err: unknown) {
      setError(extractErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-lg border border-border/80 bg-white p-6 shadow-xl">
      <h2 className="text-3xl font-semibold tracking-tight text-text-primary">Đăng ký tài khoản</h2>
      <p className="text-sm text-text-secondary mt-2 mb-6 leading-6">
        Tạo hồ sơ học viên hoặc gia sư để bắt đầu sử dụng Lumin.
      </p>

      {/* Role toggle */}
      <div className="flex p-1 bg-surface-tertiary rounded-lg mb-6">
        <button
          type="button"
          onClick={() => setRole('STUDENT')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer
            ${role === 'STUDENT' ? 'bg-surface shadow-sm text-primary-800' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Học viên
        </button>
        <button
          type="button"
          onClick={() => setRole('TUTOR')}
          className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all cursor-pointer
            ${role === 'TUTOR' ? 'bg-surface shadow-sm text-primary-800' : 'text-text-secondary hover:text-text-primary'}`}
        >
          Gia sư
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Họ và tên"
          placeholder="Nguyễn Văn A"
          value={formData.full_name}
          onChange={handleChange('full_name')}
          required
        />
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={formData.email}
          onChange={handleChange('email')}
          required
        />
        <Input
          label="Số điện thoại"
          type="tel"
          placeholder="0901234567"
          value={formData.phone}
          onChange={handleChange('phone')}
        />
        <Input
          label="Mật khẩu"
          type="password"
          placeholder="Tối thiểu 6 ký tự"
          value={formData.password}
          onChange={handleChange('password')}
          required
          minLength={6}
        />
        <Input
          label="Xác nhận mật khẩu"
          type="password"
          placeholder="Nhập lại mật khẩu"
          value={formData.confirmPassword}
          onChange={handleChange('confirmPassword')}
          required
        />

        {error && (
          <div className="px-4 py-3 rounded-lg bg-danger-50 border border-danger-100 text-sm text-danger-600">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full h-11">
          Đăng ký {role === 'STUDENT' ? 'Học viên' : 'Gia sư'}
        </Button>
      </form>

      <p className="text-sm text-text-secondary text-center mt-6">
        Đã có tài khoản?{' '}
        <Link to="/login" className="text-primary-600 font-medium hover:text-primary-700">
          Đăng nhập
        </Link>
      </p>
    </div>
  );
}
