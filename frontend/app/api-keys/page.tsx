'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { getApiUrl } from '@/lib/config'

interface ApiKey {
  id: string
  name: string
  key: string
  createdAt: string
  lastUsedAt?: string
  expiresAt?: string
}

export default function ApiKeysPage() {
  const { data: session, status } = useSession()
  const { token, isLoading: authLoading } = useAuth()
  const router = useRouter()
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNewKey, setShowNewKey] = useState<string | null>(null)
  const [keyName, setKeyName] = useState('')
  const [creating, setCreating] = useState(false)

  // Debug logging
  useEffect(() => {
    console.log('=== Environment Debug ===');
    console.log('NEXT_PUBLIC_API_URL from env:', process.env.NEXT_PUBLIC_API_URL);
    console.log('API URL from getApiUrl():', getApiUrl());
    console.log('All NEXT_PUBLIC vars:', Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC')));
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login')
    } else if (status === 'authenticated' && token && !authLoading) {
      fetchApiKeys()
    }
  }, [status, router, token, authLoading])

  const fetchApiKeys = async () => {
    if (!token) return;
    
    try {
      const response = await fetch(`${getApiUrl()}/api/keys`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch API keys')
      }
      
      const data = await response.json()
      setApiKeys(data.keys || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const createApiKey = async () => {
    if (!keyName.trim()) {
      setError('Please enter a name for the API key')
      return
    }

    if (!token) {
      setError('Authentication required')
      return
    }

    setCreating(true)
    setError(null)

    try {
      const response = await fetch(`${getApiUrl()}/api/keys`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: keyName }),
      })
      
      if (!response.ok) {
        throw new Error('Failed to create API key')
      }
      
      const data = await response.json()
      setShowNewKey(data.key)
      setKeyName('')
      await fetchApiKeys()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  const deleteApiKey = async (keyId: string) => {
    if (!confirm('Are you sure you want to delete this API key? This action cannot be undone.')) {
      return
    }

    if (!token) {
      setError('Authentication required')
      return
    }

    try {
      const response = await fetch(`${getApiUrl()}/api/keys/${keyId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete API key')
      }
      
      await fetchApiKeys()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('Copied to clipboard!'))
      .catch(() => alert('Failed to copy'))
  }

  if (status === 'loading' || loading || authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-24">
      <div className="z-10 max-w-5xl w-full">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">API Keys</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        {showNewKey && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
            <p className="font-bold mb-2">Your new API key (copy it now, it won't be shown again!):</p>
            <div className="flex items-center gap-2">
              <code className="bg-gray-100 p-2 rounded flex-1 break-all">{showNewKey}</code>
              <button
                onClick={() => copyToClipboard(showNewKey)}
                className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setShowNewKey(null)}
              className="mt-2 text-sm underline"
            >
              Close
            </button>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Create New API Key</h2>
          <div className="flex gap-2">
            <input
              type="text"
              value={keyName}
              onChange={(e) => setKeyName(e.target.value)}
              placeholder="Enter a name for this key (e.g., Claude Desktop)"
              className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={creating}
            />
            <button
              onClick={createApiKey}
              disabled={creating}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Key'}
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Your API Keys</h2>
          {apiKeys.length === 0 ? (
            <p className="text-gray-500">No API keys yet. Create one above to get started.</p>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((apiKey) => (
                <div key={apiKey.id} className="flex items-center justify-between p-3 border rounded">
                  <div>
                    <p className="font-semibold">{apiKey.name}</p>
                    <p className="text-sm text-gray-500">
                      Created: {new Date(apiKey.createdAt).toLocaleDateString()}
                      {apiKey.lastUsedAt && ` • Last used: ${new Date(apiKey.lastUsedAt).toLocaleDateString()}`}
                    </p>
                    <p className="text-sm font-mono text-gray-400">
                      {apiKey.key.substring(0, 10)}...{apiKey.key.substring(apiKey.key.length - 10)}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteApiKey(apiKey.id)}
                    className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                  >
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="mt-8 p-6 bg-gray-100 dark:bg-gray-900 rounded-lg">
          <h3 className="text-lg font-semibold mb-2">How to use your API key:</h3>
          <pre className="text-sm bg-gray-200 dark:bg-gray-800 p-3 rounded overflow-x-auto">
{`// In Claude Desktop config:
{
  "mcpServers": {
    "federated-memory": {
      "transport": {
        "type": "http",
        "url": "${getApiUrl()}/mcp"
      },
      "auth": {
        "type": "bearer",
        "token": "YOUR_API_KEY_HERE"
      }
    }
  }
}`}
          </pre>
        </div>
      </div>
    </main>
  )
}