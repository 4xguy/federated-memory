'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function AuthFailedPage() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to login after 3 seconds
    const timer = setTimeout(() => {
      router.push('/login');
    }, 3000);
    
    return () => clearTimeout(timer);
  }, [router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-red-600">
            Authentication Failed
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            There was an error during authentication. Redirecting to login...
          </p>
          <div className="mt-4">
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Return to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}