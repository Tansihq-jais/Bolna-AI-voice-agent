import React, { useState, useEffect } from 'react';
import api from '../api';
import LoadingSpinner from '../components/LoadingSpinner';
import StatusBadge from '../components/StatusBadge';

const Insights = () => {
  const [insights, setInsights] = useState(null);
  const [leads, setLeads] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('hot');
  const [followUps, setFollowUps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInsights();
    loadLeads(selectedCategory);
    loadFollowUps();
  }, [selectedCategory]);

  const loadInsights = async () => {
    try {
      const response = await api.get('/insights/dashboard');
      setInsights(response.data);
    } catch (err) {
      setError('Failed to load insights: ' + err.message);
    }
  };

  const loadLeads = async (category) => {
    try {
      const response = await api.get(`/insights/leads/${category}`);
      setLeads(response.data.leads || []);
    } catch (err) {
      console.error('Failed to load leads:', err);
    }
  };

  const loadFollowUps = async () => {
    try {
      const response = await api.get('/insights/followups/due');
      setFollowUps(response.data || []);
      setLoading(false);
    } catch (err) {
      console.error('Failed to load follow-ups:', err);
      setLoading(false);
    }
  };

  const updateLeadCategory = async (executionId, newCategory) => {
    try {
      await api.put(`/insights/lead/${executionId}/category`, {
        category: newCategory
      });
      loadLeads(selectedCategory);
      loadInsights();
    } catch (err) {
      alert('Failed to update lead category: ' + err.message);
    }
  };

  const exportLeads = async (category) => {
    try {
      const response = await fetch(`/api/insights/export/${category}`, {
        headers: {
          'x-bolna-api-key': localStorage.getItem('bolna_api_key')
        }
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${category}-leads.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (err) {
      alert('Failed to export leads: ' + err.message);
    }
  };

  if (loading) return <LoadingSpinner />;

  if (error) {
    return (
      <div className="insights-page">
        <div className="error-message">
          <h3>Insights Service Unavailable</h3>
          <p>{error}</p>
          <p>Make sure MongoDB is connected to use the insights feature.</p>
        </div>
      </div>
    );
  }

  const summary = insights?.summary || {};
  const leadCategories = [
    { key: 'hot', label: 'Hot Leads', count: summary.hotLeads || 0, color: '#dc3545' },
    { key: 'warm', label: 'Warm Leads', count: summary.warmLeads || 0, color: '#fd7e14' },
    { key: 'cold', label: 'Cold Leads', count: summary.coldLeads || 0, color: '#6c757d' },
    { key: 'not-interested', label: 'Not Interested', count: summary.notInterestedLeads || 0, color: '#343a40' }
  ];

  return (
    <div className="insights-page">
      <div className="page-header">
        <h1>Call Insights & Lead Scoring</h1>
        <p>AI-powered analysis of your voice campaigns</p>
      </div>

      {/* Summary Cards */}
      <div className="insights-summary">
        <div className="summary-card">
          <h3>{summary.totalCalls || 0}</h3>
          <p>Total Calls Analyzed</p>
        </div>
        <div className="summary-card">
          <h3>{Math.round(summary.averageScore || 0)}</h3>
          <p>Average Lead Score</p>
        </div>
        <div className="summary-card">
          <h3>{summary.followUpsRequired || 0}</h3>
          <p>Follow-ups Required</p>
        </div>
        <div className="summary-card">
          <h3>{summary.highBuyingIntent || 0}</h3>
          <p>High Buying Intent</p>
        </div>
      </div>

      {/* Lead Categories */}
      <div className="lead-categories">
        <h2>Lead Distribution</h2>
        <div className="category-tabs">
          {leadCategories.map(category => (
            <button
              key={category.key}
              className={`category-tab ${selectedCategory === category.key ? 'active' : ''}`}
              onClick={() => setSelectedCategory(category.key)}
              style={{ borderColor: category.color }}
            >
              <span className="category-label">{category.label}</span>
              <span className="category-count" style={{ backgroundColor: category.color }}>
                {category.count}
              </span>
            </button>
          ))}
        </div>

        <div className="category-actions">
          <button 
            className="export-btn"
            onClick={() => exportLeads(selectedCategory)}
          >
            Export {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Leads
          </button>
        </div>
      </div>

      {/* Leads Table */}
      <div className="leads-table">
        <h3>{selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)} Leads</h3>
        {leads.length === 0 ? (
          <p>No {selectedCategory} leads found.</p>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Contact</th>
                  <th>Score</th>
                  <th>Buying Intent</th>
                  <th>Sentiment</th>
                  <th>Duration</th>
                  <th>Called At</th>
                  <th>Next Action</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <tr key={lead._id}>
                    <td>
                      <div>
                        <strong>{lead.contactNumber}</strong>
                        {lead.contactName && <div className="contact-name">{lead.contactName}</div>}
                      </div>
                    </td>
                    <td>
                      <span className={`score-badge score-${lead.leadScore >= 80 ? 'hot' : lead.leadScore >= 60 ? 'warm' : 'cold'}`}>
                        {lead.leadScore}
                      </span>
                    </td>
                    <td>
                      <StatusBadge 
                        status={lead.buyingIntent?.level || 'none'} 
                        type="intent"
                      />
                    </td>
                    <td>
                      <StatusBadge 
                        status={lead.sentiment?.overall || 'neutral'} 
                        type="sentiment"
                      />
                    </td>
                    <td>{Math.round(lead.callDuration || 0)}s</td>
                    <td>{new Date(lead.calledAt).toLocaleDateString()}</td>
                    <td className="next-action">{lead.nextAction}</td>
                    <td>
                      <select
                        value={lead.leadCategory}
                        onChange={(e) => updateLeadCategory(lead.executionId, e.target.value)}
                        className="category-select"
                      >
                        <option value="hot">Hot</option>
                        <option value="warm">Warm</option>
                        <option value="cold">Cold</option>
                        <option value="not-interested">Not Interested</option>
                        <option value="callback">Callback</option>
                        <option value="dnc">Do Not Call</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Follow-ups Due */}
      {followUps.length > 0 && (
        <div className="followups-section">
          <h2>Follow-ups Due</h2>
          <div className="followups-list">
            {followUps.map(followUp => (
              <div key={followUp._id} className="followup-card">
                <div className="followup-contact">
                  <strong>{followUp.contactNumber}</strong>
                  {followUp.contactName && <span> - {followUp.contactName}</span>}
                </div>
                <div className="followup-details">
                  <StatusBadge status={followUp.leadCategory} type="category" />
                  <span className="followup-date">
                    Due: {new Date(followUp.followUpDate).toLocaleDateString()}
                  </span>
                </div>
                <div className="followup-action">{followUp.nextAction}</div>
                {followUp.notes && <div className="followup-notes">{followUp.notes}</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Topics */}
      {insights?.topTopics && insights.topTopics.length > 0 && (
        <div className="topics-section">
          <h2>Top Conversation Topics</h2>
          <div className="topics-list">
            {insights.topTopics.map(topic => (
              <div key={topic.topic} className="topic-item">
                <span className="topic-name">{topic.topic}</span>
                <span className="topic-count">{topic.count} calls</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Insights;