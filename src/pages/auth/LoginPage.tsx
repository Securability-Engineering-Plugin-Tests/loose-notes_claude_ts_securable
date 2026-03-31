import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/store/authStore';
import { useFormValidation } from '@/hooks/useFormValidation';
import { login, ApiError } from '@/services/authService';
import { loginSchema } from '@/utils/validation';
import { logger } from '@/utils/logger';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { errors, validate, setFieldError } = useFormValidation(loginSchema);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const data = validate({ username, password });
    if (!data) return;

    setIsLoading(true);
    setError(null);

    try {
      const session = await login({ username: data.username, password: data.password });
      setAuth(session.user, session.token);
      logger.securityEvent('user.login', 'success', { userId: session.user.id });
      void navigate('/notes');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.error.fieldErrors) {
          for (const [field, messages] of Object.entries(err.error.fieldErrors)) {
            setFieldError(field as keyof typeof data, messages[0]);
          }
        } else {
          setError(err.error.message);
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-lg border shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Sign in</h1>
        <p className="text-gray-600 text-sm mb-6">
          Demo: <code className="bg-gray-100 px-1 rounded">admin / Admin123!</code>
        </p>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} error={errors.username} autoComplete="username" autoFocus />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} autoComplete="current-password" />
          <Button type="submit" className="w-full" isLoading={isLoading}>Sign in</Button>
        </form>

        <div className="mt-4 text-sm text-center space-y-2">
          <Link to="/forgot-password" className="text-primary-600 hover:underline block">Forgot password?</Link>
          <span className="text-gray-500">No account? <Link to="/register" className="text-primary-600 hover:underline">Register</Link></span>
        </div>
      </div>
    </div>
  );
}
