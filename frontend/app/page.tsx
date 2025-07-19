'use client'

import { useSession, signOut } from 'next-auth/react'
import { useEffect } from 'react'

export default function Home() {
  const { data: session, status } = useSession()

  useEffect(() => {
    console.log('Session status:', status)
    console.log('Session data:', session)
  }, [session, status])

  if (status === 'loading') {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Loading...</h1>
        </div>
      </main>
    )
  }

  if (session) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-24">
        <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">
              Federated Memory System
            </h1>
            <div className="flex items-center gap-4">
              <span className="text-sm">
                Welcome, {session.user?.name || session.user?.email}!
              </span>
              <button
                onClick={() => signOut({ callbackUrl: '/' })}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Sign Out
              </button>
            </div>
          </div>
          <div className="text-center">
            <p className="mb-4">
              You are successfully signed in! Your MCP server is ready for use.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
              <div className="p-6 border rounded-lg">
                <h2 className="text-xl font-semibold mb-2">Dashboard</h2>
                <p className="text-sm opacity-75 mb-4">
                  View church metrics and analytics
                </p>
                <button 
                  onClick={() => window.location.href = '/dashboard'}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  Go to Dashboard
                </button>
              </div>
              <div className="p-6 border rounded-lg">
                <h2 className="text-xl font-semibold mb-2">People</h2>
                <p className="text-sm opacity-75 mb-4">
                  Manage church members and visitors
                </p>
                <button 
                  onClick={() => window.location.href = '/people'}
                  className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                >
                  Manage People
                </button>
              </div>
              <div className="p-6 border rounded-lg">
                <h2 className="text-xl font-semibold mb-2">API Keys</h2>
                <p className="text-sm opacity-75 mb-4">
                  Generate and manage API keys for MCP access
                </p>
                <button 
                  onClick={() => window.location.href = '/api-keys'}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Manage API Keys
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Federated Memory System
        </h1>
        <div className="text-center">
          <p className="mb-4">
            Welcome to the Federated Memory System. This interface allows you to manage
            your MCP server authentication and API keys.
          </p>
          <div className="flex gap-4 justify-center mt-8">
            <a
              href="/login"
              className="rounded-lg border border-transparent px-5 py-4 transition-colors hover:border-gray-300 hover:bg-gray-100 hover:dark:border-neutral-700 hover:dark:bg-neutral-800/30"
            >
              <h2 className="text-2xl font-semibold">
                Login {' '}
                <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
                  -&gt;
                </span>
              </h2>
              <p className="m-0 max-w-[30ch] text-sm opacity-50">
                Sign in with Google or GitHub
              </p>
            </a>
          </div>
        </div>
      </div>
    </main>
  )
}