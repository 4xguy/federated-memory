// Frontend configuration with fallbacks

export const config = {
  // API URL - must be set in production
  apiUrl: process.env.NEXT_PUBLIC_API_URL || '',
  
  // Auth URLs
  nextAuthUrl: process.env.NEXTAUTH_URL || '',
  
  // OAuth providers
  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID || '',
    },
  },
};

// Helper to get API URL with validation
export function getApiUrl(): string {
  const url = config.apiUrl;
  if (!url) {
    console.error('NEXT_PUBLIC_API_URL is not set. Please configure it in Railway environment variables.');
    // In development, you might want to use localhost
    if (process.env.NODE_ENV === 'development') {
      return 'http://localhost:3000';
    }
    // Return empty string to make the error obvious
    return '';
  }
  // Log the URL being used (remove in production)
  console.log('Using API URL:', url);
  return url;
}