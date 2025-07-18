'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function RegisterPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [token, setToken] = useState('')
  const [mcpUrl, setMcpUrl] = useState('')
  
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://federated-memory-production.up.railway.app'

  const handleQuickRegister = async () => {
    setLoading(true)
    setError('')
    
    try {
      const response = await fetch(`${backendUrl}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      })
      
      const data = await response.json()
      
      if (response.ok && data.success) {
        setSuccess(true)
        setToken(data.data.token)
        setMcpUrl(`${backendUrl}/${data.data.token}/sse`)
      } else {
        setError(data.error || 'Registration failed')
      }
    } catch (err) {
      setError('Network error: Unable to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = (text: string, button: 'token' | 'url') => {
    navigator.clipboard.writeText(text)
    // You could add a toast notification here
  }

  if (success) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="z-10 max-w-2xl w-full space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-extrabold text-green-600">
              Registration Successful!
            </h2>
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              Your MCP authentication credentials are ready
            </p>
          </div>
          
          <div className="space-y-6">
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
                UUID TOKEN (save this!)
              </h3>
              <div className="flex items-center space-x-2">
                <code className="flex-1 p-2 bg-white dark:bg-gray-900 rounded text-sm break-all">
                  {token}
                </code>
                <button
                  onClick={() => copyToClipboard(token, 'token')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-2">
                MCP SERVER URL
              </h3>
              <div className="flex items-center space-x-2">
                <code className="flex-1 p-2 bg-white dark:bg-gray-900 rounded text-sm break-all">
                  {mcpUrl}
                </code>
                <button
                  onClick={() => copyToClipboard(mcpUrl, 'url')}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Copy
                </button>
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
              <h4 className="font-medium mb-2">Quick Setup for Claude Desktop:</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                <li>Copy the MCP URL above</li>
                <li>Open Claude Desktop settings</li>
                <li>Add a new MCP server with type "SSE"</li>
                <li>Paste the URL and save</li>
              </ol>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold">
            Federated Memory
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600 dark:text-gray-400">
            Create an account or sign in
          </p>
        </div>
        
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}
        
        <div className="mt-8 space-y-4">
          <button
            onClick={handleQuickRegister}
            disabled={loading}
            className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Generating...' : 'Generate MCP URL without Email'}
          </button>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300 dark:border-gray-700" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-gray-900 text-gray-500">
                or use the full registration
              </span>
            </div>
          </div>
          
          <button
            onClick={() => window.location.href = `${backendUrl}/register.html`}
            className="group relative w-full flex justify-center py-3 px-4 border border-gray-300 dark:border-gray-700 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Email & Password Registration
          </button>
        </div>
      </div>
    </main>
  )
}