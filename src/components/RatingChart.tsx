import type React from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ApiRating } from '../types';

/**
 * Distribution of 1-5 ratings, rendered with Recharts.
 * Computes from typed records — chart props are derived from a typed array,
 * never spread from untyped server payloads.
 */
export default function RatingChart({ ratings }: { ratings: ApiRating[] }): React.ReactElement {
  const data = [1, 2, 3, 4, 5].map((score) => ({
    score: `${score}★`,
    count: ratings.filter((r) => r.score === score).length,
  }));
  return (
    <div className="w-full h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 10, right: 16, bottom: 10, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="score" />
          <YAxis allowDecimals={false} />
          <Tooltip />
          <Bar dataKey="count" fill="#5b6bff" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
