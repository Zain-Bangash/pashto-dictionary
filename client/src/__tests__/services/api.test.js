import { vi, beforeEach, describe, it, expect } from 'vitest';
import api, { setToken, getToken, setLogoutHandler } from '../../services/api';

const rejectWith = (url, status) =>
  api.interceptors.response.handlers[0].rejected({ config: { url }, response: { status } });

const onLogout = vi.fn();

beforeEach(() => {
  onLogout.mockReset();
  setLogoutHandler(onLogout);
  setToken('tok');
});

describe('api 401 interceptor', () => {
  it('leaves the session and page alone for a failed login', async () => {
    await expect(rejectWith('/api/auth/login', 401)).rejects.toBeDefined();
    expect(onLogout).not.toHaveBeenCalled();
    expect(getToken()).toBe('tok');
  });

  it('leaves the session and page alone for a failed register', async () => {
    await expect(rejectWith('/api/auth/register', 401)).rejects.toBeDefined();
    expect(onLogout).not.toHaveBeenCalled();
  });

  it('clears the token and logs out on a 401 from another route', async () => {
    await expect(rejectWith('/api/concepts', 401)).rejects.toBeDefined();
    expect(onLogout).toHaveBeenCalled();
    expect(getToken()).toBeNull();
  });
});
