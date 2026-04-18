import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, CheckCircle, XCircle, DollarSign, Clock, TrendingUp, Plus } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import api from '../api';

const COLORS = ['#6366f1', '#22c55e', '#f97316', '#ef4444', '#94a3b8'];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/analytics/overview')
      .then(r => { 
        setData(r.data.data); 
        setLoading(false); 
      })
      .catch(err => {
        console.error('Dashboard API error:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  
  if (error) {
    return (
      <div className="page">
        <div className="card" style={{ textAlign: 'center', padding: '40px' }}>
          <h3 style={{ color: '#f87171', marginBottom: '16px' }}>Dashboard Error</h3>
          <p style={{ color: '#94a3b8', marginBottom: '20px' }}>Failed to load dashboard data: {error}</p>
          <button 
            className="btn btn-primary" 
            onClick={() => window.location.reload()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = data?.stats || {};
  const callsByStatus = data?.callsByStatus || [];
  const costByDay = Array.isArray(data?.costByDay) ? [...data.costByDay].reverse() : [];

  const statCards = [
    { label: 'Total Campaigns', value: stats.total_campaigns || 0, icon: Phone, color: '#6366f1', bg: '#1e1b4b' },
    { label: 'Total Calls', value: stats.total_calls || 0, icon: TrendingUp, color: '#22c55e', bg: '#14532d' },
    { label: 'Completed', value: stats.completed_calls || 0, icon: CheckCircle, color: '#4ade80', bg: '#14532d' },
    { label: 'Failed', value: stats.failed_calls || 0, icon: XCircle, color: '#f87171', bg: '#450a0a' },
    { label: 'Total Cost', value: `$${(stats.total_cost || 0).toFixed(2)}`, icon: DollarSign, color: '#fbbf24', bg: '#451a03' },
    { label: 'Avg Duration', value: `${Math.round(stats.avg_duration || 0)}s`, icon: Clock, color: '#60a5fa', bg: '#1e3a5f' },
  ];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Voice AI Campaign Overview</p>
        </div>
        <Link to="/campaigns/new" className="btn btn-primary"><Plus size={16} /> New Campaign</Link>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="stat-card">
            <div className="stat-icon" style={{ background: bg }}><Icon size={20} color={color} /></div>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ color }}>{value}</div>
          </div>
        ))}
      </div>

      <div className="grid-2">
        {/* Cost over time */}
        <div className="card">
          <div className="card-title">Cost Over Time (Last 30 Days)</div>
          {costByDay.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={costByDay}>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `$${v.toFixed(2)}`} />
                <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #2d2d4e', borderRadius: 8 }} formatter={v => [`$${parseFloat(v).toFixed(4)}`, 'Cost']} />
                <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <div className="empty-state" style={{ padding: '40px 0' }}><p>No billing data yet</p></div>}
        </div>

        {/* Calls by status */}
        <div className="card">
          <div className="card-title">Calls by Status</div>
          {callsByStatus.length > 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie data={callsByStatus} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80}>
                    {callsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #2d2d4e', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ flex: 1 }}>
                {callsByStatus.map((s, i) => (
                  <div key={s.status} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'inline-block' }} />
                      {s.status}
                    </span>
                    <span style={{ color: '#94a3b8' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : <div className="empty-state" style={{ padding: '40px 0' }}><p>No call data yet</p></div>}
        </div>
      </div>

      {/* Recent campaigns */}
      <div className="card mt-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title" style={{ marginBottom: 0 }}>Recent Campaigns</div>
          <Link to="/campaigns" className="btn btn-secondary btn-sm">View All</Link>
        </div>
        {data?.recentCampaigns?.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Name</th><th>Status</th><th>Contacts</th><th>Completed</th><th>Progress</th></tr></thead>
              <tbody>
                {data.recentCampaigns.map(c => (
                  <tr key={c.id}>
                    <td><Link to={`/campaigns/${c.id}`} style={{ color: '#a78bfa', textDecoration: 'none' }}>{c.name}</Link></td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{c.total_contacts}</td>
                    <td>{c.completed}</td>
                    <td style={{ width: 120 }}>
                      <div className="progress-bar">
                        <div className="progress-fill blue" style={{ width: `${c.total_contacts > 0 ? (c.completed / c.total_contacts) * 100 : 0}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">📞</div>
            <h3>No campaigns yet</h3>
            <p>Create your first voice campaign to get started</p>
            <Link to="/campaigns/new" className="btn btn-primary" style={{ marginTop: 16 }}><Plus size={16} /> Create Campaign</Link>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }) {
  const map = { running: 'badge-running', completed: 'badge-completed', failed: 'badge-failed', pending: 'badge-pending', scheduled: 'badge-scheduled', stopped: 'badge-stopped', draft: 'badge-draft' };
  return <span className={`badge ${map[status] || 'badge-pending'}`}>{status}</span>;
}
