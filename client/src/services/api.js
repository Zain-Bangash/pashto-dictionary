import axios from 'axios';

const TOKEN_KEY = 'auth_token';

// Initialise from sessionStorage so token survives a page refresh within the tab.
let _token = sessionStorage.getItem(TOKEN_KEY) ?? null;
let _logoutHandler = null;

export function setToken(token) {
  _token = token;
  sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  _token = null;
  sessionStorage.removeItem(TOKEN_KEY);
}

export function getToken() {
  return _token;
}

export function setLogoutHandler(fn) {
  _logoutHandler = fn;
}

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      clearToken();
      if (_logoutHandler) _logoutHandler();
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

export function updateConcept(id, body) {
  return api.patch(`/api/concepts/${id}`, body);
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

// ── Moderation enhancement functions ──────────────────────────────────────────

export function editConcept(id, data) {
  return api.patch(`/api/concepts/${id}/edit`, data);
}

export function editVariant(id, data) {
  return api.patch(`/api/variants/${id}/edit`, data);
}

export function mergeConcepts(sourceId, body) {
  return api.post(`/api/concepts/${sourceId}/merge`, body);
}

export function checkCrossConceptPashto(pashto, conceptId) {
  return api.get('/api/variants/cross-concept-check', { params: { pashto, conceptId } });
}

export default api;
