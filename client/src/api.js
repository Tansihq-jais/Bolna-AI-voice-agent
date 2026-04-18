import axios from 'axios';

const api = axios.create({ baseURL: '/api' });

// Attach Bolna API key from localStorage or use default for development
api.interceptors.request.use(config => {
  const key = localStorage.getItem('bolna_api_key') || 'bn-41ca6894e39b4c66be3056bce85ac044';
  if (key) config.headers['x-bolna-api-key'] = key;
  return config;
});

export default api;
