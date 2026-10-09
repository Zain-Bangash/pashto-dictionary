import { redirectToLogin } from '../utils/redirectToLogin';

const SESSION_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'];

// The refresh cookie only travels on /api/auth/* calls, so only those need credentials.
export const SESSION_REQUEST = {
  withCredentials: true,
  headers: { 'X-Requested-With': 'XMLHttpRequest' },
};

// Access token lives in memory only; a reload or new tab restores it via refreshSession().
let _token = null;
let _logoutHandler = null;
let _refreshPromise = null;
let _api = null;

export function setToken(token) {
  _token = token;
}

export function clearToken() {
  _token = null;
}

export function getToken() {
  return _token;
}

export function setLogoutHandler(fn) {
  _logoutHandler = fn;
}

export function refreshSession() {
  _refreshPromise ??= _api
    .post('/api/auth/refresh', null, SESSION_REQUEST)
    .then((res) => {
      setToken(res.data.data.token);
      return res.data.data;
    })
    .finally(() => {
      _refreshPromise = null;
    });
  return _refreshPromise;
}

function endSession() {
  clearToken();
  if (_logoutHandler) _logoutHandler();
  redirectToLogin();
}

export function installAuthInterceptors(api) {
  _api = api;

  api.interceptors.request.use((config) => {
    if (_token) config.headers.Authorization = `Bearer ${_token}`;
    return config;
  });

  api.interceptors.response.use(
    (res) => res,
    async (err) => {
      const { config, response } = err;
      const isSessionCall = SESSION_PATHS.some((p) => config?.url?.endsWith(p));
      if (response?.status !== 401 || isSessionCall || !config) throw err;

      if (config._retried) {
        endSession();
        throw err;
      }

      try {
        await refreshSession();
      } catch (refreshErr) {
        // A network blip or 5xx during refresh should not log the user out.
        if (refreshErr.response?.status === 401 || refreshErr.response?.status === 403) endSession();
        throw err;
      }

      config._retried = true;
      return api(config);
    }
  );
}
