import React, { useEffect, useState } from 'react';
import { Plus, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

export default function SubAccounts() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', concurrency: 5 });
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    api.get('/subaccounts').then(r => { setAccounts(r.data.data || []); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!form.name) return toast.error('Name is required');
    setSubmitting(true);
    try {
      await api.post('/subaccounts', form);
      toast.success('Sub-account created');
      setShowForm(false);
      setForm({ name: '', email: '', concurrency: 5 });
      load();
    } catch (e) {
      toast.error('Failed: ' + (e.response?.data?.error || e.message));
    }
    setSubmitting(false);
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sub-Accounts</h1>
          <p className="page-subtitle">Manage third-party client accounts</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}><Plus size={16} /> New Sub-Account</button>
      </div>

      {/* Info banner */}
      <div className="card mb-4" style={{ background: '#1e1b4b', border: '1px solid #3730a3' }}>
        <div style={{ fontSize: 14, color: '#a78bfa', fontWeight: 600, marginBottom: 8 }}>🏢 Reseller / White-Label Setup</div>
        <div style={{ fontSize: 13, color: '#94a3b8', lineHeight: 1.6 }}>
          Sub-accounts let you manage multiple clients under your master Bolna account. Each client gets their own isolated workspace with a dedicated API key. 
          You control concurrency limits and can track usage per client for billing.
          <br /><strong style={{ color: '#e2e8f0' }}>Note:</strong> Sub-accounts require a Bolna Enterprise plan.
        </div>
      </div>

      {showForm && (
        <div className="card mb-4">
          <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 20 }}>Create Sub-Account</h3>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Client Name *</label>
              <input className="form-input" placeholder="Acme Corp" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-input" placeholder="client@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Concurrent Calls Limit</label>
              <input className="form-input" type="number" min={1} max={100} value={form.concurrency} onChange={e => setForm(f => ({ ...f, concurrency: parseInt(e.target.value) }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={create} disabled={submitting}>{submitting ? 'Creating...' : 'Create Sub-Account'}</button>
            <button className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading"><div className="spinner" /></div>
      ) : accounts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Users size={48} /></div>
          <h3>No sub-accounts yet</h3>
          <p>Create sub-accounts to manage your third-party clients</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Client</th><th>Email</th><th>Bolna Sub-ID</th><th>API Key</th><th>Concurrency</th><th>Created</th></tr></thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 500 }}>{a.name}</td>
                    <td className="text-muted">{a.email || '-'}</td>
                    <td className="font-mono" style={{ fontSize: 11 }}>{a.bolna_sub_account_id || 'Pending'}</td>
                    <td>
                      {a.bolna_api_key ? (
                        <span className="font-mono" style={{ fontSize: 11, color: '#4ade80' }}>
                          {a.bolna_api_key.slice(0, 12)}...
                        </span>
                      ) : <span className="text-muted">N/A</span>}
                    </td>
                    <td>{a.concurrency}</td>
                    <td className="text-muted" style={{ fontSize: 12 }}>{new Date(a.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
