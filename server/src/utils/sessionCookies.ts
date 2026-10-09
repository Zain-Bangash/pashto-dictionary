import { CookieOptions, Request, Response } from 'express';

const REFRESH_COOKIE = 'pd_rt';
const USERNAME_COOKIE = 'pd_ru';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const SAME_SITE_VALUES = ['strict', 'lax', 'none'] as const;
type SameSite = typeof SAME_SITE_VALUES[number];

// Outside production the cookie must work over plain http://localhost, so it is never Secure
// and SameSite=None (which requires Secure) is not allowed.
function cookieOptions(): CookieOptions {
  const production = process.env.NODE_ENV === 'production';
  const configured = (process.env.COOKIE_SAMESITE || '').toLowerCase() as SameSite;
  const sameSite: SameSite = !production
    ? 'lax'
    : SAME_SITE_VALUES.includes(configured) ? configured : 'strict';
  return {
    httpOnly: true,
    secure: production,
    sameSite,
    path: '/api/auth',
    ...(sameSite === 'none' && { partitioned: true }),
  };
}

function setSessionCookies(res: Response, refreshToken: string, username: string): void {
  const options = { ...cookieOptions(), maxAge: MAX_AGE_MS };
  res.cookie(REFRESH_COOKIE, refreshToken, options);
  res.cookie(USERNAME_COOKIE, username, options);
}

function clearSessionCookies(res: Response): void {
  const options = cookieOptions();
  res.clearCookie(REFRESH_COOKIE, options);
  res.clearCookie(USERNAME_COOKIE, options);
}

function readSessionCookies(req: Request): { refreshToken?: string; username?: string } {
  const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
  return { refreshToken: cookies[REFRESH_COOKIE], username: cookies[USERNAME_COOKIE] };
}

export { REFRESH_COOKIE, USERNAME_COOKIE, setSessionCookies, clearSessionCookies, readSessionCookies };
