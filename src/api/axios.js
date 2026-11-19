import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
  // The API sleeps on Render's free plan and can take about a minute to wake, so wait that long
  timeout: 65000,
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('driveaway_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
}, (error) => Promise.reject(error));

// On 401 for an authenticated request, the session has expired: clear it and tell AuthContext.
// Timeouts, network errors and 5xx never sign anyone out.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const headers = error.config?.headers;
    const sent = headers?.Authorization || headers?.get?.('Authorization');
    if (error.response?.status === 401 && sent) {
      const current = localStorage.getItem('driveaway_token');
      // A late 401 for a token that has since been replaced (new sign-in, password change) is ignored
      if (current && sent === `Bearer ${current}`) {
        localStorage.removeItem('driveaway_token');
        localStorage.removeItem('driveaway_user');
        window.dispatchEvent(new Event('driveaway:auth-expired'));
      }
    }
    if (!error.response && error.code !== 'ERR_CANCELED') {
      error.response = { data: { message: 'Cannot reach the server. Check your connection and try again.' } };
    }
    return Promise.reject(error);
  }
);

export default api;
