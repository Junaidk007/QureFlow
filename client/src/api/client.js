const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1';

/**
 * Standardized API client wrapper with automatic JWT token attachment
 */
async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem('qureflow_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };

  const config = {
    ...options,
    headers,
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  const url = `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.message || 'API request failed');
      error.status = response.status;
      error.code = data.code || 'API_ERROR';
      error.details = data.details || null;
      throw error;
    }

    return data;
  } catch (err) {
    if (err.status === 401 && !endpoint.includes('/auth/login') && !endpoint.includes('/auth/register')) {
      // Auto logout on 401 token expiration
      localStorage.removeItem('qureflow_token');
      localStorage.removeItem('qureflow_user');
      window.dispatchEvent(new Event('qureflow_auth_change'));
    }
    throw err;
  }
}

export const api = {
  get: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'POST', body }),
  put: (endpoint, body, options) => apiRequest(endpoint, { ...options, method: 'PUT', body }),
  delete: (endpoint, options) => apiRequest(endpoint, { ...options, method: 'DELETE' }),
};

export default api;
