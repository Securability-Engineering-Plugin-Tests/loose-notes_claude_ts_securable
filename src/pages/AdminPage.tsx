import type React from 'react';
import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api, ApiError } from '../lib/api';
import type { ApiStats, ApiUser } from '../types';
import ErrorBanner from '../components/ErrorBanner';

const PILL_COLORS: Record<string, string> = {
  allow: '#16a34a',
  deny: '#dc2626',
  error: '#ea580c',
  info: '#475569',
};

export default function AdminPage(): React.ReactElement {
  const [stats, setStats] = useState<ApiStats | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [error, setError] = useState<{ message: string; requestId?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([api.adminStats(), api.adminUsers()])
      .then(([s, u]) => {
        if (cancelled) return;
        setStats(s);
        setUsers(u);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) setError({ message: err.message, requestId: err.requestId });
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <p className="text-slate-500">Loading…</p>;
  if (!stats) return <ErrorBanner message={error?.message ?? 'Could not load admin data'} requestId={error?.requestId} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admin dashboard</h1>
      <ErrorBanner message={error?.message ?? ''} requestId={error?.requestId} />

      <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <Stat label="Users" value={stats.summary.totalUsers} />
        <Stat label="Notes" value={stats.summary.totalNotes} />
        <Stat label="Public notes" value={stats.summary.publicNotes} />
        <Stat label="Ratings" value={stats.summary.totalRatings} />
        <Stat label="Attachments" value={stats.summary.totalAttachments} />
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Notes per day (last 14 days)</h2>
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.notesPerDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="count" fill="#5b6bff" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Recent audit events</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-4">Time</th>
                <th className="pr-4">Event</th>
                <th className="pr-4">Outcome</th>
                <th className="pr-4">Actor</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentAudit.map((e) => (
                <tr key={e.id} className="border-t border-slate-100 align-top">
                  <td className="py-2 pr-4 text-slate-500 whitespace-nowrap">{new Date(e.ts).toLocaleString()}</td>
                  <td className="pr-4 font-mono text-xs">{e.event}</td>
                  <td className="pr-4">
                    <span className="inline-block px-2 rounded text-white text-xs"
                      style={{ backgroundColor: PILL_COLORS[e.outcome] ?? '#475569' }}>
                      {e.outcome}
                    </span>
                  </td>
                  <td className="pr-4 text-slate-600">{e.actorId ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4">
        <h2 className="font-semibold mb-3">Users</h2>
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left text-slate-500">
              <th className="py-2 pr-4">Username</th>
              <th className="pr-4">Email</th>
              <th className="pr-4">Role</th>
              <th className="pr-4">Created</th>
              <th className="pr-4">Last login</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="py-2 pr-4 font-medium">{u.username}</td>
                <td className="pr-4">{u.email}</td>
                <td className="pr-4">{u.role}</td>
                <td className="pr-4 text-slate-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="pr-4 text-slate-500">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="card p-3">
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
