import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Alert } from '@/components/ui/Alert';
import { forgotPassword, ApiError } from '@/services/authService';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError(null);

    try {
      await forgotPassword(email.trim().toLowerCase());
      setSubmitted(true);
    } catch (err) {
      if (err instanceof ApiError) setError(err.error.message);
      else setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto mt-16">
        <div className="bg-white rounded-lg border shadow-sm p-8 text-center">
          <h1 className="text-2xl font-bold mb-4">Check your email</h1>
          <p className="text-gray-600 mb-6">If that email exists in our system, we sent a reset link.</p>
          <Link to="/login" className="text-primary-600 hover:underline">Back to login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto mt-16">
      <div className="bg-white rounded-lg border shadow-sm p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Reset password</h1>
        <p className="text-gray-600 text-sm mb-6">Enter your email address and we'll send a reset link.</p>

        {error && <Alert variant="error" className="mb-4">{error}</Alert>}

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus required />
          <Button type="submit" className="w-full" isLoading={isLoading}>Send reset link</Button>
        </form>

        <p className="mt-4 text-sm text-center text-gray-500">
          <Link to="/login" className="text-primary-600 hover:underline">Back to login</Link>
        </p>
      </div>
    </div>
  );
}
