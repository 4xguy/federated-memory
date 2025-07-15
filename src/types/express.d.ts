import { User as PrismaUser } from '@prisma/client';

declare global {
  namespace Express {
    interface User extends Pick<PrismaUser, 'id' | 'email' | 'name' | 'avatarUrl' | 'oauthProvider'> {}
    
    interface Request {
      user?: User;
    }
  }
}

export {};