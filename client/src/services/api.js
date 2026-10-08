import axios from 'axios';

const TOKEN_KEY = 'auth_token';
const AUTH_ATTEMPT_PATHS = ['/api/auth/login', '/api/auth/register'];

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
    const isAuthAttempt = AUTH_ATTEMPT_PATHS.some((p) => err.config?.url?.endsWith(p));
    if (err.response?.status === 401 && !isAuthAttempt) {
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

// ── Lookup (preset list) functions ────────────────────────────────────────────

export function getLookups() {
  return api.get('/api/lookups');
}

export function createLookup(body) {
  return api.post('/api/lookups', body);
}

export function updateLookup(id, body) {
  return api.patch(`/api/lookups/${id}`, body);
}

export function reorderLookups(type, ids) {
  return api.put('/api/lookups/order', { type, ids });
}

export function deactivateLookup(id) {
  return api.patch(`/api/lookups/${id}/deactivate`);
}

export function reactivateLookup(id) {
  return api.patch(`/api/lookups/${id}/reactivate`);
}

// ── Custom field definitions ──────────────────────────────────────────────────

export function getFields() {
  return api.get('/api/fields');
}

export function getAllFields() {
  return api.get('/api/fields/all');
}

export function createField(body) {
  return api.post('/api/fields', body);
}

export function updateField(id, body) {
  return api.patch(`/api/fields/${id}`, body);
}

export function reorderFields(appliesTo, ids) {
  return api.put('/api/fields/order', { appliesTo, ids });
}

export function deactivateField(id) {
  return api.patch(`/api/fields/${id}/deactivate`);
}

export function reactivateField(id) {
  return api.patch(`/api/fields/${id}/reactivate`);
}

export function addFieldOption(id, label) {
  return api.post(`/api/fields/${id}/options`, { label });
}

export function renameFieldOption(id, optionId, label) {
  return api.patch(`/api/fields/${id}/options/${optionId}`, { label });
}

export function deactivateFieldOption(id, optionId) {
  return api.patch(`/api/fields/${id}/options/${optionId}/deactivate`);
}

export function reactivateFieldOption(id, optionId) {
  return api.patch(`/api/fields/${id}/options/${optionId}/reactivate`);
}

export default api;
