import { useState } from 'react';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/store/authStore';
import { useFormValidation } from '@/hooks/useFormValidation';
import { updateProfile, ApiError } from '@/services/profileService';
import { updateProfileSchema } from '@/utils/validation';

export function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const [username, setUsername] = useState(user?.username ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { errors, validate, setFieldError } = useFormValidation(updateProfileSchema);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const data = validate({ username, email, currentPassword: currentPassword || undefined, newPassword: newPassword || undefined });
    if (!data) return;

    setIsLoading(true);
    setError(null);
    setSuccess(false);

    try {
      await updateProfile({ username: data.username, email: data.email, currentPassword: data.currentPassword, newPassword: data.newPassword });
      updateUser({ username: data.username, email: data.email });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.error.fieldErrors) {
          for (const [field, msgs] of Object.entries(err.error.fieldErrors)) {
            setFieldError(field as 'username' | 'email', msgs[0]);
          }
        } else {
          setError(err.error.message);
        }
      } else {
        setError('Failed to update profile');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Profile</h1>

      <div className="bg-white rounded-lg border shadow-sm p-6">
        {success && <Alert variant="success" className="mb-4">Profile updated successfully!</Alert>}
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} error={errors.username} />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />

          <hr className="my-4" />
          <p className="text-sm font-medium text-gray-700">Change Password (optional)</p>

          <Input label="Current Password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} error={errors.currentPassword} autoComplete="current-password" />
          <Input label="New Password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} error={errors.newPassword} helperText="Min 8 chars with uppercase, lowercase, number" autoComplete="new-password" />

          <Button type="submit" isLoading={isLoading}>Save changes</Button>
        </form>
      </div>
    </div>
  );
}
