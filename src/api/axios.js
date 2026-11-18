import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 20000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('driveaway_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

// On 401 for an authenticated request, the session has expired: clear it and tell AuthContext
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const hadToken = Boolean(error.config?.headers?.Authorization);
    if (error.response?.status === 401 && hadToken) {
      localStorage.removeItem('driveaway_token');
      localStorage.removeItem('driveaway_user');
      window.dispatchEvent(new Event('driveaway:auth-expired'));
    }
    if (!error.response && error.code !== 'ERR_CANCELED') {
      error.response = { data: { message: 'Cannot reach the server. Check your connection and try again.' } };
    }
    return Promise.reject(error);
  }
);

export default api;
