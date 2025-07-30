/**
 * Get the appropriate database URL based on environment and context
 * 
 * Priority order:
 * 1. In production (NODE_ENV=production): Use DATABASE_URL
 * 2. For local development connecting to prod: Use PRODUCTION_DATABASE_URL
 * 3. For local development with local DB: Use LOCAL_DATABASE_URL
 * 4. Fallback: DATABASE_URL
 * 
 * Scripts can override by passing useLocal=true or useProduction=true
 */
export function getDatabaseUrl(options?: { useLocal?: boolean; useProduction?: boolean }): string {
  // If explicitly requested, return specific database
  if (options?.useLocal && process.env.LOCAL_DATABASE_URL) {
    return process.env.LOCAL_DATABASE_URL;
  }
  
  if (options?.useProduction && process.env.PRODUCTION_DATABASE_URL) {
    return process.env.PRODUCTION_DATABASE_URL;
  }
  
  // In production environment (Railway), always use DATABASE_URL
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production environment');
    }
    return process.env.DATABASE_URL;
  }
  
  // In development, prefer PRODUCTION_DATABASE_URL for connecting to prod
  // This matches your .env.local setup
  if (process.env.PRODUCTION_DATABASE_URL) {
    console.log('Using PRODUCTION_DATABASE_URL for development');
    return process.env.PRODUCTION_DATABASE_URL;
  }
  
  // Fallback to DATABASE_URL if available
  if (process.env.DATABASE_URL) {
    console.log('Using DATABASE_URL');
    return process.env.DATABASE_URL;
  }
  
  // Last resort: try LOCAL_DATABASE_URL
  if (process.env.LOCAL_DATABASE_URL) {
    console.log('Using LOCAL_DATABASE_URL as fallback');
    return process.env.LOCAL_DATABASE_URL;
  }
  
  throw new Error('No database URL found. Please set PRODUCTION_DATABASE_URL or DATABASE_URL in your .env.local file');
}