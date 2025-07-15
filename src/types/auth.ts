import { Request } from 'express';

export interface AuthRequest extends Request {
  // User is now defined in express.d.ts
}
