'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast, Toaster } from 'react-hot-toast';
import { Mail, Key, Brain } from 'lucide-react';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import { Button, Input, Label, FormField, ErrorMessage, Heading, Text } from '@/components/ui';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsSubmitting(true);
    try {
      const response = await authAPI.login(data.email, data.password);
      
      // Store token in localStorage
      localStorage.setItem('federated_memory_token', response.token);
      // Session cookie will be set automatically by the server
      
      toast.success('Login successful!');
      
      // Redirect to dashboard
      setTimeout(() => {
        router.push('/');
      }, 1000);
    } catch (error: any) {
      if (error.response?.status === 401) {
        toast.error('Invalid email or password');
      } else if (error.response?.status === 403) {
        const message = error.response?.data?.message;
        if (message?.includes('verify')) {
          toast.error('Please verify your email before logging in');
        } else if (message?.includes('deactivated')) {
          toast.error('This account has been deactivated');
        } else {
          toast.error(message || 'Access forbidden');
        }
      } else {
        toast.error('Login failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <Toaster position="top-right" />

      <div className="max-w-[400px] w-full px-6">
        <div className="space-y-12">
          {/* Logo */}
          <div className="text-center">
            <Link href="/" className="inline-flex items-center space-x-3">
              <Brain className="h-12 w-12 text-blue-600" />
              <span className="text-4xl font-bold text-gray-900 dark:text-white">Federated Memory</span>
            </Link>
          </div>
          
          {/* Heading */}
          <div className="text-center space-y-2">
            <Heading as="h2" variant="h2" className="text-center">
              Welcome Back
            </Heading>
            <Text className="text-center">
              Sign in to access your federated AI memory system.
            </Text>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Email Field */}
            <FormField>
              <Input
                {...register('email')}
                type="email"
                placeholder="Enter your email"
                error={!!errors.email}
                disabled={isSubmitting}
                icon={<Mail className="h-5 w-5" />}
                iconPosition="left"
              />
              {errors.email && (
                <ErrorMessage>{errors.email.message}</ErrorMessage>
              )}
            </FormField>
            
            {/* Password Field */}
            <FormField>
              <Input
                {...register('password')}
                type="password"
                placeholder="Enter your password"
                error={!!errors.password}
                disabled={isSubmitting}
                icon={<Key className="h-5 w-5" />}
                iconPosition="left"
              />
              {errors.password && (
                <ErrorMessage>{errors.password.message}</ErrorMessage>
              )}
            </FormField>
            
            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
            >
              Sign In
            </Button>
          </form>

          {/* Footer */}
          <div className="space-y-8">
            <Text variant="caption" className="text-center">
              Don't have an account?{' '}
              <Link href="/register" className="text-blue-600 font-medium hover:underline">
                Create one
              </Link>
            </Text>
            
            <div className="text-center">
              <Text variant="caption" className="text-gray-500">
                Forgot your password? Contact support for assistance.
              </Text>
            </div>
          </div>
        </div>
        
        {/* Sidebar Badge */}
        <div className="fixed right-8 top-1/2 -translate-y-1/2 max-w-[280px] hidden lg:block">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-3">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <Text variant="caption" className="font-semibold">
                Federated Memory Features
              </Text>
            </div>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <Text variant="caption">Distributed memory modules</Text>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <Text variant="caption">Intelligent CMI routing</Text>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <Text variant="caption">MCP protocol support</Text>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}