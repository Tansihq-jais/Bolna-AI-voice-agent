import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';

// Set default API key for development
if (!localStorage.getItem('bolna_api_key')) {
  localStorage.setItem('bolna_api_key', 'bn-41ca6894e39b4c66be3056bce85ac044');
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<React.StrictMode><App /></React.StrictMode>);
