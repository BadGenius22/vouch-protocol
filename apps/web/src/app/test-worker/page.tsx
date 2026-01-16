'use client';

import { useState, useCallback, useEffect } from 'react';
import { useProofWorker, isWorkerSupported } from '@/lib/workers';
import { getCacheStats, clearProofCache, cleanupExpiredProofs } from '@/lib/proof-cache';
import type { ProofGenerationProgress, DevReputationInput } from '@/lib/types';

// Mock data for testing
const MOCK_DEV_INPUT: DevReputationInput = {
  walletPubkey: '11111111111111111111111111111111', // System program (valid base58)
  programs: [
    {
      address: '22222222222222222222222222222222',
      name: 'Test Program 1',
      deployedAt: new Date().toISOString(),
      deployer: '11111111111111111111111111111111',
      estimatedTVL: 50000,
    },
    {
      address: '33333333333333333333333333333333',
      name: 'Test Program 2',
      deployedAt: new Date().toISOString(),
      deployer: '11111111111111111111111111111111',
      estimatedTVL: 75000,
    },
  ],
  minTvl: 100000,
};

export default function TestWorkerPage() {
  const [logs, setLogs] = useState<string[]>([]);
  const [progress, setProgress] = useState<ProofGenerationProgress | null>(null);
  const [cacheStats, setCacheStats] = useState<{ count: number; oldestAt: number | null; newestAt: number | null } | null>(null);
  const [workerSupported, setWorkerSupported] = useState<boolean | null>(null);

  const { generateDevProof, isGenerating, isReady } = useProofWorker();

  // Check worker support on client only (avoids hydration mismatch)
  useEffect(() => {
    setWorkerSupported(isWorkerSupported());
  }, []);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  }, []);

  const handleProgressUpdate = useCallback((p: ProofGenerationProgress) => {
    setProgress(p);
    addLog(`Progress: ${p.progress}% - ${p.message}`);
  }, [addLog]);

  // Test 1: Check Worker Support
  const testWorkerSupport = () => {
    addLog('--- Testing Worker Support ---');
    addLog(`Web Workers supported: ${workerSupported ? 'YES' : 'NO'}`);
    addLog(`Worker ready: ${isReady ? 'YES' : 'NO'}`);
  };

  // Test 2: Check Cache Stats
  const testCacheStats = async () => {
    addLog('--- Testing Cache Stats ---');
    try {
      const stats = await getCacheStats();
      setCacheStats(stats);
      addLog(`Cache count: ${stats.count}`);
      if (stats.oldestAt) {
        addLog(`Oldest entry: ${new Date(stats.oldestAt).toISOString()}`);
      }
      if (stats.newestAt) {
        addLog(`Newest entry: ${new Date(stats.newestAt).toISOString()}`);
      }
    } catch (error) {
      addLog(`Cache stats error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  };

  // Test 3: Clear Cache
  const testClearCache = async () => {
    addLog('--- Clearing Cache ---');
    try {
      await clearProofCache();
      addLog('Cache cleared successfully');
      await testCacheStats();
    } catch (error) {
      addLog(`Clear cache error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  };

  // Test 4: Cleanup Expired
  const testCleanupExpired = async () => {
    addLog('--- Cleaning Up Expired Proofs ---');
    try {
      const deleted = await cleanupExpiredProofs();
      addLog(`Deleted ${deleted} expired proofs`);
    } catch (error) {
      addLog(`Cleanup error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
  };

  // Test 5a: Direct S3 fetch test
  const testS3Fetch = async () => {
    addLog('--- Testing Direct S3 Fetch ---');
    addLog('Fetching from aztec-ignition.s3.amazonaws.com...');

    // Test 1: Try HEAD request
    try {
      addLog('Test 1: HEAD request...');
      const response = await fetch('https://aztec-ignition.s3.amazonaws.com/MAIN%20IGNITION/flat/g1.dat', {
        method: 'HEAD',
        mode: 'cors',
      });
      addLog(`HEAD Response status: ${response.status}`);
      addLog('HEAD request SUCCESS');
    } catch (error) {
      addLog(`HEAD request FAILED: ${error instanceof Error ? error.message : 'Unknown'}`);
      if (error instanceof TypeError) {
        addLog('TypeError suggests CORS or network issue');
      }
    }

    // Test 2: Try GET request with Range header (small portion)
    try {
      addLog('Test 2: GET request with Range header...');
      const response = await fetch('https://aztec-ignition.s3.amazonaws.com/MAIN%20IGNITION/flat/g1.dat', {
        method: 'GET',
        headers: { 'Range': 'bytes=0-100' },
        mode: 'cors',
      });
      addLog(`GET Response status: ${response.status}`);
      addLog('GET request SUCCESS');
    } catch (error) {
      addLog(`GET request FAILED: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Test 3: Try simple GET without Range
    try {
      addLog('Test 3: Simple GET (no-cors mode)...');
      const response = await fetch('https://aztec-ignition.s3.amazonaws.com/MAIN%20IGNITION/flat/g1.dat', {
        method: 'GET',
        mode: 'no-cors',
      });
      addLog(`no-cors Response type: ${response.type}`);
      addLog('no-cors request completed (opaque response expected)');
    } catch (error) {
      addLog(`no-cors request FAILED: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Check if navigator is online
    addLog(`Navigator online: ${navigator.onLine}`);
  };

  // Test 5b: Circuit file fetch test
  const testCircuitFetch = async () => {
    addLog('--- Testing Circuit File Fetch ---');
    try {
      const response = await fetch('/circuits/dev_reputation.json');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const circuit = await response.json();
      addLog(`Circuit fetch SUCCESS`);
      addLog(`Bytecode length: ${circuit.bytecode?.length || 'N/A'} chars`);
      addLog(`ABI: ${circuit.abi ? 'present' : 'missing'}`);
    } catch (error) {
      addLog(`Circuit fetch FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Test 5c: Direct UltraHonk backend initialization test
  const testBackendInit = async () => {
    addLog('--- Testing Backend Initialization ---');
    try {
      addLog('Loading Barretenberg and UltraHonkBackend from @aztec/bb.js...');
      const { Barretenberg, UltraHonkBackend } = await import('@aztec/bb.js');

      addLog('Fetching circuit bytecode...');
      const response = await fetch('/circuits/dev_reputation.json');
      const circuit = await response.json();

      addLog('Creating Barretenberg API instance (threads: 1)...');
      const api = await Barretenberg.new({
        threads: 1,
        logger: (msg: string) => addLog(`[bb.js] ${msg}`),
      });
      addLog('Barretenberg API created successfully!');

      addLog('Creating UltraHonkBackend instance...');
      const backend = new UltraHonkBackend(circuit.bytecode, api);
      addLog('Backend created successfully!');

      addLog('Now testing if we can destroy it...');
      await api.destroy();
      addLog('API destroyed successfully!');
    } catch (error) {
      addLog(`Backend init FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (error instanceof Error && error.stack) {
        addLog(`Stack: ${error.stack.split('\n')[1]?.trim() || 'N/A'}`);
      }
    }
  };

  // Test 5: Generate Proof with Worker
  const testGenerateProof = async () => {
    addLog('--- Testing Proof Generation ---');
    addLog(`Input wallet: ${MOCK_DEV_INPUT.walletPubkey.slice(0, 8)}...`);
    addLog(`Min TVL threshold: ${MOCK_DEV_INPUT.minTvl.toLocaleString()}`);
    addLog(`Programs count: ${MOCK_DEV_INPUT.programs.length}`);

    const startTime = Date.now();

    try {
      const result = await generateDevProof(MOCK_DEV_INPUT, handleProgressUpdate);
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);

      addLog(`SUCCESS! Proof generated in ${duration}s`);
      addLog(`Proof size: ${result.proof.length} bytes`);
      addLog(`Public inputs: ${result.publicInputs.length}`);
      addLog(`Nullifier: ${result.nullifier.slice(0, 16)}...`);
      addLog(`Commitment: ${result.commitment.slice(0, 16)}...`);
      addLog(`Expires at: ${new Date(result.expiresAt).toISOString()}`);

      // Check cache after generation
      await testCacheStats();
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      addLog(`FAILED after ${duration}s: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Test 6: Generate Again (should use cache)
  const testCachedProof = async () => {
    addLog('--- Testing Cached Proof (should be instant) ---');

    const startTime = Date.now();

    try {
      const result = await generateDevProof(MOCK_DEV_INPUT, handleProgressUpdate);
      const duration = Date.now() - startTime;

      addLog(`SUCCESS! Retrieved in ${duration}ms`);
      addLog(`From cache: ${duration < 100 ? 'YES (fast)' : 'NO (slow)'}`);
      addLog(`Nullifier: ${result.nullifier.slice(0, 16)}...`);
    } catch (error) {
      addLog(`FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Worker & Caching Test Page</h1>
          <p className="text-muted-foreground">
            Test the Web Worker proof generation and IndexedDB caching functionality.
          </p>
        </div>

        {/* Status */}
        <div className="p-4 rounded-lg border bg-card">
          <h2 className="font-semibold mb-2">Status</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Workers: </span>
              <span className={workerSupported ? 'text-green-500' : workerSupported === false ? 'text-red-500' : 'text-yellow-500'}>
                {workerSupported === null ? 'Checking...' : workerSupported ? 'Supported' : 'Not Supported'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Worker Ready: </span>
              <span className={isReady ? 'text-green-500' : 'text-yellow-500'}>
                {isReady ? 'Yes' : 'Initializing...'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Generating: </span>
              <span className={isGenerating ? 'text-yellow-500' : 'text-muted-foreground'}>
                {isGenerating ? 'Yes' : 'No'}
              </span>
            </div>
          </div>
        </div>

        {/* Progress */}
        {progress && (
          <div className="p-4 rounded-lg border bg-card">
            <h2 className="font-semibold mb-2">Progress</h2>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{progress.message}</span>
                <span>{progress.progress}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Cache Stats */}
        {cacheStats && (
          <div className="p-4 rounded-lg border bg-card">
            <h2 className="font-semibold mb-2">Cache Stats</h2>
            <div className="text-sm space-y-1">
              <div>Cached proofs: {cacheStats.count}</div>
              {cacheStats.oldestAt && (
                <div>Oldest: {new Date(cacheStats.oldestAt).toLocaleString()}</div>
              )}
              {cacheStats.newestAt && (
                <div>Newest: {new Date(cacheStats.newestAt).toLocaleString()}</div>
              )}
            </div>
          </div>
        )}

        {/* Test Buttons */}
        <div className="p-4 rounded-lg border bg-card">
          <h2 className="font-semibold mb-4">Tests</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={testWorkerSupport}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition"
            >
              1. Check Worker Support
            </button>
            <button
              onClick={testCacheStats}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:opacity-90 transition"
            >
              2. Check Cache Stats
            </button>
            <button
              onClick={testClearCache}
              className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:opacity-90 transition"
            >
              3. Clear Cache
            </button>
            <button
              onClick={testCleanupExpired}
              className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:opacity-90 transition"
            >
              4. Cleanup Expired
            </button>
            <button
              onClick={testS3Fetch}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:opacity-90 transition"
            >
              5a. Test S3 Fetch
            </button>
            <button
              onClick={testCircuitFetch}
              className="px-4 py-2 bg-orange-500 text-white rounded-md hover:opacity-90 transition"
            >
              5b. Test Circuit Fetch
            </button>
            <button
              onClick={testBackendInit}
              className="px-4 py-2 bg-purple-500 text-white rounded-md hover:opacity-90 transition"
            >
              5c. Test Backend Init
            </button>
            <button
              onClick={testGenerateProof}
              disabled={isGenerating}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-md hover:opacity-90 transition disabled:opacity-50"
            >
              5d. Generate Proof
            </button>
            <button
              onClick={testCachedProof}
              disabled={isGenerating}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-md hover:opacity-90 transition disabled:opacity-50"
            >
              6. Get Cached Proof
            </button>
            <button
              onClick={() => setLogs([])}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:opacity-90 transition"
            >
              Clear Logs
            </button>
          </div>
        </div>

        {/* Logs */}
        <div className="p-4 rounded-lg border bg-card">
          <h2 className="font-semibold mb-2">Logs</h2>
          <div className="bg-black/50 rounded-md p-4 font-mono text-xs max-h-96 overflow-y-auto">
            {logs.length === 0 ? (
              <span className="text-muted-foreground">Click a test button to see logs...</span>
            ) : (
              logs.map((log, i) => (
                <div key={i} className={log.includes('SUCCESS') ? 'text-green-400' : log.includes('FAILED') ? 'text-red-400' : 'text-foreground'}>
                  {log}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Instructions */}
        <div className="p-4 rounded-lg border bg-muted/50 text-sm">
          <h2 className="font-semibold mb-2">Test Instructions</h2>
          <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
            <li>Click "Check Worker Support" to verify Web Workers are available</li>
            <li>Click "Check Cache Stats" to see current cache state</li>
            <li>Click "Clear Cache" to start fresh</li>
            <li>Click "Generate Proof" to test worker-based proof generation</li>
            <li>Click "Get Cached Proof" again - it should be instant from cache</li>
            <li>Check browser DevTools console for additional debug output</li>
          </ol>
          <p className="mt-4 text-yellow-500">
            Note: Actual proof generation requires the circuit files in /public/circuits/
          </p>
        </div>
      </div>
    </div>
  );
}
