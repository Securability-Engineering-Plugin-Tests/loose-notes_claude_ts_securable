import { useEffect, useState } from 'react';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { Alert } from '@/components/ui/Alert';
import { Badge } from '@/components/ui/Badge';
import { NotesByDayChart, RatingDistributionChart } from '@/components/charts/AdminCharts';
import { useApi } from '@/hooks/useApi';
import { getDashboardStats, getUsers, reassignNote } from '@/services/adminService';
import { ApiError } from '@/services/authService';
import { useToast } from '@/store/toastStore';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Select } from '@/components/ui/Select';
import type { User, AdminDashboardStats } from '@/types';
import { formatDistanceToNow } from 'date-fns';

export function AdminDashboardPage() {
  const { data: stats, isLoading, error, execute: loadStats } = useApi(getDashboardStats);
  const [users, setUsers] = useState<User[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [reassignModal, setReassignModal] = useState<{ noteId: string; currentOwner: string } | null>(null);
  const [selectedNewOwner, setSelectedNewOwner] = useState('');
  const toast = useToast();

  useEffect(() => { void loadStats(); }, [loadStats]);

  useEffect(() => {
    setUsersLoading(true);
    getUsers(userSearch || undefined)
      .then(setUsers)
      .catch(() => toast.error('Failed to load users'))
      .finally(() => setUsersLoading(false));
  }, [userSearch, toast]);

  async function handleReassign(): Promise<void> {
    if (!reassignModal || !selectedNewOwner) return;
    try {
      await reassignNote(reassignModal.noteId, selectedNewOwner);
      toast.success('Note reassigned');
      setReassignModal(null);
      void loadStats();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.error.message : 'Reassign failed');
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Dashboard</h1>

      {isLoading && <div className="flex justify-center py-8"><LoadingSpinner size="lg" /></div>}
      {error && <Alert variant="error" className="mb-4">{error}</Alert>}

      {stats && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Total Users', value: stats.totalUsers, variant: 'info' as const },
              { label: 'Total Notes', value: stats.totalNotes, variant: 'default' as const },
              { label: 'Public Notes', value: stats.publicNoteCount, variant: 'success' as const },
              { label: 'Total Ratings', value: stats.totalRatings, variant: 'warning' as const },
            ].map(({ label, value, variant }) => (
              <div key={label} className="bg-white rounded-lg border p-4 text-center">
                <div className="text-3xl font-bold text-gray-900 mb-1">{value}</div>
                <Badge variant={variant}>{label}</Badge>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg border p-4">
              <NotesByDayChart data={stats.notesByDay} />
            </div>
            <div className="bg-white rounded-lg border p-4">
              <RatingDistributionChart data={stats.ratingDistribution} />
            </div>
          </div>

          <div className="bg-white rounded-lg border p-4 mb-8">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            <div className="space-y-2">
              {stats.recentAuditLogs.slice(0, 10).map((log) => (
                <div key={log.id} className="flex items-center gap-3 text-sm border-b pb-2 last:border-0">
                  <Badge variant={log.outcome === 'success' ? 'success' : 'danger'}>{log.outcome}</Badge>
                  <span className="font-mono text-xs text-gray-500">{log.action}</span>
                  <span className="text-gray-500 text-xs ml-auto">{formatDistanceToNow(new Date(log.timestamp), { addSuffix: true })}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      <div className="bg-white rounded-lg border p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Users</h2>
          <Input
            placeholder="Search by username or email..."
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="w-64"
          />
        </div>
        {usersLoading ? <LoadingSpinner /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50"><tr>
                <th className="text-left p-2 font-medium text-gray-600">Username</th>
                <th className="text-left p-2 font-medium text-gray-600">Email</th>
                <th className="text-left p-2 font-medium text-gray-600">Role</th>
                <th className="text-left p-2 font-medium text-gray-600">Notes</th>
                <th className="text-left p-2 font-medium text-gray-600">Joined</th>
              </tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t hover:bg-gray-50">
                    <td className="p-2 font-medium">{u.username}</td>
                    <td className="p-2 text-gray-600">{u.email}</td>
                    <td className="p-2"><Badge variant={u.role === 'admin' ? 'warning' : 'default'}>{u.role}</Badge></td>
                    <td className="p-2">{u.noteCount}</td>
                    <td className="p-2 text-gray-500">{formatDistanceToNow(new Date(u.createdAt), { addSuffix: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
