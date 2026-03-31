import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/Button';

export function NotFoundPage() {
  return (
    <div className="max-w-md mx-auto text-center mt-16">
      <h1 className="text-6xl font-bold text-gray-200 mb-4">404</h1>
      <p className="text-xl text-gray-700 mb-2">Page Not Found</p>
      <p className="text-gray-500 mb-8">The page you're looking for doesn't exist.</p>
      <Link to="/"><Button variant="secondary">Go home</Button></Link>
    </div>
  );
}
