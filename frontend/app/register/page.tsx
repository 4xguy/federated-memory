'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast, Toaster } from 'react-hot-toast';
import { Mail, Key, User, Brain } from 'lucide-react';
import Link from 'next/link';
import { authAPI } from '@/lib/api';
import { Button, Input, Label, FormField, ErrorMessage, Heading, Text } from '@/components/ui';

const registerSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  name: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsSubmitting(true);
    try {
      await authAPI.registerWithEmail(data.email, data.password, data.name);
      
      toast.success('Registration successful! Please check your email to verify your account.');
      
      // Redirect to login after a delay
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (error: any) {
      if (error.response?.status === 409) {
        toast.error('Email already registered');
      } else {
        toast.error('Registration failed. Please try again.');
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
              Create Your Account
            </Heading>
            <Text className="text-center">
              Join the federated AI memory revolution.
            </Text>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            
            {/* Name Field (Optional) */}
            <FormField>
              <Input
                {...register('name')}
                type="text"
                placeholder="Name (optional)"
                disabled={isSubmitting}
                icon={<User className="h-5 w-5" />}
                iconPosition="left"
              />
            </FormField>
            
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
                placeholder="Create a password (min 8 characters)"
                error={!!errors.password}
                disabled={isSubmitting}
                icon={<Key className="h-5 w-5" />}
                iconPosition="left"
              />
              {errors.password && (
                <ErrorMessage>{errors.password.message}</ErrorMessage>
              )}
            </FormField>
            
            {/* Confirm Password Field */}
            <FormField>
              <Input
                {...register('confirmPassword')}
                type="password"
                placeholder="Confirm your password"
                error={!!errors.confirmPassword}
                disabled={isSubmitting}
                icon={<Key className="h-5 w-5" />}
                iconPosition="left"
              />
              {errors.confirmPassword && (
                <ErrorMessage>{errors.confirmPassword.message}</ErrorMessage>
              )}
            </FormField>
            
            {/* Submit Button */}
            <Button
              type="submit"
              variant="primary"
              fullWidth
              loading={isSubmitting}
            >
              Create Account
            </Button>
          </form>

          {/* Terms */}
          <Text variant="caption" className="text-center">
            By creating an account, you agree to our{' '}
            <Link href="/terms" className="text-blue-600 hover:underline">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-blue-600 hover:underline">
              Privacy Policy
            </Link>
          </Text>

          {/* Footer */}
          <div className="space-y-8">
            <Text variant="caption" className="text-center">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 font-medium hover:underline">
                Sign in
              </Link>
            </Text>
          </div>
        </div>
        
        {/* Sidebar Badge */}
        <div className="fixed right-8 top-1/2 -translate-y-1/2 max-w-[280px] hidden lg:block">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg space-y-3">
            <div className="flex items-center space-x-2">
              <Brain className="h-5 w-5 text-blue-600" />
              <Text variant="caption" className="font-semibold">
                Why Federated Memory?
              </Text>
            </div>
            <ul className="space-y-2">
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <Text variant="caption">Your data stays private and secure</Text>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <Text variant="caption">Seamless integration with AI tools</Text>
              </li>
              <li className="flex items-start">
                <span className="text-blue-600 mr-2">•</span>
                <Text variant="caption">Intelligent memory organization</Text>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}