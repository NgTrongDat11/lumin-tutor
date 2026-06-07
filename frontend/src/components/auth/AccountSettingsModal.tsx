import { useState, useRef } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { authApi } from '../../services/api';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Avatar from '../ui/Avatar';
import { useToast } from '../ui/Toast';
import axios from 'axios';

export default function AccountSettingsModal({ onClose }: { onClose: () => void }) {
  const { user, refresh } = useAuth();
  const { toast } = useToast();
  
  const [tab, setTab] = useState<'profile' | 'password'>('profile');
  
  // Password state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  
  // Avatar state
  const [avatarLoading, setAvatarLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast('error', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
      return;
    }
    setPassLoading(true);
    try {
      await authApi.updatePassword({ old_password: oldPassword, new_password: newPassword });
      toast('success', 'Đổi mật khẩu thành công.');
      setOldPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      let msg = 'Đổi mật khẩu thất bại.';
      if (err && typeof err === 'object' && 'response' in err) {
        const errorData = (err as any).response?.data;
        if (errorData?.detail) msg = errorData.detail;
      }
      toast('error', msg);
    } finally {
      setPassLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('error', 'Chỉ chấp nhận file hình ảnh.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('error', 'Kích thước file không được vượt quá 2MB.');
      return;
    }

    setAvatarLoading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', 'avatars');

    const token = localStorage.getItem('access_token');

    try {
      // Use axios directly to upload file to storage
      const res = await axios.post(
        `${import.meta.env.VITE_API_BASE_URL || '/api/v1'}/storage/upload`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      if (res.data?.data?.file_url) {
        toast('success', 'Cập nhật ảnh đại diện thành công.');
        await refresh();
      }
    } catch {
      toast('error', 'Lỗi tải ảnh lên.');
    } finally {
      setAvatarLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <Modal open={true} onClose={onClose} title="Thông tin tài khoản" size="sm">
      <div className="flex border-b border-border-light mb-4">
        <button
          className={`flex-1 py-2 text-sm font-semibold transition-colors border-b-2 ${tab === 'profile' ? 'border-primary-600 text-primary-700' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
          onClick={() => setTab('profile')}
        >
          Hồ sơ
        </button>
        <button
          className={`flex-1 py-2 text-sm font-semibold transition-colors border-b-2 ${tab === 'password' ? 'border-primary-600 text-primary-700' : 'border-transparent text-text-tertiary hover:text-text-secondary'}`}
          onClick={() => setTab('password')}
        >
          Mật khẩu
        </button>
      </div>

      {tab === 'profile' && (
        <div className="space-y-6 py-2">
          <div className="flex flex-col items-center justify-center gap-4">
            <Avatar name={user.full_name} src={user.avatar_url || undefined} size="xl" />
            <div className="flex flex-col items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                loading={avatarLoading}
                onClick={() => fileInputRef.current?.click()}
              >
                Đổi ảnh đại diện
              </Button>
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/*" 
                onChange={handleAvatarChange} 
              />
              <p className="text-[10px] text-text-tertiary text-center">
                JPG, PNG. Tối đa 2MB.
              </p>
            </div>
          </div>
          <div className="space-y-3 bg-surface-secondary p-4 rounded-lg">
            <div>
              <span className="text-xs text-text-tertiary">Họ và tên</span>
              <p className="text-sm font-medium">{user.full_name}</p>
            </div>
            <div>
              <span className="text-xs text-text-tertiary">Email</span>
              <p className="text-sm font-medium">{user.email}</p>
            </div>
            <div>
              <span className="text-xs text-text-tertiary">Vai trò</span>
              <p className="text-sm font-medium">{user.role}</p>
            </div>
          </div>
        </div>
      )}

      {tab === 'password' && (
        <form onSubmit={handlePasswordChange} className="space-y-4 py-2">
          <Input 
            label="Mật khẩu hiện tại" 
            type="password" 
            required 
            value={oldPassword}
            onChange={(e) => setOldPassword(e.target.value)}
          />
          <Input 
            label="Mật khẩu mới" 
            type="password" 
            required 
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <p className="text-xs text-text-tertiary">Mật khẩu phải có ít nhất 6 ký tự.</p>
          <div className="pt-2">
            <Button type="submit" className="w-full" loading={passLoading}>
              Cập nhật mật khẩu
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
