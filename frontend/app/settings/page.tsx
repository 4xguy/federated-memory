'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useCustomAuth } from '@/lib/use-custom-auth'
import { getApiUrl } from '@/lib/config'

export default function SettingsPage() {
  const { user, isLoading: authLoading, isAuthenticated } = useCustomAuth()
  const router = useRouter()
  const [userToken, setUserToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        router.push('/login')
      } else {
        fetchUserToken()
      }
    }
  }, [authLoading, isAuthenticated, router])

  const fetchUserToken = async () => {
    const token = localStorage.getItem('federated_memory_token')
    if (!token) return

    try {
      const response = await fetch(`${getApiUrl()}/api/auth/token`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      
      if (response.ok) {
        const data = await response.json()
        setUserToken(data.token)
      }
    } catch (error) {
      console.error('Failed to fetch user token:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('Copied to clipboard!'))
      .catch(() => alert('Failed to copy'))
  }

  if (authLoading || loading) {
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
          <h1 className="text-4xl font-bold">Settings</h1>
          <button
            onClick={() => router.push('/')}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Back to Dashboard
          </button>
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Your MCP Server Token</h2>
          <p className="text-sm text-gray-600 mb-4">
            This is your unique token for MCP server access. Use it in the URL pattern shown below.
          </p>
          
          {userToken && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 p-3 rounded">
                <code className="font-mono text-sm flex-1 break-all">{userToken}</code>
                <button
                  onClick={() => copyToClipboard(userToken)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 whitespace-nowrap"
                >
                  Copy Token
                </button>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">MCP Server URLs:</h3>
                
                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      HTTP Endpoint (Recommended):
                    </p>
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 p-2 rounded">
                      <code className="font-mono text-xs flex-1 break-all">
                        {getApiUrl()}/{userToken}/mcp
                      </code>
                      <button
                        onClick={() => copyToClipboard(`${getApiUrl()}/${userToken}/mcp`)}
                        className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      SSE Endpoint (Legacy):
                    </p>
                    <div className="flex items-center gap-2 bg-gray-100 dark:bg-gray-900 p-2 rounded">
                      <code className="font-mono text-xs flex-1 break-all">
                        {getApiUrl()}/{userToken}/sse
                      </code>
                      <button
                        onClick={() => copyToClipboard(`${getApiUrl()}/${userToken}/sse`)}
                        className="px-3 py-1 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                      >
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h3 className="text-sm font-semibold mb-2">Claude Desktop Configuration:</h3>
                <pre className="text-xs bg-gray-100 dark:bg-gray-800 p-3 rounded overflow-x-auto">
{`{
  "mcpServers": {
    "federated-memory": {
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-bigmemory@latest",
        "${getApiUrl()}/${userToken}/mcp"
      ]
    }
  }
}`}
                </pre>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Account Information</h2>
          <div className="space-y-2">
            <p className="text-sm">
              <span className="font-medium">Email:</span> {user?.email}
            </p>
            <p className="text-sm">
              <span className="font-medium">Name:</span> {user?.name || 'Not set'}
            </p>
            <p className="text-sm">
              <span className="font-medium">User ID:</span> {user?.id}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}