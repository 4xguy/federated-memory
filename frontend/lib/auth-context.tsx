'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

interface AuthContextType {
  token: string | null
  isLoading: boolean
  error: string | null
}

const AuthContext = createContext<AuthContextType>({
  token: null,
  isLoading: true,
  error: null,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession()
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      // Create a session in the backend
      fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: session.user.id,
          email: session.user.email,
          name: session.user.name,
          provider: 'oauth', // We can enhance this to detect the actual provider
        }),
      })
        .then(res => res.json())
        .then(data => {
          if (data.token) {
            setToken(data.token)
            // Store token in localStorage for persistence
            localStorage.setItem('auth_token', data.token)
          } else {
            setError('Failed to create session')
          }
        })
        .catch(err => {
          console.error('Failed to create session:', err)
          setError(err.message)
        })
        .finally(() => {
          setIsLoading(false)
        })
    } else if (status === 'unauthenticated') {
      // Clear token
      setToken(null)
      localStorage.removeItem('auth_token')
      setIsLoading(false)
    } else if (status === 'loading') {
      // Check localStorage for existing token
      const storedToken = localStorage.getItem('auth_token')
      if (storedToken) {
        // Verify token is still valid
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/session`, {
          headers: {
            'Authorization': `Bearer ${storedToken}`,
          },
        })
          .then(res => {
            if (res.ok) {
              setToken(storedToken)
            } else {
              localStorage.removeItem('auth_token')
            }
          })
          .catch(() => {
            localStorage.removeItem('auth_token')
          })
      }
    }
  }, [session, status])

  return (
    <AuthContext.Provider value={{ token, isLoading, error }}>
      {children}
    </AuthContext.Provider>
  )
}