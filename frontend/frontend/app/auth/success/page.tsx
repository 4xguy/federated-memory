'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function AuthSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const token = searchParams.get('token');
    const provider = searchParams.get('provider');
    
    if (token) {
      // Store the token in localStorage (matching the auth-context key)
      localStorage.setItem('auth_token', token);
      
      // Also store in the alternate key used elsewhere
      localStorage.setItem('authToken', token);
      
      // Log for debugging
      console.log('Auth success:', { token, provider });
      
      // Redirect to dashboard or home page
      setTimeout(() => {
        router.push('/dashboard');
      }, 1000);
    } else {
      // No token, redirect to login
      router.push('/login');
    }
  }, [searchParams, router]);
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            Authentication Successful
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Redirecting to dashboard...
          </p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        </div>
      </div>
    </div>
  );
}