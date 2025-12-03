"use client";

import { useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function TestSupabasePage() {
  const [status, setStatus] = useState<any>({});

  useEffect(() => {
    const testEnv = () => {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      setStatus({
        hasUrl: !!url,
        hasKey: !!key,
        urlValue: url || "missing",
        keyLength: key?.length || 0,
        timestamp: new Date().toISOString(),
      });
    };

    testEnv();
  }, []);

  const testConnection = async () => {
    try {
      setStatus((prev: any) => ({ ...prev, testing: true, error: null }));

      const supabase = getSupabaseBrowserClient();

      // Test a simple query
      const { data, error } = await supabase
        .from("users")
        .select("count")
        .limit(1);

      setStatus((prev: any) => ({
        ...prev,
        testing: false,
        connectionSuccess: !error,
        error: error?.message || null,
        data,
      }));
    } catch (err: any) {
      setStatus((prev: any) => ({
        ...prev,
        testing: false,
        error: err.message || "Unknown error",
      }));
    }
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">Supabase Connection Test</h1>

      <div className="space-y-4">
        <div>
          <h2 className="font-semibold">Environment Variables (Browser):</h2>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
            {JSON.stringify(status, null, 2)}
          </pre>
        </div>

        <button
          onClick={testConnection}
          disabled={status.testing}
          className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:bg-gray-400"
        >
          {status.testing ? "Testing..." : "Test Connection"}
        </button>

        <div>
          <h2 className="font-semibold">Instructions:</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>Check if environment variables are loaded (hasUrl and hasKey should be true)</li>
            <li>Verify the URL matches your Supabase project</li>
            <li>Click "Test Connection" to test the actual connection</li>
            <li>Open browser DevTools Network tab to see the actual request</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
