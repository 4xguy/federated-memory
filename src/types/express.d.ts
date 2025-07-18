// User type for Express request object

declare global {
  namespace Express {
    interface User {
      id: string;
      email: string | null;
      name?: string | null;
      avatarUrl?: string | null;
      metadata?: any;
    }
    
    interface Request {
      user?: User;
      userId?: string; // Convenience property for BigMemory pattern
    }
  }
}

export {};