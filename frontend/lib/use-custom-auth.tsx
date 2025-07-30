'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getApiUrl } from './config'

interface User {
  id: string
  email: string
  name?: string | null
}

interface UseCustomAuthReturn {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  logout: () => void
}

export function useCustomAuth(): UseCustomAuthReturn {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    try {
      const token = localStorage.getItem('federated_memory_token')
      
      if (!token) {
        setIsLoading(false)
        return
      }

      // Verify token with backend
      const response = await fetch(`${getApiUrl()}/api/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        // Token invalid, remove it
        localStorage.removeItem('federated_memory_token')
        setUser(null)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
      setUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = () => {
    localStorage.removeItem('federated_memory_token')
    setUser(null)
    router.push('/login')
  }

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    logout,
  }
}