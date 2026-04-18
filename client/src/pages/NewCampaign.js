import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, CheckCircle, AlertCircle, Phone, Calendar, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api';

export default function NewCampaign() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [estimate, setEstimate] = useState(null);

  const [form, setForm] = useState({
    name: '',
    description: '',
    agent_id: '',
    agent_name: '',
    from_phone_number: '',
    scheduled_at: '',
    retry_enabled: false,
    retry_max: 2,
    retry_intervals: [30, 60],
  });

  useEffect(() => {
    setLoadingAgents(true);
    api.get('/agents').then(r => {
      const list = r.data.data;
      setAgents(Array.isArray(list) ? list : []);
      setLoadingAgents(false);
    }).catch(() => { setAgents([]); setLoadingAgents(false); });
  }, []);

  const onDrop = useCallback(async (acceptedFiles) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await api.post('/campaigns/parse-file', fd);
      setPreview(r.data.data);
      // Get cost estimate
      const est = await api.post('/billing/estimate', { num_contacts: r.data.data.total, avg_duration_min: 2 });
      setEstimate(est.data.data);
    } catch (e) {
      toast.error('Failed to parse file: ' + (e.response?.data?.error || e.message));
    }
    setParsing(false);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 
      'text/csv': ['.csv'], 
      'application/pdf': ['.pdf'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/gif': ['.gif'],
      'image/bmp': ['.bmp'],
      'image/tiff': ['.tiff', '.tif']
    },
    maxFiles: 1,
  });

  const handleSubmit = async () => {
    if (!form.name || !form.agent_id || !file) {
      toast.error('Please fill all required fields and upload a file');
      return;
    }
    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('name', form.name);
      fd.append('description', form.description);
      fd.append('agent_id', form.agent_id);
      fd.append('agent_name', form.agent_name);
      if (form.from_phone_number) fd.append('from_phone_number', form.from_phone_number);
      if (form.scheduled_at) fd.append('scheduled_at', form.scheduled_at);
      fd.append('retry_enabled', form.retry_enabled);
      fd.append('retry_max', form.retry_max);
      fd.append('retry_intervals', JSON.stringify(form.retry_intervals));

      const r = await api.post('/campaigns', fd);
      toast.success(`Campaign created! ${r.data.data.total_contacts} contacts queued.`);
      navigate(`/campaigns/${r.data.data.campaign_id}`);
    } catch (e) {
      toast.error('Failed: ' + (e.response?.data?.error || e.message));
    }
    setSubmitting(false);
  };

  return (
    <div className="page" style={{ maxWidth: 800 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">New Campaign</h1>
          <p className="page-subtitle">Set up a voice AI calling campaign</p>
        </div>
      </div>

      {/* Steps indicator */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 32 }}>
        {['Upload Contacts', 'Configure', 'Review & Launch'].map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{
              width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: step > i + 1 ? '#22c55e' : step === i + 1 ? '#6366f1' : '#1e1e2e',
              color: step >= i + 1 ? 'white' : '#64748b', fontSize: 13, fontWeight: 600,
            }}>{step > i + 1 ? '✓' : i + 1}</div>
            <span style={{ fontSize: 13, color: step === i + 1 ? '#e2e8f0' : '#64748b' }}>{s}</span>
            {i < 2 && <div style={{ width: 40, height: 1, background: '#1e1e2e' }} />}
          </div>
        ))}
      </div>

      {/* Step 1: Upload */}
      {step === 1 && (
        <div className="card">
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Upload Contact File</h2>
          <div {...getRootProps()} className={`dropzone ${isDragActive ? 'active' : ''}`}>
            <input {...getInputProps()} />
            <div className="dropzone-icon">{file ? '✅' : '📁'}</div>
            {file ? (
              <div>
                <div style={{ color: '#4ade80', fontWeight: 500 }}>{file.name}</div>
                <div className="dropzone-hint">Click or drag to replace</div>
              </div>
            ) : (
              <div>
                <div className="dropzone-text">Drop your contact file here</div>
                <div className="dropzone-hint">
                  <strong>Supported:</strong> CSV, PDF, Images (JPG, PNG, GIF, BMP, TIFF)<br />
                  <strong>CSV:</strong> contact_number, name columns required<br />
                  <strong>PDF/Images:</strong> Automatic OCR extraction of names and phone numbers
                </div>
              </div>
            )}
          </div>

          {parsing && <div className="loading" style={{ padding: 20 }}><div className="spinner" /><span style={{ marginLeft: 12 }}>Parsing file...</span></div>}

          {preview && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                <div className="stat-card" style={{ flex: 1, padding: 16 }}>
                  <div className="stat-label">Total Contacts</div>
                  <div className="stat-value" style={{ fontSize: 24 }}>{preview.total}</div>
                </div>
                {estimate && (
                  <>
                    <div className="stat-card" style={{ flex: 1, padding: 16 }}>
                      <div className="stat-label">Est. Cost (2min avg)</div>
                      <div className="stat-value" style={{ fontSize: 24, color: '#fbbf24' }}>${estimate.total_cost}</div>
                    </div>
                    <div className="stat-card" style={{ flex: 1, padding: 16 }}>
                      <div className="stat-label">Per Call</div>
                      <div className="stat-value" style={{ fontSize: 24, color: '#60a5fa' }}>${estimate.per_call}</div>
                    </div>
                  </>
                )}
              </div>
              
              {/* Processing Method Info */}
              {preview.processing_method && (
                <div style={{ 
                  background: '#f0f9ff', 
                  border: '1px solid #0ea5e9', 
                  borderRadius: '8px', 
                  padding: '12px', 
                  marginBottom: '16px',
                  fontSize: '14px'
                }}>
                  <strong>📊 Processing Method:</strong> {preview.processing_method} 
                  {preview.file_type && <span> • File Type: {preview.file_type}</span>}
                  {preview.processing_method.includes('OCR') && (
                    <div style={{ marginTop: '4px', color: '#0369a1' }}>
                      ✨ Used AI-powered OCR to extract contacts from image-based content
                    </div>
                  )}
                </div>
              )}
              
              <div style={{ fontSize: 13, color: '#64748b', marginBottom: 12 }}>Preview (first 10 contacts):</div>
              <div className="table-wrap">
                <table>
                  <thead><tr>{preview.columns.slice(0, 4).map(c => <th key={c}>{c}</th>)}</tr></thead>
                  <tbody>
                    {preview.contacts.map((c, i) => (
                      <tr key={i}>{preview.columns.slice(0, 4).map(col => <td key={col}>{c[col] || '-'}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24 }}>
            <button className="btn btn-primary" onClick={() => setStep(2)} disabled={!file || !preview}>
              Next: Configure →
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Configure */}
      {step === 2 && (
        <div className="card">
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Campaign Configuration</h2>

          <div className="form-group">
            <label className="form-label">Campaign Name *</label>
            <input className="form-input" placeholder="e.g., Q1 Lead Outreach" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" placeholder="Optional description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          </div>

          <div className="form-group">
            <label className="form-label">Voice AI Agent *</label>
            {loadingAgents ? (
              <div style={{ color: '#64748b', fontSize: 14 }}>Loading agents...</div>
            ) : (
              <select className="form-select" value={form.agent_id} onChange={e => {
                const agent = agents.find(a => a.agent_id === e.target.value || a.id === e.target.value);
                setForm(f => ({ ...f, agent_id: e.target.value, agent_name: agent?.agent_config?.agent_name || agent?.name || '' }));
              }}>
                <option value="">Select an agent...</option>
                {agents.map(a => (
                  <option key={a.agent_id || a.id} value={a.agent_id || a.id}>
                    {a.agent_config?.agent_name || a.name || a.agent_id || a.id}
                  </option>
                ))}
              </select>
            )}
            {agents.length === 0 && !loadingAgents && (
              <div className="form-hint" style={{ color: '#f87171' }}>No agents found. Make sure your Bolna API key is set in Settings.</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">From Phone Number (optional)</label>
            <input className="form-input" placeholder="+1234567890" value={form.from_phone_number} onChange={e => setForm(f => ({ ...f, from_phone_number: e.target.value }))} />
            <div className="form-hint">Leave empty to use Bolna's default numbers</div>
          </div>

          <div className="form-group">
            <label className="form-label">Schedule (optional)</label>
            <input className="form-input" type="datetime-local" value={form.scheduled_at} onChange={e => setForm(f => ({ ...f, scheduled_at: e.target.value }))} />
            <div className="form-hint">Leave empty to start immediately</div>
          </div>

          <div className="form-group">
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.retry_enabled} onChange={e => setForm(f => ({ ...f, retry_enabled: e.target.checked }))} />
              <span className="form-label" style={{ marginBottom: 0 }}>Enable Auto-Retry for failed calls</span>
            </label>
            {form.retry_enabled && (
              <div style={{ marginTop: 12, padding: 16, background: '#0f0f1a', borderRadius: 8, border: '1px solid #1e1e2e' }}>
                <div className="form-group" style={{ marginBottom: 12 }}>
                  <label className="form-label">Max Retries</label>
                  <select className="form-select" value={form.retry_max} onChange={e => setForm(f => ({ ...f, retry_max: parseInt(e.target.value) }))}>
                    <option value={1}>1</option><option value={2}>2</option><option value={3}>3</option>
                  </select>
                </div>
                <div className="form-hint">Retry intervals: 30 min, 60 min, 120 min</div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 24 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>← Back</button>
            <button className="btn btn-primary" onClick={() => setStep(3)} disabled={!form.name || !form.agent_id}>
              Next: Review →
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="card">
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 20 }}>Review & Launch</h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
            {[
              ['Campaign Name', form.name],
              ['Agent', form.agent_name || form.agent_id],
              ['Total Contacts', preview?.total],
              ['From Number', form.from_phone_number || 'Bolna Default'],
              ['Schedule', form.scheduled_at ? new Date(form.scheduled_at).toLocaleString() : 'Immediately'],
              ['Auto-Retry', form.retry_enabled ? `Yes (${form.retry_max} retries)` : 'No'],
            ].map(([label, value]) => (
              <div key={label} style={{ padding: 16, background: '#0f0f1a', borderRadius: 8, border: '1px solid #1e1e2e' }}>
                <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{value || '-'}</div>
              </div>
            ))}
          </div>

          {estimate && (
            <div style={{ padding: 16, background: '#1e1b4b', borderRadius: 8, border: '1px solid #3730a3', marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#a78bfa', fontWeight: 600, marginBottom: 8 }}>💰 Cost Estimate</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <div><div style={{ fontSize: 11, color: '#64748b' }}>Bolna Cost</div><div style={{ color: '#e2e8f0' }}>${estimate.bolna_cost}</div></div>
                <div><div style={{ fontSize: 11, color: '#64748b' }}>Platform Fee</div><div style={{ color: '#e2e8f0' }}>${estimate.platform_cost}</div></div>
                <div><div style={{ fontSize: 11, color: '#64748b' }}>Total Est.</div><div style={{ color: '#fbbf24', fontWeight: 600 }}>${estimate.total_cost}</div></div>
              </div>
              <div style={{ fontSize: 11, color: '#475569', marginTop: 8 }}>Based on 2 min avg call duration</div>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <button className="btn btn-secondary" onClick={() => setStep(2)}>← Back</button>
            <button className="btn btn-success" onClick={handleSubmit} disabled={submitting}>
              {submitting ? <><RefreshCw size={16} className="spinning" /> Launching...</> : <><Phone size={16} /> Launch Campaign</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
