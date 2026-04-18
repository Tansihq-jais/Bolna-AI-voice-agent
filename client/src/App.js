import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Phone, BarChart3, DollarSign, Settings, Zap, Menu, X, Brain } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import Campaigns from './pages/Campaigns';
import NewCampaign from './pages/NewCampaign';
import CampaignDetail from './pages/CampaignDetail';
import Analytics from './pages/Analytics';
import Billing from './pages/Billing';
import SettingsPage from './pages/Settings';
import Insights from './pages/Insights';
import './App.css';

const navItems = [
  { to: '/', icon: BarChart3, label: 'Dashboard', exact: true },
  { to: '/campaigns', icon: Phone, label: 'Campaigns' },
  { to: '/insights', icon: Brain, label: 'Insights' },
  { to: '/analytics', icon: Zap, label: 'Analytics' },
  { to: '/billing', icon: DollarSign, label: 'Billing' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <BrowserRouter>
      <Toaster position="top-right" toastOptions={{ style: { background: '#1e1e2e', color: '#e2e8f0', border: '1px solid #2d2d4e' } }} />
      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
          <div className="sidebar-header">
            <div className="logo">
              <div className="logo-icon">🎙️</div>
              {sidebarOpen && <span className="logo-text">PropNex AI</span>}
            </div>
            <button className="toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
              {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
          <nav className="sidebar-nav">
            {navItems.map(({ to, icon: Icon, label, exact }) => (
              <NavLink key={to} to={to} end={exact} className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                <Icon size={20} />
                {sidebarOpen && <span>{label}</span>}
              </NavLink>
            ))}
          </nav>
          {sidebarOpen && (
            <div className="sidebar-footer">
            </div>
          )}
        </aside>

        {/* Main content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/campaigns" element={<Campaigns />} />
            <Route path="/campaigns/new" element={<NewCampaign />} />
            <Route path="/campaigns/:id" element={<CampaignDetail />} />
            <Route path="/insights" element={<Insights />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/billing" element={<Billing />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
