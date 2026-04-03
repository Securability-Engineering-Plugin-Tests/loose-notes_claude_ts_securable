/**
 * Admin dashboard.
 *
 * SSEM: Authenticity — role check enforced server-side (not just client-side).
 * SSEM: Accountability — admin actions logged at the API layer.
 *
 * PRD §18.2 required an OS command execution interface.
 * That feature is explicitly NOT implemented — it cannot be made securable.
 */

import React, { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import type { User, AdminStats } from '../types';
import { ApiError } from '../services/api';
import RatingsChart from '../components/charts/RatingsChart';

export default function AdminPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'notes'>('overview');

  // Client-side role guard (server-side enforced separately)
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/notes');
    }
  }, [user, navigate]);

  useEffect(() => {
    void (async () => {
      try {
        const [s, u] = await Promise.all([adminService.getStats(), adminService.getUsers()]);
        setStats(s);
        setUsers(u);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Failed to load admin data.');
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  if (isLoading) return <div className="text-center text-gray-400 py-12">Loading…</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded">{error}</div>;

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      <div className="flex gap-2 mb-6">
        {(['overview', 'users', 'notes'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded text-sm font-medium ${activeTab === tab ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: stats.totalUsers },
            { label: 'Total Notes', value: stats.totalNotes },
            { label: 'Public Notes', value: stats.publicNotes },
            { label: 'Total Ratings', value: stats.totalRatings },
          ].map(({ label, value }) => (
            <div key={label} className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className="text-2xl font-bold text-gray-900">{value}</div>
              <div className="text-sm text-gray-500 mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Username', 'Email', 'Role', 'Joined'].map(h => (
                  <th key={h} className="text-left px-4 py-3 font-medium text-gray-600">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-gray-50">
                  {/* All values rendered via JSX — HTML-escaped */}
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{new Date(u.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <RatingsChart
            distribution={{}}
            title="Note ratings distribution (placeholder)"
          />
          <p className="text-sm text-gray-500 mt-4">
            Note management and ownership reassignment are available via the API.
          </p>
        </div>
      )}
    </div>
  );
}
