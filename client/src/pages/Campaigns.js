import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, Search } from 'lucide-react';
import api from '../api';
import toast from 'react-hot-toast';

function StatusBadge({ status }) {
  const map = { running: 'badge-running', completed: 'badge-completed', failed: 'badge-failed', pending: 'badge-pending', scheduled: 'badge-scheduled', stopped: 'badge-stopped', draft: 'badge-draft' };
  return <span className={`badge ${map[status] || 'badge-pending'}`}>{status}</span>;
}

export default function Campaigns() {
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [syncing, setSyncing] = useState({});

  const load = () => {
    setLoading(true);
    api.get('/campaigns').then(r => { setCampaigns(r.data.data || []); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const syncCampaign = async (id) => {
    setSyncing(s => ({ ...s, [id]: true }));
    try {
      await api.post(`/campaigns/${id}/sync`);
      toast.success('Campaign synced');
      load();
    } catch (e) {
      toast.error('Sync failed: ' + (e.response?.data?.error || e.message));
    }
    setSyncing(s => ({ ...s, [id]: false }));
  };

  const stopCampaign = async (id) => {
    if (!window.confirm('Stop this campaign?')) return;
    try {
      await api.post(`/campaigns/${id}/stop`);
      toast.success('Campaign stopped');
      load();
    } catch (e) {
      toast.error('Failed to stop campaign');
    }
  };

  const filtered = campaigns.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Campaigns</h1>
          <p className="page-subtitle">{campaigns.length} total campaigns</p>
        </div>
        <Link to="/campaigns/new" className="btn btn-primary"><Plus size={16} /> New Campaign</Link>
      </div>

      <div className="card">
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input className="form-input" style={{ paddingLeft: 36 }} placeholder="Search campaigns..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button className="btn btn-secondary" onClick={load}><RefreshCw size={16} /></button>
        </div>

        {loading ? (
          <div className="loading"><div className="spinner" /></div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📞</div>
            <h3>No campaigns found</h3>
            <p>Create your first campaign to start making calls</p>
            <Link to="/campaigns/new" className="btn btn-primary" style={{ marginTop: 16 }}><Plus size={16} /> Create Campaign</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Contacts</th>
                  <th>Completed</th>
                  <th>Failed</th>
                  <th>Cost</th>
                  <th>Duration</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(c => {
                  const progress = c.total_contacts > 0 ? ((c.completed_calls || 0) / c.total_contacts) * 100 : 0;
                  return (
                    <tr key={c.id}>
                      <td>
                        <Link to={`/campaigns/${c.id}`} style={{ color: '#a78bfa', textDecoration: 'none', fontWeight: 500 }}>{c.name}</Link>
                        {c.description && <div style={{ fontSize: 12, color: '#475569', marginTop: 2 }}>{c.description}</div>}
                      </td>
                      <td><StatusBadge status={c.status} /></td>
                      <td>
                        <div>{c.total_contacts}</div>
                        <div className="progress-bar" style={{ marginTop: 4, width: 80 }}>
                          <div className="progress-fill blue" style={{ width: `${progress}%` }} />
                        </div>
                      </td>
                      <td className="text-success">{c.completed_calls || 0}</td>
                      <td className="text-danger">{c.failed_calls || 0}</td>
                      <td className="text-warning">${(c.total_cost || 0).toFixed(4)}</td>
                      <td className="text-muted">{formatDuration(c.total_duration || 0)}</td>
                      <td className="text-muted" style={{ fontSize: 12 }}>{new Date(c.created_at).toLocaleDateString()}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => syncCampaign(c.id)} disabled={syncing[c.id]}>
                            <RefreshCw size={13} className={syncing[c.id] ? 'spinning' : ''} />
                          </button>
                          {c.status === 'running' && (
                            <button className="btn btn-danger btn-sm" onClick={() => stopCampaign(c.id)}>Stop</button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
