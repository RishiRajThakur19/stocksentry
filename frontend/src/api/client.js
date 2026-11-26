import axios from 'axios';

// Enterprise Dynamic Base URL Resolution
const getApiBaseUrl = () => {
  // 1. Explicit override via Vite environment variable
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }

  // 2. Production build or behind reverse proxy (Caddy / Nginx on same origin)
  if (
    import.meta.env.PROD ||
    window.location.port === '80' ||
    window.location.port === '443' ||
    window.location.port === '8080' ||
    window.location.hostname !== 'localhost'
  ) {
    return '/api';
  }

  // 3. Local Vite dev server fallback
  return 'http://localhost:8000/api';
};

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s timeout for enterprise network reliability
});

// Request interceptor to attach JWT token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('stocksentry_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for auth errors, refresh token rotation, and network handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response && error.response.status === 401 && !originalRequest?._retry) {
      const refreshToken = localStorage.getItem('stocksentry_refresh_token');
      if (refreshToken && !originalRequest.url?.includes('/auth/login') && !originalRequest.url?.includes('/auth/refresh')) {
        originalRequest._retry = true;
        try {
          const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refresh_token: refreshToken });
          const { access_token, refresh_token: newRefresh, ...userData } = res.data;
          localStorage.setItem('stocksentry_token', access_token);
          if (newRefresh) localStorage.setItem('stocksentry_refresh_token', newRefresh);
          localStorage.setItem('stocksentry_user', JSON.stringify(userData));
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return api(originalRequest);
        } catch {
          // Fall through to logout cleanup
        }
      }
      const hadToken = localStorage.getItem('stocksentry_token');
      localStorage.removeItem('stocksentry_token');
      localStorage.removeItem('stocksentry_refresh_token');
      localStorage.removeItem('stocksentry_user');

      if (hadToken && window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
