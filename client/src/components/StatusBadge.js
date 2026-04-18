import React from 'react';

export default function StatusBadge({ status, type = 'default' }) {
  const getStatusClass = () => {
    if (type === 'intent') {
      const intentMap = {
        high: 'badge-high-intent',
        medium: 'badge-medium-intent',
        low: 'badge-low-intent',
        none: 'badge-no-intent'
      };
      return intentMap[status] || 'badge-no-intent';
    }
    
    if (type === 'sentiment') {
      const sentimentMap = {
        positive: 'badge-positive',
        neutral: 'badge-neutral',
        negative: 'badge-negative'
      };
      return sentimentMap[status] || 'badge-neutral';
    }
    
    if (type === 'category') {
      const categoryMap = {
        hot: 'badge-hot-lead',
        warm: 'badge-warm-lead',
        cold: 'badge-cold-lead',
        'not-interested': 'badge-not-interested',
        callback: 'badge-callback',
        dnc: 'badge-dnc'
      };
      return categoryMap[status] || 'badge-cold-lead';
    }
    
    // Default status mapping
    const statusMap = {
      running: 'badge-running',
      completed: 'badge-completed',
      failed: 'badge-failed',
      pending: 'badge-pending',
      scheduled: 'badge-scheduled',
      stopped: 'badge-stopped',
      draft: 'badge-draft',
      'no-answer': 'badge-no-answer',
      'in-progress': 'badge-in-progress',
      busy: 'badge-no-answer',
      error: 'badge-failed',
    };
    
    return statusMap[status] || 'badge-pending';
  };

  const formatStatus = () => {
    if (type === 'intent') {
      return status === 'none' ? 'No Intent' : `${status.charAt(0).toUpperCase() + status.slice(1)} Intent`;
    }
    
    if (type === 'sentiment') {
      return status.charAt(0).toUpperCase() + status.slice(1);
    }
    
    if (type === 'category') {
      return status.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }
    
    return status;
  };

  return (
    <span className={`badge ${getStatusClass()}`}>
      {formatStatus()}
    </span>
  );
}