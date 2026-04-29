import type React from 'react';
import { Link } from 'react-router-dom';

export default function NotFoundPage(): React.ReactElement {
  return (
    <div className="text-center py-16">
      <h1 className="text-3xl font-semibold mb-2">Not found</h1>
      <p className="text-slate-600 mb-4">We couldn&apos;t find what you were looking for.</p>
      <Link to="/" className="btn-primary">Back home</Link>
    </div>
  );
}
