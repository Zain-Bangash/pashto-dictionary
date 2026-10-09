import { vi, beforeEach, describe, it, expect } from 'vitest';
import { AxiosError } from 'axios';

vi.mock('../../utils/redirectToLogin', () => ({ redirectToLogin: vi.fn() }));

import api, { setToken, getToken, setLogoutHandler, refreshSession } from '../../services/api';
import { redirectToLogin } from '../../utils/redirectToLogin';

const adapter = vi.fn();
const onLogout = vi.fn();

const respond = (config, status, data = {}) => {
  const response = { status, statusText: String(status), data, headers: {}, config };
  if (status < 400) return Promise.resolve(response);
  return Promise.reject(new AxiosError(`status ${status}`, 'ERR_BAD_RESPONSE', config, null, response));
};

const isRefresh = (config) => config.url === '/api/auth/refresh';
const refreshOk = (token = 'new-tok') => ({ success: true, data: { token, user: { id: 'u1' } } });

beforeEach(() => {
  adapter.mockReset();
  onLogout.mockReset();
  redirectToLogin.mockReset();
  api.defaults.adapter = adapter;
  setLogoutHandler(onLogout);
  setToken('old-tok');
});

describe('token storage', () => {
  it('keeps the access token in memory and never in web storage', () => {
    setToken('mem-tok');
    expect(getToken()).toBe('mem-tok');
    expect(JSON.stringify({ ...sessionStorage })).not.toContain('mem-tok');
    expect(JSON.stringify({ ...localStorage })).not.toContain('mem-tok');
  });
});

describe('refreshSession', () => {
  it('posts to /api/auth/refresh with credentials and the CSRF header, and stores the token', async () => {
    adapter.mockImplementation((config) => respond(config, 200, refreshOk('fresh')));
    const data = await refreshSession();
    const config = adapter.mock.calls[0][0];
    expect(config.url).toBe('/api/auth/refresh');
    expect(config.withCredentials).toBe(true);
    expect(config.headers['X-Requested-With']).toBe('XMLHttpRequest');
    expect(data.user).toEqual({ id: 'u1' });
    expect(getToken()).toBe('fresh');
  });
});

describe('api 401 interceptor', () => {
  it('leaves the session and page alone for a failed login', async () => {
    adapter.mockImplementation((config) => respond(config, 401));
    await expect(api.post('/api/auth/login', {})).rejects.toBeDefined();
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(onLogout).not.toHaveBeenCalled();
    expect(getToken()).toBe('old-tok');
  });

  it('leaves the session and page alone for a failed register', async () => {
    adapter.mockImplementation((config) => respond(config, 401));
    await expect(api.post('/api/auth/register', {})).rejects.toBeDefined();
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('refreshes once and retries the original request with the new token', async () => {
    adapter.mockImplementation((config) => {
      if (isRefresh(config)) return respond(config, 200, refreshOk('new-tok'));
      if (config.headers.Authorization === 'Bearer new-tok') return respond(config, 200, { ok: true });
      return respond(config, 401);
    });

    const res = await api.get('/api/concepts');

    expect(res.data).toEqual({ ok: true });
    expect(adapter.mock.calls.filter(([c]) => isRefresh(c))).toHaveLength(1);
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('shares one in-flight refresh between concurrent 401s', async () => {
    adapter.mockImplementation((config) => {
      if (isRefresh(config)) return new Promise((r) => setTimeout(r, 10)).then(() => respond(config, 200, refreshOk()));
      if (config.headers.Authorization === 'Bearer new-tok') return respond(config, 200, { ok: true });
      return respond(config, 401);
    });

    const results = await Promise.all([api.get('/api/a'), api.get('/api/b'), api.get('/api/c')]);

    expect(results.map((r) => r.data.ok)).toEqual([true, true, true]);
    expect(adapter.mock.calls.filter(([c]) => isRefresh(c))).toHaveLength(1);
  });

  it('clears the token, logs out and redirects to /login when refresh is rejected', async () => {
    adapter.mockImplementation((config) => respond(config, 401));

    await expect(api.get('/api/concepts')).rejects.toBeDefined();

    expect(getToken()).toBeNull();
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('keeps the session when refresh fails for a non-auth reason such as a 500', async () => {
    adapter.mockImplementation((config) => respond(config, isRefresh(config) ? 500 : 401));

    await expect(api.get('/api/concepts')).rejects.toBeDefined();

    expect(onLogout).not.toHaveBeenCalled();
    expect(redirectToLogin).not.toHaveBeenCalled();
  });

  it('does not retry a second time when the retried request is still 401', async () => {
    adapter.mockImplementation((config) => respond(config, isRefresh(config) ? 200 : 401, refreshOk()));

    await expect(api.get('/api/concepts')).rejects.toBeDefined();

    expect(adapter.mock.calls.filter(([c]) => !isRefresh(c))).toHaveLength(2);
    expect(redirectToLogin).toHaveBeenCalledTimes(1);
  });

  it('passes non-401 errors straight through', async () => {
    adapter.mockImplementation((config) => respond(config, 404));
    await expect(api.get('/api/concepts/x')).rejects.toBeDefined();
    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
