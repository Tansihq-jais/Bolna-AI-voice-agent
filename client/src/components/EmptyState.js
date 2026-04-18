import React from 'react';

export default function EmptyState({ 
  icon = '📄', 
  title = 'No data', 
  description = '', 
  action = null 
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}