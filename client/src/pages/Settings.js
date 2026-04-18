import React, { useState } from 'react';
import { User, Bell, Shield, Save, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const TABS = [
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: Shield },
];

export default function Settings() {
  const [tab, setTab] = useState('profile');

  // Profile state
  const [profile, setProfile] = useState({
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@company.com',
    company: 'Acme Corp',
    timezone: 'America/New_York',
    language: 'en',
  });

  // Notifications state
  const [notifications, setNotifications] = useState({
    campaignCompleted: true,
    campaignFailed: true,
    dailySummary: false,
    weeklySummary: true,
    lowBalance: true,
    newInsights: false,
  });

  // Security state
  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const saveProfile = () => toast.success('Profile updated');
  const saveNotifications = () => toast.success('Notification preferences saved');

  const savePassword = () => {
    if (!passwords.current) return toast.error('Enter your current password');
    if (passwords.newPass.length < 8) return toast.error('New password must be at least 8 characters');
    if (passwords.newPass !== passwords.confirm) return toast.error('Passwords do not match');
    toast.success('Password changed successfully');
    setPasswords({ current: '', newPass: '', confirm: '' });
  };

  const Toggle = ({ checked, onChange }) => (
    <div
      onClick={() => onChange(!checked)}
      style={{
        width: 44, height: 24, borderRadius: 12, cursor: 'pointer', transition: 'background 0.2s',
        background: checked ? '#6366f1' : '#2d2d4e', position: 'relative', flexShrink: 0,
      }}
    >
      <div style={{
        width: 18, height: 18, borderRadius: '50%', background: '#fff',
        position: 'absolute', top: 3, transition: 'left 0.2s',
        left: checked ? 23 : 3,
      }} />
    </div>
  );

  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Manage your account preferences</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} className={`tab ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
            <Icon size={14} style={{ marginRight: 6 }} />{label}
          </button>
        ))}
      </div>

      {/* Profile Tab */}
      {tab === 'profile' && (
        <div className="card">
          <div className="card-title">Personal Information</div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">First Name</label>
              <input className="form-input" value={profile.firstName} onChange={e => setProfile(p => ({ ...p, firstName: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Last Name</label>
              <input className="form-input" value={profile.lastName} onChange={e => setProfile(p => ({ ...p, lastName: e.target.value }))} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <input className="form-input" type="email" value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Company</label>
            <input className="form-input" value={profile.company} onChange={e => setProfile(p => ({ ...p, company: e.target.value }))} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Timezone</label>
              <select className="form-select" value={profile.timezone} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}>
                <option value="America/New_York">Eastern Time (ET)</option>
                <option value="America/Chicago">Central Time (CT)</option>
                <option value="America/Denver">Mountain Time (MT)</option>
                <option value="America/Los_Angeles">Pacific Time (PT)</option>
                <option value="Europe/London">London (GMT)</option>
                <option value="Europe/Paris">Paris (CET)</option>
                <option value="Asia/Kolkata">India (IST)</option>
                <option value="Asia/Dubai">Dubai (GST)</option>
                <option value="Asia/Singapore">Singapore (SGT)</option>
                <option value="Australia/Sydney">Sydney (AEST)</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Language</label>
              <select className="form-select" value={profile.language} onChange={e => setProfile(p => ({ ...p, language: e.target.value }))}>
                <option value="en">English</option>
                <option value="es">Spanish</option>
                <option value="fr">French</option>
                <option value="de">German</option>
                <option value="hi">Hindi</option>
                <option value="ar">Arabic</option>
              </select>
            </div>
          </div>
          <button className="btn btn-primary" onClick={saveProfile}><Save size={15} /> Save Changes</button>
        </div>
      )}

      {/* Notifications Tab */}
      {tab === 'notifications' && (
        <div className="card">
          <div className="card-title">Email Notifications</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {[
              { key: 'campaignCompleted', label: 'Campaign completed', desc: 'Get notified when a campaign finishes running' },
              { key: 'campaignFailed', label: 'Campaign failed', desc: 'Alert when a campaign encounters errors' },
              { key: 'dailySummary', label: 'Daily summary', desc: 'Daily digest of calls, outcomes, and costs' },
              { key: 'weeklySummary', label: 'Weekly report', desc: 'Weekly performance overview every Monday' },
              { key: 'lowBalance', label: 'Low balance alert', desc: 'Notify when account balance is running low' },
              { key: 'newInsights', label: 'New AI insights', desc: 'When new call insights are ready to review' },
            ].map(({ key, label, desc }, i) => (
              <div key={key} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 0',
                borderBottom: i < 5 ? '1px solid #1e1e2e' : 'none',
              }}>
                <div>
                  <div style={{ fontSize: 14, color: '#e2e8f0', fontWeight: 500 }}>{label}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>{desc}</div>
                </div>
                <Toggle checked={notifications[key]} onChange={v => setNotifications(n => ({ ...n, [key]: v }))} />
              </div>
            ))}
          </div>
          <div style={{ marginTop: 20 }}>
            <button className="btn btn-primary" onClick={saveNotifications}><Save size={15} /> Save Preferences</button>
          </div>
        </div>
      )}

      {/* Security Tab */}
      {tab === 'security' && (
        <div className="card">
          <div className="card-title">Change Password</div>
          <div className="form-group">
            <label className="form-label">Current Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showCurrent ? 'text' : 'password'}
                placeholder="Enter current password"
                value={passwords.current}
                onChange={e => setPasswords(p => ({ ...p, current: e.target.value }))}
                style={{ paddingRight: 40 }}
              />
              <button onClick={() => setShowCurrent(!showCurrent)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">New Password</label>
            <div style={{ position: 'relative' }}>
              <input
                className="form-input"
                type={showNew ? 'text' : 'password'}
                placeholder="At least 8 characters"
                value={passwords.newPass}
                onChange={e => setPasswords(p => ({ ...p, newPass: e.target.value }))}
                style={{ paddingRight: 40 }}
              />
              <button onClick={() => setShowNew(!showNew)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer' }}>
                {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {passwords.newPass && (
              <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                {[1,2,3,4].map(i => (
                  <div key={i} style={{
                    height: 3, flex: 1, borderRadius: 2,
                    background: passwords.newPass.length >= i * 3
                      ? passwords.newPass.length < 6 ? '#ef4444' : passwords.newPass.length < 10 ? '#f97316' : '#22c55e'
                      : '#2d2d4e'
                  }} />
                ))}
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Confirm New Password</label>
            <input
              className="form-input"
              type="password"
              placeholder="Repeat new password"
              value={passwords.confirm}
              onChange={e => setPasswords(p => ({ ...p, confirm: e.target.value }))}
            />
            {passwords.confirm && passwords.newPass !== passwords.confirm && (
              <div style={{ fontSize: 12, color: '#f87171', marginTop: 6 }}>Passwords do not match</div>
            )}
          </div>
          <button className="btn btn-primary" onClick={savePassword}><Save size={15} /> Update Password</button>
        </div>
      )}
    </div>
  );
}
