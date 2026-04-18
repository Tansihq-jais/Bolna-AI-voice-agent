import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { RefreshCw, StopCircle, ArrowLeft, Phone, Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts';
import toast from 'react-hot-toast';
import api from '../api';

const COLORS = ['#22c55e', '#ef4444', '#f97316', '#94a3b8', '#60a5fa', '#a78bfa'];

function StatusBadge({ status }) {
  const map = { completed: 'badge-completed', failed: 'badge-failed', 'no-answer': 'badge-no-answer', pending: 'badge-pending', 'in-progress': 'badge-in-progress', busy: 'badge-no-answer', running: 'badge-running', scheduled: 'badge-scheduled', stopped: 'badge-stopped' };
  return <span className={`badge ${map[status] || 'badge-pending'}`}>{status}</span>;
}

export default function CampaignDetail() {
  const { id } = useParams();
  const [campaign, setCampaign] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [tab, setTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [contactPage, setContactPage] = useState(1);
  const [contactTotal, setContactTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [campRes, analyticsRes] = await Promise.all([
        api.get(`/campaigns/${id}`),
        api.get(`/analytics/campaign/${id}`),
      ]);
      setCampaign(campRes.data.data);
      setAnalytics(analyticsRes.data.data);
    } catch (e) { toast.error('Failed to load campaign'); }
    setLoading(false);
  };

  const loadContacts = async () => {
    try {
      const r = await api.get(`/contacts/campaign/${id}`, { params: { page: contactPage, limit: 50, status: statusFilter || undefined } });
      setContacts(r.data.data || []);
      setContactTotal(r.data.total || 0);
    } catch (e) {}
  };

  useEffect(() => { load(); }, [id]);
  useEffect(() => { if (tab === 'contacts') loadContacts(); }, [tab, contactPage, statusFilter, id]);

  const sync = async () => {
    setSyncing(true);
    try {
      await api.post(`/campaigns/${id}/sync`);
      toast.success('Synced with Bolna');
      await load();
    } catch (e) { toast.error('Sync failed: ' + (e.response?.data?.error || e.message)); }
    setSyncing(false);
  };

  const stop = async () => {
    if (!window.confirm('Stop this campaign?')) return;
    try {
      await api.post(`/campaigns/${id}/stop`);
      toast.success('Campaign stopped');
      load();
    } catch (e) { toast.error('Failed to stop'); }
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;
  if (!campaign) return <div className="page"><p>Campaign not found</p></div>;

  const stats = campaign.stats || {};
  const answerRate = stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0;

  const pieData = [
    { name: 'Completed', value: stats.completed || 0 },
    { name: 'Failed', value: stats.failed || 0 },
    { name: 'No Answer', value: stats.no_answer || 0 },
    { name: 'Pending', value: stats.pending || 0 },
    { name: 'In Progress', value: stats.in_progress || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link to="/campaigns" className="btn btn-secondary btn-sm"><ArrowLeft size={14} /></Link>
          <div>
            <h1 className="page-title">{campaign.name}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4 }}>
              <StatusBadge status={campaign.status} />
              {campaign.description && <span className="text-muted" style={{ fontSize: 13 }}>{campaign.description}</span>}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-secondary" onClick={sync} disabled={syncing}>
            <RefreshCw size={16} className={syncing ? 'spinning' : ''} /> Sync
          </button>
          {campaign.status === 'running' && (
            <button className="btn btn-danger" onClick={stop}><StopCircle size={16} /> Stop</button>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        {[
          { label: 'Total', value: stats.total || 0, color: '#e2e8f0' },
          { label: 'Completed', value: stats.completed || 0, color: '#4ade80' },
          { label: 'Failed', value: stats.failed || 0, color: '#f87171' },
          { label: 'No Answer', value: stats.no_answer || 0, color: '#fb923c' },
          { label: 'Answer Rate', value: `${answerRate}%`, color: '#60a5fa' },
          { label: 'Total Cost', value: `$${(stats.total_cost || 0).toFixed(4)}`, color: '#fbbf24' },
        ].map(({ label, value, color }) => (
          <div key={label} className="stat-card" style={{ padding: 16 }}>
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: 22, color }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="card mb-4">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13 }}>
          <span className="text-muted">Campaign Progress</span>
          <span style={{ color: '#e2e8f0' }}>{stats.completed || 0} / {stats.total || 0}</span>
        </div>
        <div className="progress-bar" style={{ height: 10 }}>
          <div className="progress-fill green" style={{ width: `${stats.total > 0 ? ((stats.completed || 0) / stats.total) * 100 : 0}%` }} />
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {['overview', 'contacts', 'insights'].map(t => (
          <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Overview tab */}
      {tab === 'overview' && (
        <div className="grid-2">
          <div className="card">
            <div className="card-title">Call Distribution</div>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #2d2d4e', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : <div className="empty-state" style={{ padding: 40 }}><p>No call data yet</p></div>}
          </div>

          <div className="card">
            <div className="card-title">Campaign Info</div>
            {[
              ['Agent ID', campaign.agent_id],
              ['Batch ID', campaign.batch_id || 'N/A'],
              ['From Number', campaign.from_phone_number || 'Bolna Default'],
              ['Scheduled', campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : 'Immediate'],
              ['Created', new Date(campaign.created_at).toLocaleString()],
              ['Avg Duration', `${Math.round(stats.avg_duration || 0)}s`],
              ['Total Duration', formatDuration(stats.total_duration || 0)],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #1a1a2e', fontSize: 13 }}>
                <span className="text-muted">{label}</span>
                <span style={{ color: '#e2e8f0', fontFamily: label.includes('ID') ? 'monospace' : 'inherit', fontSize: label.includes('ID') ? 11 : 13 }}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contacts tab */}
      {tab === 'contacts' && (
        <div className="card">
          <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
            <select className="form-select" style={{ width: 160 }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setContactPage(1); }}>
              <option value="">All Status</option>
              {['pending', 'in-progress', 'completed', 'failed', 'no-answer', 'busy'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <span className="text-muted" style={{ fontSize: 13, alignSelf: 'center' }}>{contactTotal} contacts</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Phone</th><th>Name</th><th>Status</th><th>Duration</th><th>Cost</th><th>Transcript</th><th>Called At</th></tr></thead>
              <tbody>
                {contacts.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: 'center', color: '#475569', padding: 40 }}>No contacts found</td></tr>
                ) : contacts.map(c => (
                  <tr key={c.id}>
                    <td className="font-mono">{c.contact_number}</td>
                    <td>{c.name || '-'}</td>
                    <td><StatusBadge status={c.status} /></td>
                    <td>{c.call_duration ? `${c.call_duration}s` : '-'}</td>
                    <td>{c.call_cost ? `$${parseFloat(c.call_cost).toFixed(4)}` : '-'}</td>
                    <td>
                      {c.transcript ? (
                        <span className="truncate" title={c.transcript} style={{ fontSize: 12, color: '#64748b' }}>
                          {c.transcript.slice(0, 60)}...
                        </span>
                      ) : '-'}
                    </td>
                    <td style={{ fontSize: 12, color: '#475569' }}>{c.called_at ? new Date(c.called_at).toLocaleString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {contactTotal > 50 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 16 }}>
              <button className="btn btn-secondary btn-sm" onClick={() => setContactPage(p => Math.max(1, p - 1))} disabled={contactPage === 1}>← Prev</button>
              <span style={{ fontSize: 13, color: '#64748b', alignSelf: 'center' }}>Page {contactPage}</span>
              <button className="btn btn-secondary btn-sm" onClick={() => setContactPage(p => p + 1)} disabled={contacts.length < 50}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Insights tab */}
      {tab === 'insights' && analytics && (
        <div>
          <div className="grid-2">
            <div className="card">
              <div className="card-title">Call Timing (Hour of Day)</div>
              {analytics.hourlyDist?.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={analytics.hourlyDist}>
                    <XAxis dataKey="hour" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={h => `${h}:00`} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1e1e2e', border: '1px solid #2d2d4e', borderRadius: 8 }} />
                    <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <div className="empty-state" style={{ padding: 40 }}><p>No timing data yet</p></div>}
            </div>

            <div className="card">
              <div className="card-title">Extracted Data Insights</div>
              {Object.keys(analytics.extractedInsights || {}).length > 0 ? (
                <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                  {Object.entries(analytics.extractedInsights).map(([key, vals]) => (
                    <div key={key} style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginBottom: 8 }}>{key}</div>
                      {Object.entries(vals).slice(0, 5).map(([val, count]) => (
                        <div key={val} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                          <span style={{ color: '#cbd5e1' }}>{val}</span>
                          <span style={{ color: '#6366f1', fontWeight: 600 }}>{count}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ) : <div className="empty-state" style={{ padding: 40 }}><p>No extracted data yet</p></div>}
            </div>
          </div>

          <div className="card mt-4">
            <div className="card-title">Performance Summary</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
              {[
                { label: 'Answer Rate', value: `${analytics.stats?.answer_rate || 0}%`, color: '#4ade80' },
                { label: 'Avg Duration', value: `${Math.round(analytics.stats?.avg_duration || 0)}s`, color: '#60a5fa' },
                { label: 'Max Duration', value: `${analytics.stats?.max_duration || 0}s`, color: '#a78bfa' },
                { label: 'Total Cost', value: `$${(analytics.stats?.total_cost || 0).toFixed(4)}`, color: '#fbbf24' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: 16, background: '#0f0f1a', borderRadius: 8, border: '1px solid #1e1e2e' }}>
                  <div style={{ fontSize: 12, color: '#64748b' }}>{label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color, marginTop: 4 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds) return '0s';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}
