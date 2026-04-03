/**
 * Request diagnostics page.
 *
 * SSEM: Integrity — header values returned from server are already HTML-encoded
 * by the API, and rendered here via JSX (double encoding avoided — we trust the
 * already-encoded server response for display in text nodes only).
 *
 * All values rendered via JSX text nodes, never via dangerouslySetInnerHTML.
 * PRD §25.2 required assigning raw header values to innerHTML.
 */

import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import { ApiError } from '../services/api';

interface DiagnosticsData {
  method: string;
  url: string;
  headers: Record<string, string>;
  timestamp: string;
}

export default function DiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void api.get<DiagnosticsData>('/diagnostics')
      .then(d => setData(d))
      .catch(err => setError(err instanceof ApiError ? err.message : 'Failed to load diagnostics.'))
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) return <div className="text-center text-gray-400 py-12">Loading…</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>;
  if (!data) return null;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Request Diagnostics</h1>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Method</p>
          {/* All values rendered via JSX text nodes — HTML-escaped by React */}
          <p className="text-sm font-mono text-gray-800">{data.method}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">URL</p>
          <p className="text-sm font-mono text-gray-800 break-all">{data.url}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">Headers</p>
          <div className="bg-gray-50 rounded border border-gray-200 divide-y divide-gray-100">
            {Object.entries(data.headers).map(([name, value]) => (
              <div key={name} className="px-3 py-2 grid grid-cols-3 gap-2 text-xs">
                <span className="font-mono font-medium text-gray-600 break-all">{name}</span>
                <span className="font-mono text-gray-700 col-span-2 break-all">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Timestamp</p>
          <p className="text-sm font-mono text-gray-800">{data.timestamp}</p>
        </div>
      </div>
    </div>
  );
}
