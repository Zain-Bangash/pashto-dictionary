declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: 'user' | 'moderator' | 'admin' };
    }
  }
}
export {};
