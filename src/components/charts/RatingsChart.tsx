import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

interface RatingsChartProps {
  distribution: Record<number, number>;
  title?: string;
}

const COLORS = ['#ef4444', '#f97316', '#eab308', '#84cc16', '#22c55e'];

export default function RatingsChart({ distribution, title }: RatingsChartProps) {
  const data = [1, 2, 3, 4, 5].map(score => ({
    score: `${score}★`,
    count: distribution[score] ?? 0,
  }));

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      {title && <h3 className="text-sm font-medium text-gray-700 mb-3">{title}</h3>}
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="score" tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
