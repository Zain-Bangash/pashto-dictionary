import axios from 'axios';

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Attach JWT on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// 401 → clear session and redirect to login
let _logoutHandler = null;
export function setLogoutHandler(fn) { _logoutHandler = fn; }

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && _logoutHandler) {
      _logoutHandler();
      window.location.replace('/login');
    }
    return Promise.reject(err);
  }
);

// ── Concept service functions ──────────────────────────────────────────────

export function getConcepts(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api.get(`/api/concepts${qs ? `?${qs}` : ''}`);
}

export function getConcept(id) {
  return api.get(`/api/concepts/${id}`);
}

export function createConcept(body) {
  return api.post('/api/concepts', body);
}

export function suggestConcepts(q) {
  return api.get(`/api/concepts/suggest?q=${encodeURIComponent(q)}`);
}

export function transitionConceptStatus(id, body) {
  return api.patch(`/api/concepts/${id}/status`, body);
}

// ── Variant service functions ──────────────────────────────────────────────

export function getVariants(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api.get(`/api/variants${qs ? `?${qs}` : ''}`);
}

export function getVariant(id) {
  return api.get(`/api/variants/${id}`);
}

export function createVariant(body) {
  return api.post('/api/variants', body);
}

export function updateVariant(id, body) {
  return api.patch(`/api/variants/${id}`, body);
}

export function transitionVariantStatus(id, body) {
  return api.patch(`/api/variants/${id}/status`, body);
}

export function searchVariants(params = {}) {
  const qs = new URLSearchParams(params).toString();
  return api.get(`/api/variants/search${qs ? `?${qs}` : ''}`);
}

export default api;
