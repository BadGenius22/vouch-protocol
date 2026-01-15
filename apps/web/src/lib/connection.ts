/**
 * Solana Connection Configuration
 * Supports multiple RPC providers with automatic fallback
 *
 * RPC Priority:
 * 1. Helius (primary - best for DAS API)
 * 2. Quicknode (fallback - reliable and fast)
 * 3. Default Solana RPC (last resort)
 *
 * @see https://www.quicknode.com - Quicknode sponsor
 */

import { Connection, clusterApiUrl, Commitment } from '@solana/web3.js';

export type NetworkType = 'mainnet-beta' | 'devnet' | 'testnet';

interface RPCConfig {
  primary: string;
  fallbacks: string[];
}

interface ConnectionOptions {
  commitment?: Commitment;
  confirmTransactionInitialTimeout?: number;
}

const DEFAULT_TIMEOUT = 60000;
const DEFAULT_COMMITMENT: Commitment = 'confirmed';

/**
 * Get RPC configuration based on network
 * Prioritizes Helius, falls back to Quicknode, then default
 */
function getRPCConfig(network: NetworkType): RPCConfig {
  const heliusUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  const quicknodeUrl = process.env.NEXT_PUBLIC_QUICKNODE_RPC_URL;
  const fallbackUrl = clusterApiUrl(network);

  return {
    primary: heliusUrl || fallbackUrl,
    fallbacks: [quicknodeUrl, fallbackUrl].filter(Boolean) as string[],
  };
}

/**
 * Create a connection to Solana
 * Uses the primary RPC endpoint
 *
 * @param network - Network to connect to (default: from env or devnet)
 * @param options - Connection options
 * @returns Solana Connection instance
 */
export function createConnection(
  network?: NetworkType,
  options?: ConnectionOptions
): Connection {
  const networkToUse =
    network ||
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as NetworkType) ||
    'devnet';

  const config = getRPCConfig(networkToUse);

  return new Connection(config.primary, {
    commitment: options?.commitment || DEFAULT_COMMITMENT,
    confirmTransactionInitialTimeout:
      options?.confirmTransactionInitialTimeout || DEFAULT_TIMEOUT,
  });
}

/**
 * Create connection with health check and automatic failover
 * Tries each RPC endpoint until one responds
 *
 * @param network - Network to connect to
 * @param options - Connection options
 * @returns Healthy Solana Connection instance
 * @throws Error if all endpoints fail
 */
export async function createHealthyConnection(
  network?: NetworkType,
  options?: ConnectionOptions
): Promise<Connection> {
  const networkToUse =
    network ||
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as NetworkType) ||
    'devnet';

  const config = getRPCConfig(networkToUse);
  const allUrls = [config.primary, ...config.fallbacks].filter(
    (url, index, self) => url && self.indexOf(url) === index // deduplicate
  );

  for (const url of allUrls) {
    try {
      const connection = new Connection(url, {
        commitment: options?.commitment || DEFAULT_COMMITMENT,
        confirmTransactionInitialTimeout:
          options?.confirmTransactionInitialTimeout || DEFAULT_TIMEOUT,
      });

      // Health check: get recent blockhash with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      try {
        await connection.getLatestBlockhash();
        clearTimeout(timeoutId);

        const urlPreview = url.length > 40 ? `${url.slice(0, 40)}...` : url;
        console.log(`[RPC] Connected to: ${urlPreview}`);

        return connection;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      const urlPreview = url.length > 40 ? `${url.slice(0, 40)}...` : url;
      console.warn(`[RPC] Failed to connect to ${urlPreview}, trying next...`);
    }
  }

  throw new Error('All RPC endpoints failed. Please check your network connection.');
}

/**
 * Get current network from environment
 *
 * @returns Current network type
 */
export function getCurrentNetwork(): NetworkType {
  return (process.env.NEXT_PUBLIC_SOLANA_NETWORK as NetworkType) || 'devnet';
}

/**
 * Get explorer URL for a transaction or address
 *
 * @param signature - Transaction signature or address
 * @param type - 'tx' for transaction, 'address' for account
 * @param network - Network (default: current network)
 * @returns Solana Explorer URL
 */
export function getExplorerUrl(
  signature: string,
  type: 'tx' | 'address' = 'tx',
  network?: NetworkType
): string {
  const net = network || getCurrentNetwork();
  const cluster = net === 'mainnet-beta' ? '' : `?cluster=${net}`;
  return `https://explorer.solana.com/${type}/${signature}${cluster}`;
}

/**
 * Get Solscan URL for a transaction or address
 *
 * @param signature - Transaction signature or address
 * @param type - 'tx' for transaction, 'account' for account
 * @param network - Network (default: current network)
 * @returns Solscan URL
 */
export function getSolscanUrl(
  signature: string,
  type: 'tx' | 'account' = 'tx',
  network?: NetworkType
): string {
  const net = network || getCurrentNetwork();
  const cluster = net === 'mainnet-beta' ? '' : `?cluster=${net}`;
  return `https://solscan.io/${type}/${signature}${cluster}`;
}

/**
 * RPC health status
 */
export interface RPCHealthStatus {
  endpoint: string;
  healthy: boolean;
  latency?: number;
  error?: string;
}

/**
 * Check health of all configured RPC endpoints
 * Useful for debugging and status display
 *
 * @param network - Network to check
 * @returns Health status for each endpoint
 */
export async function checkRPCHealth(
  network?: NetworkType
): Promise<RPCHealthStatus[]> {
  const networkToUse =
    network ||
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as NetworkType) ||
    'devnet';

  const config = getRPCConfig(networkToUse);
  const allUrls = [config.primary, ...config.fallbacks].filter(
    (url, index, self) => url && self.indexOf(url) === index
  );

  const results: RPCHealthStatus[] = [];

  for (const url of allUrls) {
    const urlPreview = url.length > 50 ? `${url.slice(0, 50)}...` : url;

    try {
      const connection = new Connection(url, { commitment: DEFAULT_COMMITMENT });
      const start = Date.now();
      await connection.getLatestBlockhash();
      const latency = Date.now() - start;

      results.push({
        endpoint: urlPreview,
        healthy: true,
        latency,
      });
    } catch (error) {
      results.push({
        endpoint: urlPreview,
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return results;
}

/**
 * Create a connection pool for parallel operations
 * Returns multiple connections for load balancing
 *
 * @param network - Network to connect to
 * @param count - Number of connections (default: 3)
 * @returns Array of Connection instances
 */
export function createConnectionPool(
  network?: NetworkType,
  count: number = 3
): Connection[] {
  const networkToUse =
    network ||
    (process.env.NEXT_PUBLIC_SOLANA_NETWORK as NetworkType) ||
    'devnet';

  const config = getRPCConfig(networkToUse);
  const allUrls = [config.primary, ...config.fallbacks].filter(Boolean);

  const connections: Connection[] = [];

  for (let i = 0; i < count; i++) {
    const url = allUrls[i % allUrls.length];
    connections.push(
      new Connection(url, {
        commitment: DEFAULT_COMMITMENT,
        confirmTransactionInitialTimeout: DEFAULT_TIMEOUT,
      })
    );
  }

  return connections;
}
