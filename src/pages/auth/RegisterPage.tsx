import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { useAuthStore } from '@/store/authStore';
import { useFormValidation } from '@/hooks/useFormValidation';
import { register, ApiError } from '@/services/authService';
import { registerSchema } from '@/utils/validation';

export function RegisterPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { errors, validate, setFieldError } = useFormValidation(registerSchema);
  const setAuth = useAuthStore((s) => s.setAuth);
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    const data = validate({ username, email, password });
    if (!data) return;

    setIsLoading(true);
    setError(null);

    try {
      const session = await register({ username: data.username, email: data.email, password: data.password });
      setAuth(session.user, session.token);
      void navigate('/notes');
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.error.fieldErrors) {
          for (const [field, messages] of Object.entries(err.error.fieldErrors)) {
            setFieldError(field as 'username' | 'email' | 'password', messages[0]);
          }
        } else {
          setError(err.error.message);
        }
      } else {
        setError('An unexpected error occurred.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-lg border shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create account</h1>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input label="Username" value={username} onChange={(e) => setUsername(e.target.value)} error={errors.username} helperText="3-30 chars: letters, numbers, _ or -" autoFocus />
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} autoComplete="email" />
          <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} helperText="Min 8 chars with uppercase, lowercase, number" autoComplete="new-password" />
          <Button type="submit" className="w-full" isLoading={isLoading}>Create account</Button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-500">
          Already have an account? <Link to="/login" className="text-primary-600 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
