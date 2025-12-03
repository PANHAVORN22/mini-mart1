"use client";

export default function DebugEnvClient() {
  // These should be available at build time
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <div className="p-8 space-y-4">
      <h1 className="text-2xl font-bold">Client Environment Debug</h1>

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-semibold mb-2">Environment Variables:</h2>
        <div className="space-y-2 font-mono text-sm">
          <div>
            <strong>NEXT_PUBLIC_SUPABASE_URL:</strong>
            <div className="ml-4 break-all">{url || "❌ MISSING"}</div>
          </div>
          <div>
            <strong>NEXT_PUBLIC_SUPABASE_ANON_KEY:</strong>
            <div className="ml-4 break-all">
              {key ? `✅ Present (${key.length} chars)` : "❌ MISSING"}
            </div>
          </div>
        </div>
      </div>

      <div className="bg-yellow-50 p-4 rounded border border-yellow-200">
        <h3 className="font-semibold mb-2">⚠️ If variables are MISSING:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>Verify .env.local exists in the project root</li>
          <li>Ensure variables start with NEXT_PUBLIC_</li>
          <li>Restart the dev server completely (stop and start again)</li>
          <li>Clear .next folder and restart: rm -rf .next && npm run dev</li>
        </ol>
      </div>

      <div className="bg-blue-50 p-4 rounded border border-blue-200">
        <h3 className="font-semibold mb-2">🔍 Process.env keys:</h3>
        <pre className="text-xs overflow-auto">
          {JSON.stringify(Object.keys(process.env).filter(k => k.startsWith('NEXT_PUBLIC_')), null, 2)}
        </pre>
      </div>
    </div>
  );
}
