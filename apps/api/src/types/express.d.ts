export type AuthContext = {
  apiKeyId: string;
  userId: string;
  projectId: string;
  tier: 'FREE' | 'STARTER' | 'GROWTH' | 'ENTERPRISE';
  rateLimit: number;
};

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}
