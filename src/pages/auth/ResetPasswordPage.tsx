import { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { resetPassword, ApiError } from '@/services/authService';

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (!token) { setError('Invalid reset link'); return; }

    setIsLoading(true);
    setError(null);

    try {
      await resetPassword(token, password);
      setSuccess(true);
      setTimeout(() => void navigate('/login'), 2000);
    } catch (err) {
      if (err instanceof ApiError) setError(err.error.message);
      else setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <Alert variant="error">Invalid or missing reset token. <Link to="/forgot-password" className="underline">Request a new one</Link>.</Alert>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-lg border shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Set new password</h1>

        {success && <Alert variant="success" className="mb-4">Password reset! Redirecting to login...</Alert>}
        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input label="New Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} helperText="Min 8 chars with uppercase, lowercase, number" autoFocus />
          <Input label="Confirm Password" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <Button type="submit" className="w-full" isLoading={isLoading} disabled={success}>Reset password</Button>
        </form>
      </div>
    </div>
  );
}
