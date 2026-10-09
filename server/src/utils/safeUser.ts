import { IUser } from '../types/models';

type SafeUserInput = IUser | (Omit<IUser, keyof Document> & {
  _id: unknown;
  username: string;
  email: string;
  role: string;
  region?: string;
  village?: string;
  createdAt: Date;
});

function safeUser(user: SafeUserInput) {
  return {
    id: (user as IUser)._id,
    username: user.username,
    email: user.email,
    role: user.role,
    region: user.region,
    village: user.village,
    createdAt: user.createdAt,
  };
}

export { safeUser };
