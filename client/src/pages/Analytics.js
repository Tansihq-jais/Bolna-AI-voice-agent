import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid } from 'recharts';
import api from '../api';

export default function Analytics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/analytics/overview').then(r => { setData(r.data.data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const costByDay = Array.isArray(data?.costByDay) ? [...data.costByDay].reverse() : [];
  const callsByStatus = Array.isArray(data?.callsByStatus) ? data.callsByStatus : [];
  const stats = data?.stats || {};

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Platform-wide performance metrics</p>
        </div>
      </div>

      <div className="stats-grid">
        {[
          { label: 'Total Campaigns', value: stats.total_campaigns || 0 },
          { label: 'Total Calls', value: stats.total_calls || 0 },
          { label: 'Answer Rate', value: stats.total_calls > 0 ? `${((stats.completed_calls / stats.total_calls) * 100).toFixed(1)}%` : '0%' },
          { label: 'Avg Duration', value: `${Math.round(stats.avg_duration || 0)}s` },
          { label: 'Total Duration', value: formatDuration(stats.total_duration || 0) },
          { label: 'Total Spend', value: `$${(stats.total_cost || 0).toFixed(2)}` },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">Daily Calls</div>
          {costByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={costByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #2d2d4e', borderRadius: 8 }} />
                <Bar dataKey="calls" fill="#6366f1" radius={[4, 4, 0, 0]} name="Calls" />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state" style={{ padding: 40 }}><p>No data yet</p></div>}
        </div>

        <div className="card">
          <div className="card-title">Daily Cost ($)</div>
          {costByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={costByDay}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e1e2e" />
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `$${v.toFixed(2)}`} />
                <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #2d2d4e', borderRadius: 8 }} formatter={v => [`$${parseFloat(v).toFixed(4)}`, 'Cost']} />
                <Line type="monotone" dataKey="cost" stroke="#fbbf24" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : <div className="empty-state" style={{ padding: 40 }}><p>No data yet</p></div>}
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-title">Call Status Breakdown</div>
        {callsByStatus.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Status</th><th>Count</th><th>Percentage</th><th>Distribution</th></tr></thead>
              <tbody>
                {callsByStatus.map(s => {
                  const pct = stats.total_calls > 0 ? ((s.count / stats.total_calls) * 100).toFixed(1) : 0;
                  return (
                    <tr key={s.status}>
                      <td><span className={`badge badge-${s.status === 'completed' ? 'completed' : s.status === 'failed' ? 'failed' : s.status === 'no-answer' ? 'no-answer' : 'pending'}`}>{s.status}</span></td>
                      <td>{s.count}</td>
                      <td>{pct}%</td>
                      <td style={{ width: 200 }}>
                        <div className="progress-bar">
                          <div className="progress-fill blue" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state" style={{ padding: 40 }}><p>No call data yet</p></div>}
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${seconds}s`;
}
