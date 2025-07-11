export default function Home() {
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