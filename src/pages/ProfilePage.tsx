import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '../services/authService';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/api';
import type { User } from '../types';

const UpdateProfileSchema = z.object({
  email: z.string().email('Valid email required').max(254).optional().or(z.literal('')),
  currentPassword: z.string().min(1, 'Current password required').max(128),
  newPassword: z.string().min(12, 'At least 12 characters').max(128).optional().or(z.literal('')),
  confirmPassword: z.string().max(128).optional().or(z.literal('')),
}).refine(d => !d.newPassword || d.newPassword === d.confirmPassword, {
  message: 'Passwords do not match', path: ['confirmPassword'],
});
type UpdateProfileData = z.infer<typeof UpdateProfileSchema>;

export default function ProfilePage() {
  const { refreshProfile } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<UpdateProfileData>({
    resolver: zodResolver(UpdateProfileSchema),
  });

  useEffect(() => {
    void (async () => {
      try {
        const user = await authService.getProfile();
        setProfile(user);
      } catch {
        setServerError('Failed to load profile.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const onSubmit = async (data: UpdateProfileData) => {
    setServerError(null);
    setSuccess(null);
    try {
      await authService.updateProfile({
        email: data.email || undefined,
        currentPassword: data.currentPassword,
        newPassword: data.newPassword || undefined,
        confirmPassword: data.confirmPassword || undefined,
      });
      setSuccess('Profile updated successfully.');
      await refreshProfile();
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Update failed.');
    }
  };

  if (isLoading) return <div className="text-center text-gray-400 py-12">Loading…</div>;

  return (
    <div className="max-w-md mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Profile</h1>

      {profile && (
        <div className="bg-gray-50 rounded-lg border border-gray-200 p-4 mb-6 text-sm space-y-1">
          {/* Profile fields rendered via JSX — escaped */}
          <p><span className="font-medium">Username:</span> {profile.username}</p>
          <p><span className="font-medium">Email:</span> {profile.email}</p>
          <p><span className="font-medium">Role:</span> {profile.role}</p>
          <p><span className="font-medium">Member since:</span> {new Date(profile.createdAt).toLocaleDateString()}</p>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Update profile</h2>

        {success && <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">{success}</div>}
        {serverError && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{serverError}</div>}

        <form onSubmit={void handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">New email (optional)</label>
            <input id="email" type="email" autoComplete="email" {...register('email')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email.message}</p>}
          </div>

          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Current password <span className="text-red-500">*</span></label>
            <input id="currentPassword" type="password" autoComplete="current-password" {...register('currentPassword')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            {errors.currentPassword && <p className="text-xs text-red-600 mt-1">{errors.currentPassword.message}</p>}
          </div>

          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">New password (optional)</label>
            <input id="newPassword" type="password" autoComplete="new-password" {...register('newPassword')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            {errors.newPassword && <p className="text-xs text-red-600 mt-1">{errors.newPassword.message}</p>}
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
            <input id="confirmPassword" type="password" autoComplete="new-password" {...register('confirmPassword')} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            {errors.confirmPassword && <p className="text-xs text-red-600 mt-1">{errors.confirmPassword.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white py-2 rounded text-sm font-medium">
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
