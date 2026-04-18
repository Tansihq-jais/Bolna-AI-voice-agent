import React, { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { TrendingUp, ChevronDown } from 'lucide-react';
import api from '../api';

const TIERS = [
  { label: 'Starter',  calls: '< 5,000 calls/mo',       rate: '₹10/min' },
  { label: 'Standard', calls: '5,000 – 9,999 calls/mo',  rate: '₹8/min'  },
  { label: 'Pro',      calls: '10,000+ calls/mo',         rate: '₹6.4/min' },
];

function formatINR(val) {
  return parseFloat(val || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthLabel(ym) {
  if (!ym) return '';
  const [y, m] = ym.split('-');
  return new Date(y, m - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

export default function Billing() {
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [selectedMonth, setSelectedMonth] = useState('');
  const [estimate, setEstimate]   = useState({ contacts: 100, duration: 2 });
  const [estResult, setEstResult] = useState(null);
  const [estimating, setEstimating] = useState(false);

  const fetchData = (month) => {
    setLoading(true);
    const query = month ? `?month=${month}` : '';
    api.get(`/billing/summary${query}`)
      .then(r => { setData(r.data.data); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { fetchData(''); }, []);

  const handleMonthChange = (e) => {
    setSelectedMonth(e.target.value);
    fetchData(e.target.value);
  };

  const calcEstimate = async () => {
    setEstimating(true);
    try {
      const r = await api.post('/billing/estimate', {
        num_contacts: estimate.contacts,
        avg_duration_min: estimate.duration,
      });
      setEstResult(r.data.data);
    } catch (e) { console.error(e); }
    setEstimating(false);
  };

  if (loading) return <div className="loading"><div className="spinner" /></div>;

  const summary      = data?.summary      || {};
  const tier         = data?.tier         || {};
  const daily        = data?.daily        || [];
  const byCampaign   = data?.byCampaign   || [];
  const availMonths  = data?.availableMonths || [];
  const currentMonth = data?.month        || '';

  const tierIndex = tier.name === 'Starter' ? 0 : tier.name === 'Standard' ? 1 : 2;

  // Progress toward next tier threshold
  const thresholds = [5000, 10000];
  const nextThreshold = thresholds.find(t => summary.total_calls < t);
  const prevThreshold = nextThreshold === 5000 ? 0 : 5000;
  const progressPct = nextThreshold
    ? Math.min(100, ((summary.total_calls - prevThreshold) / (nextThreshold - prevThreshold)) * 100)
    : 100;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Billing</h1>
          <p className="page-subtitle">Monthly usage and charges</p>
        </div>
        {/* Month picker */}
        <div style={{ position: 'relative' }}>
          <select
            className="form-select"
            style={{ paddingRight: 32, minWidth: 180 }}
            value={selectedMonth || currentMonth}
            onChange={handleMonthChange}
          >
            {availMonths.length === 0
              ? <option value={currentMonth}>{monthLabel(currentMonth)}</option>
              : availMonths.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)
            }
          </select>
          <ChevronDown size={14} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: '#64748b' }} />
        </div>
      </div>

      {/* Summary stats */}
      <div className="stats-grid">
        {[
          { label: 'Total Calls',   value: (summary.total_calls   || 0).toLocaleString() },
          { label: 'Total Minutes', value: `${(summary.total_minutes || 0).toLocaleString()}m` },
          { label: 'Rate Applied',  value: `₹${tier.rate_per_min || 10}/min` },
          { label: 'Amount Due',    value: `₹${formatINR(summary.total_cost)}` },
        ].map(({ label, value }) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-value" style={{ fontSize: 24 }}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tier card */}
      <div className="card mb-4">
        <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <TrendingUp size={14} /> This Month's Pricing Tier
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {TIERS.map((t, i) => (
            <div key={t.label} style={{
              padding: '14px 16px', borderRadius: 10, position: 'relative',
              border: `1px solid ${i === tierIndex ? '#6366f1' : '#1e1e2e'}`,
              background: i === tierIndex ? '#1e1b4b' : '#0f0f1a',
            }}>
              {i === tierIndex && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: '#6366f1', color: '#fff', fontSize: 10, fontWeight: 700,
                  padding: '2px 10px', borderRadius: 20, whiteSpace: 'nowrap',
                }}>ACTIVE</div>
              )}
              <div style={{ fontSize: 13, fontWeight: 700, color: i === tierIndex ? '#a78bfa' : '#475569' }}>{t.label}</div>
              <div style={{ fontSize: 11, color: '#475569', margin: '4px 0' }}>{t.calls}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: i === tierIndex ? '#f1f5f9' : '#475569' }}>{t.rate}</div>
            </div>
          ))}
        </div>

        {/* Progress bar toward next tier */}
        {nextThreshold && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b', marginBottom: 6 }}>
              <span>{summary.total_calls?.toLocaleString()} calls this month</span>
              <span>{nextThreshold.toLocaleString()} calls</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill blue" style={{ width: `${progressPct}%` }} />
            </div>
            <div style={{ fontSize: 12, color: '#6366f1', marginTop: 8 }}>
              🎯 {tier.next_tier_info}
            </div>
          </div>
        )}
        {!nextThreshold && (
          <div style={{ fontSize: 12, color: '#4ade80' }}>✓ You're on the best rate — ₹6.4/min</div>
        )}

        <div style={{ fontSize: 11, color: '#475569', marginTop: 12, padding: '8px 12px', background: '#0f0f1a', borderRadius: 8 }}>
          The rate shown applies to your entire month's usage. If your call volume crosses a threshold during the month, the lower rate applies to all minutes billed that month.
        </div>
      </div>

      <div className="grid-2">
        {/* Daily chart */}
        <div className="card">
          <div className="card-title">Daily Usage — {monthLabel(currentMonth)}</div>
          {daily.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={daily}>
                <XAxis dataKey="date" tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={d => d.slice(8)} />
                <YAxis tick={{ fill: '#64748b', fontSize: 11 }} tickFormatter={v => `₹${v}`} />
                <Tooltip
                  contentStyle={{ background: '#1e1e2e', border: '1px solid #2d2d4e', borderRadius: 8 }}
                  formatter={v => [`₹${formatINR(v)}`, 'Charge']}
                  labelFormatter={l => `Date: ${l}`}
                />
                <Bar dataKey="cost" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="empty-state" style={{ padding: 40 }}><p>No data for this month</p></div>
          )}
        </div>

        {/* Estimator */}
        <div className="card">
          <div className="card-title">Cost Estimator</div>
          <p style={{ fontSize: 12, color: '#64748b', marginBottom: 16 }}>
            Estimates based on your current month's call count + new calls.
          </p>
          <div className="form-group">
            <label className="form-label">Number of Contacts</label>
            <input
              className="form-input" type="number" min={1}
              value={estimate.contacts}
              onChange={e => setEstimate(s => ({ ...s, contacts: parseInt(e.target.value) || 0 }))}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Avg Call Duration (minutes)</label>
            <input
              className="form-input" type="number" step="0.5" min={0.5}
              value={estimate.duration}
              onChange={e => setEstimate(s => ({ ...s, duration: parseFloat(e.target.value) || 0 }))}
            />
          </div>
          <button className="btn btn-primary" onClick={calcEstimate} disabled={estimating}>
            {estimating ? 'Calculating...' : 'Calculate'}
          </button>
          {estResult && (
            <div style={{ marginTop: 16, padding: 16, background: '#0f0f1a', borderRadius: 8, border: '1px solid #1e1e2e' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {[
                  ['Estimated Total',   `₹${formatINR(estResult.total_cost)}`],
                  ['Per Call',          `₹${estResult.per_call}`],
                  ['Rate Applied',      `₹${estResult.rate_per_min}/min`],
                  ['Projected Tier',    estResult.tier],
                ].map(([label, value]) => (
                  <div key={label}>
                    <div style={{ fontSize: 11, color: '#64748b' }}>{label}</div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#e2e8f0' }}>{value}</div>
                  </div>
                ))}
              </div>
              {estResult.tier !== tier.name && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#4ade80', padding: '6px 10px', background: '#14532d', borderRadius: 6 }}>
                  ✓ Adding these calls would move you to the <strong>{estResult.tier}</strong> tier (₹{estResult.rate_per_min}/min on all minutes this month)
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* By campaign */}
      {byCampaign.length > 0 && (
        <div className="card mt-4">
          <div className="card-title">Usage by Campaign — {monthLabel(currentMonth)}</div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Calls</th>
                  <th>Minutes</th>
                  <th>Charge</th>
                </tr>
              </thead>
              <tbody>
                {byCampaign.map(c => (
                  <tr key={c.campaign_id}>
                    <td style={{ fontWeight: 500 }}>{c.campaign_name || c.campaign_id}</td>
                    <td>{(c.calls || 0).toLocaleString()}</td>
                    <td>{(c.total_minutes || 0).toLocaleString()}m</td>
                    <td className="text-warning">₹{formatINR(c.total_cost)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid #2d2d4e' }}>
                  <td style={{ fontWeight: 700, color: '#e2e8f0' }}>Total</td>
                  <td style={{ fontWeight: 700, color: '#e2e8f0' }}>{(summary.total_calls || 0).toLocaleString()}</td>
                  <td style={{ fontWeight: 700, color: '#e2e8f0' }}>{(summary.total_minutes || 0).toLocaleString()}m</td>
                  <td style={{ fontWeight: 700, color: '#fbbf24' }}>₹{formatINR(summary.total_cost)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
