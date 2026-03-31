// Admin dashboard charts using Recharts
// Analyzability: each chart is a single-purpose component

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line,
} from 'recharts';

interface NotesByDayChartProps {
  data: Array<{ date: string; count: number }>;
}

export function NotesByDayChart({ data }: NotesByDayChartProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">Notes Created (Last 14 Days)</h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d: string) => d.slice(5)} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip labelFormatter={(l: string) => `Date: ${l}`} />
          <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={false} name="Notes" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface RatingDistributionChartProps {
  data: Array<{ value: number; count: number }>;
}

export function RatingDistributionChart({ data }: RatingDistributionChartProps) {
  return (
    <div>
      <h3 className="text-sm font-medium text-gray-700 mb-3">Rating Distribution</h3>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={data} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="value" tickFormatter={(v: number) => `★ ${v}`} tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
          <Tooltip formatter={(v: number) => [`${v} ratings`, 'Count']} />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Ratings" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
