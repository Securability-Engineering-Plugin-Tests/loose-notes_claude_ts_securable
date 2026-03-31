import { Link } from 'react-router-dom';
import { FileText, Search, Star, Shield } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useAuthStore, selectIsAuthenticated } from '@/store/authStore';

export function HomePage() {
  const isAuthenticated = useAuthStore(selectIsAuthenticated);

  return (
    <div className="max-w-4xl mx-auto text-center">
      <div className="py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Loose Notes</h1>
        <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
          A secure note-taking platform. Create, share, and discover notes with built-in rating and search.
        </p>

        {isAuthenticated ? (
          <div className="flex gap-3 justify-center">
            <Link to="/notes"><Button size="lg">My Notes</Button></Link>
            <Link to="/top-rated"><Button variant="secondary" size="lg">Top Rated</Button></Link>
          </div>
        ) : (
          <div className="flex gap-3 justify-center">
            <Link to="/register"><Button size="lg">Get started</Button></Link>
            <Link to="/login"><Button variant="secondary" size="lg">Sign in</Button></Link>
          </div>
        )}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 py-8">
        {[
          { icon: FileText, title: 'Create Notes', desc: 'Rich text notes with file attachments. Public or private.' },
          { icon: Search, title: 'Search', desc: 'Full-text search across all public notes and your own.' },
          { icon: Star, title: 'Rate & Review', desc: 'Rate notes 1-5 stars with optional comments.' },
          { icon: Shield, title: 'Secure by Design', desc: 'Built with FIASSE/SSEM securable engineering principles.' },
        ].map(({ icon: Icon, title, desc }) => (
          <div key={title} className="bg-white rounded-lg border p-6 text-left">
            <Icon className="w-8 h-8 text-primary-600 mb-3" />
            <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
            <p className="text-sm text-gray-600">{desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
