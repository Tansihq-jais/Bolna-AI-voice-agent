import React from 'react';

export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizeMap = {
    sm: 16,
    md: 32,
    lg: 48,
  };

  const spinnerSize = sizeMap[size] || 32;

  return (
    <div className="loading">
      <div 
        className="spinner" 
        style={{ 
          width: spinnerSize, 
          height: spinnerSize,
          borderWidth: Math.max(2, spinnerSize / 16)
        }} 
      />
      {text && <span style={{ marginLeft: 12, color: '#64748b' }}>{text}</span>}
    </div>
  );
}