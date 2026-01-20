'use server';

import { z } from 'zod';
import { Helius } from 'helius-sdk';
import { PublicKey } from '@solana/web3.js';
import type { ProgramData, TradingVolumeData, TradeData } from '@/lib/types';

// === Debug Mode ===
const DEBUG = process.env.NODE_ENV === 'development';

function debugLog(...args: unknown[]): void {
  if (DEBUG) {
    console.log('[Vouch]', ...args);
  }
}

function debugWarn(...args: unknown[]): void {
  if (DEBUG) {
    console.warn('[Vouch]', ...args);
  }
}

// === Constants ===

const BATCH_SIZE = 100; // Helius parseTransactions limit
const MAX_SIGNATURES_PROGRAMS = 500;
const MAX_SIGNATURES_TRADING = 1000;
const DUST_THRESHOLD_SOL = 0.001;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const TVL_CONCURRENCY_LIMIT = 5;

// Cache TTL in milliseconds (5 minutes)
const CACHE_TTL_MS = 5 * 60 * 1000;

// BPF Loader program IDs used for deploying Solana programs
const BPF_LOADER_PROGRAM_IDS = new Set([
  'BPFLoaderUpgradeab1e11111111111111111111111', // BPF Loader Upgradeable
  'BPFLoader2111111111111111111111111111111111', // BPF Loader 2
  'BPFLoader1111111111111111111111111111111111', // BPF Loader
]);

// Known stablecoin mints with their decimals
const STABLECOIN_MINTS: Record<string, number> = {
  'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v': 6, // USDC
  'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB': 6, // USDT
  'USDH1SM1ojwWUga67PGrgFWUHibbjqMvuMaDkRJTgkX': 6,  // USDH
  '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj': 9, // stSOL (liquid staking)
};

// Common token decimals (for non-stablecoins)
const COMMON_TOKEN_DECIMALS: Record<string, number> = {
  'So11111111111111111111111111111111111111112': 9,  // Wrapped SOL
  'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So': 9, // mSOL
  'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263': 5, // BONK
};

// === Types ===

interface ParsedTransaction {
  type: string;
  source?: string;
  signature: string;
  timestamp: number;
  description?: string;
  accountData?: Array<{
    account: string;
    nativeBalanceChange?: number;
  }>;
  instructions?: Array<{
    programId: string;
    accounts?: string[];
  }>;
  events?: {
    swap?: SwapEvent | null;
  };
  nativeTransfers?: Array<{ amount: number }> | null;
}

interface SwapEvent {
  nativeInput?: { amount: number };
  nativeOutput?: { amount: number };
  tokenInputs?: Array<{
    rawTokenAmount?: { tokenAmount?: string; decimals?: number };
    mint?: string;
  }>;
  tokenOutputs?: Array<{
    rawTokenAmount?: { tokenAmount?: string; decimals?: number };
    mint?: string;
  }>;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

// === Validation ===

// Proper base58 Solana address validation
const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const walletSchema = z.string().refine(
  (val) => {
    if (!base58Regex.test(val)) return false;
    try {
      new PublicKey(val);
      return true;
    } catch {
      return false;
    }
  },
  { message: 'Invalid Solana wallet address' }
);

// === Caching ===

const cache = new Map<string, CacheEntry<unknown>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache<T>(key: string, data: T): void {
  cache.set(key, { data, timestamp: Date.now() });
}

// === Helius Client ===

let heliusClient: Helius | null = null;

/**
 * Check if we should use mock data
 * - Always use mock on devnet/testnet (no real value)
 * - Use mock if HELIUS_API_KEY is not set
 * - Can be forced with USE_MOCK_DATA=true
 */
function shouldUseMockData(): boolean {
  // Force mock data via env var
  if (process.env.USE_MOCK_DATA === 'true') return true;

  // Always use mock on non-mainnet (devnet has no real TVL/volume)
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
  if (network !== 'mainnet-beta') return true;

  // Use mock if no API key
  if (!process.env.HELIUS_API_KEY) return true;

  return false;
}

function getHeliusClient(): Helius | null {
  // Always return null (use mock) on non-mainnet
  if (shouldUseMockData()) return null;

  const apiKey = process.env.HELIUS_API_KEY;
  if (!apiKey) return null;

  // Reuse client instance
  if (heliusClient) return heliusClient;

  const cluster = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as 'devnet' | 'mainnet-beta') || 'devnet';
  heliusClient = new Helius(apiKey, cluster);
  return heliusClient;
}

// === Retry Logic ===

async function withRetry<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries: number = MAX_RETRIES
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on validation errors or 4xx responses
      if (lastError.message.includes('Invalid') || lastError.message.includes('400')) {
        throw lastError;
      }

      if (attempt < maxRetries) {
        const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1); // Exponential backoff
        debugWarn(`${context} failed (attempt ${attempt}/${maxRetries}), retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

// === Price Fetching ===

let cachedSolPrice: { price: number; timestamp: number } | null = null;
const SOL_PRICE_CACHE_TTL = 60 * 1000; // 1 minute

async function getSolPriceUsd(): Promise<number> {
  // Check cache
  if (cachedSolPrice && Date.now() - cachedSolPrice.timestamp < SOL_PRICE_CACHE_TTL) {
    return cachedSolPrice.price;
  }

  try {
    // Use Jupiter Price API (free, reliable)
    const response = await fetch(
      'https://price.jup.ag/v6/price?ids=So11111111111111111111111111111111111111112'
    );

    if (response.ok) {
      const data = await response.json();
      const price = data.data?.['So11111111111111111111111111111111111111112']?.price;
      if (typeof price === 'number' && price > 0) {
        cachedSolPrice = { price, timestamp: Date.now() };
        return price;
      }
    }
  } catch (error) {
    debugWarn('Failed to fetch SOL price, using fallback:', error);
  }

  // Fallback to cached or default
  return cachedSolPrice?.price ?? 150; // Reasonable default
}

// === Concurrency Helper ===

/**
 * Process items with limited concurrency using a simple batching approach.
 * This fixes the previous implementation that had a race condition bug.
 */
async function mapWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];

  // Process items in batches of `concurrency` size
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }

  return results;
}

// === Main Functions ===

/**
 * Fetch programs deployed by a wallet using Helius API
 */
export async function getDeployedPrograms(walletAddress: string): Promise<{
  success: boolean;
  data?: ProgramData[];
  error?: string;
  partial?: boolean; // Indicates if some data might be missing due to errors
}> {
  try {
    // Validate wallet address
    const parseResult = walletSchema.safeParse(walletAddress);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid wallet address format' };
    }

    // Check cache
    const cacheKey = `programs:${walletAddress}`;
    const cached = getCached<ProgramData[]>(cacheKey);
    if (cached) {
      debugLog('Returning cached programs data');
      return { success: true, data: cached };
    }

    const helius = getHeliusClient();
    if (!helius) {
      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
      debugLog(`Using mock data (network: ${network})`);
      return { success: true, data: getMockProgramData(walletAddress) };
    }

    debugLog('Fetching deployed programs for:', walletAddress.slice(0, 8) + '...');

    // Get transaction signatures with retry
    const signatures = await withRetry(
      () =>
        helius.connection.getSignaturesForAddress(new PublicKey(walletAddress), {
          limit: MAX_SIGNATURES_PROGRAMS,
        }),
      'getSignaturesForAddress'
    );

    if (signatures.length === 0) {
      debugLog('No transactions found for wallet');
      const emptyResult: ProgramData[] = [];
      setCache(cacheKey, emptyResult);
      return { success: true, data: emptyResult };
    }

    const signatureStrings = signatures.map((s) => s.signature);
    const programs: ProgramData[] = [];
    const seenPrograms = new Set<string>();
    let hadErrors = false;

    // Process in batches
    for (let i = 0; i < signatureStrings.length; i += BATCH_SIZE) {
      const batch = signatureStrings.slice(i, i + BATCH_SIZE);

      try {
        const parsedTxs = await withRetry(
          () => helius.parseTransactions({ transactions: batch }),
          `parseTransactions batch ${i / BATCH_SIZE + 1}`
        );

        // Collect programs to estimate TVL for
        const programsToEstimate: Array<{ tx: ParsedTransaction; program: { address: string; name?: string } }> = [];

        for (const tx of parsedTxs) {
          const deployedProgram = extractDeployedProgram(tx as ParsedTransaction, walletAddress);
          if (deployedProgram && !seenPrograms.has(deployedProgram.address)) {
            seenPrograms.add(deployedProgram.address);
            programsToEstimate.push({ tx: tx as ParsedTransaction, program: deployedProgram });
          }
        }

        // Estimate TVL with concurrency limit
        if (programsToEstimate.length > 0) {
          const tvlResults = await mapWithConcurrency(
            programsToEstimate,
            async ({ tx, program }) => {
              const tvl = await estimateProgramTVL(helius, program.address);
              return {
                address: program.address,
                name: program.name,
                deployedAt: new Date(tx.timestamp * 1000).toISOString(),
                deployer: walletAddress,
                estimatedTVL: tvl,
              };
            },
            TVL_CONCURRENCY_LIMIT
          );

          programs.push(...tvlResults);
        }
      } catch (batchError) {
        if (DEBUG) console.error('[Vouch] Error processing batch:', batchError);
        hadErrors = true;
        // Continue with next batch
      }
    }

    debugLog(`Found ${programs.length} deployed programs`);
    setCache(cacheKey, programs);

    return {
      success: true,
      data: programs,
      partial: hadErrors,
    };
  } catch (error) {
    if (DEBUG) console.error('[Vouch] Error fetching deployed programs:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch programs',
    };
  }
}

/**
 * Fetch trading volume for a wallet using Helius API
 */
export async function getTradingVolume(
  walletAddress: string,
  daysBack: number = 30
): Promise<{
  success: boolean;
  data?: TradingVolumeData;
  error?: string;
  partial?: boolean;
}> {
  try {
    // Validate inputs
    const parseResult = walletSchema.safeParse(walletAddress);
    if (!parseResult.success) {
      return { success: false, error: 'Invalid wallet address format' };
    }

    if (daysBack < 1 || daysBack > 365) {
      return { success: false, error: 'daysBack must be between 1 and 365' };
    }

    // Check cache
    const cacheKey = `trading:${walletAddress}:${daysBack}`;
    const cached = getCached<TradingVolumeData>(cacheKey);
    if (cached) {
      debugLog('Returning cached trading data');
      return { success: true, data: cached };
    }

    const helius = getHeliusClient();
    if (!helius) {
      const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK || 'devnet';
      debugLog(`Using mock data (network: ${network})`);
      return { success: true, data: getMockTradingData(walletAddress, daysBack) };
    }

    debugLog('Fetching trading volume for:', walletAddress.slice(0, 8) + '...');

    const cutoffTimestamp = Math.floor(Date.now() / 1000) - daysBack * 24 * 60 * 60;

    // Fetch SOL price and transaction signatures in parallel (performance optimization)
    const [solPriceUsd, signatures] = await Promise.all([
      getSolPriceUsd(),
      withRetry(
        () =>
          helius.connection.getSignaturesForAddress(new PublicKey(walletAddress), {
            limit: MAX_SIGNATURES_TRADING,
          }),
        'getSignaturesForAddress'
      ),
    ]);

    // Filter signatures within the time period
    const recentSignatures = signatures.filter(
      (s) => s.blockTime && s.blockTime >= cutoffTimestamp
    );

    if (recentSignatures.length === 0) {
      debugLog('No recent transactions found');
      const emptyData: TradingVolumeData = {
        totalVolume: 0,
        tradeCount: 0,
        amounts: [],
        period: daysBack,
        wallet: walletAddress,
        trades: [],
      };
      setCache(cacheKey, emptyData);
      return { success: true, data: emptyData };
    }

    const signatureStrings = recentSignatures.map((s) => s.signature);
    const trades: TradeData[] = [];
    let hadErrors = false;

    // Process in batches
    for (let i = 0; i < signatureStrings.length; i += BATCH_SIZE) {
      const batch = signatureStrings.slice(i, i + BATCH_SIZE);

      try {
        const parsedTxs = await withRetry(
          () => helius.parseTransactions({ transactions: batch }),
          `parseTransactions batch ${i / BATCH_SIZE + 1}`
        );

        for (const tx of parsedTxs) {
          const trade = extractTradeData(tx as ParsedTransaction, solPriceUsd);
          if (trade) {
            trades.push(trade);
          }
        }
      } catch (batchError) {
        if (DEBUG) console.error('[Vouch] Error processing batch:', batchError);
        hadErrors = true;
        // Continue with next batch
      }
    }

    // Sort by amount descending for better circuit input
    trades.sort((a, b) => b.amount - a.amount);

    // Calculate totals
    const totalVolume = trades.reduce((sum, t) => sum + t.amount, 0);
    const amounts = trades.map((t) => t.amount).slice(0, 20); // First 20 for circuit input

    debugLog(`Found ${trades.length} trades with total volume $${Math.round(totalVolume).toLocaleString()}`);

    const result: TradingVolumeData = {
      totalVolume: Math.round(totalVolume),
      tradeCount: trades.length,
      amounts,
      period: daysBack,
      wallet: walletAddress,
      trades: trades.slice(0, 10), // Return top 10 for UI display
    };

    setCache(cacheKey, result);

    return {
      success: true,
      data: result,
      partial: hadErrors,
    };
  } catch (error) {
    if (DEBUG) console.error('[Vouch] Error fetching trading volume:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch trading data',
    };
  }
}

// === Helper Functions ===

/**
 * Extract deployed program information from a parsed transaction
 */
function extractDeployedProgram(
  tx: ParsedTransaction,
  deployer: string
): { address: string; name?: string } | null {
  // Check if the transaction type indicates program deployment
  if (tx.type === 'UPGRADE_PROGRAM' || tx.type === 'DEPLOY_PROGRAM') {
    const programAccount = tx.accountData?.find(
      (acc) =>
        acc.account !== deployer &&
        !BPF_LOADER_PROGRAM_IDS.has(acc.account) &&
        acc.nativeBalanceChange &&
        acc.nativeBalanceChange > 0
    );

    if (programAccount) {
      return {
        address: programAccount.account,
        name: `Program ${programAccount.account.slice(0, 8)}...`,
      };
    }
  }

  // Check instructions for BPF loader interactions
  if (tx.instructions) {
    for (const ix of tx.instructions) {
      if (BPF_LOADER_PROGRAM_IDS.has(ix.programId)) {
        const programAddress = ix.accounts?.find(
          (acc) => acc !== deployer && !BPF_LOADER_PROGRAM_IDS.has(acc)
        );
        if (programAddress) {
          return {
            address: programAddress,
            name: `Program ${programAddress.slice(0, 8)}...`,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Extract trade data from a parsed transaction
 */
function extractTradeData(tx: ParsedTransaction, solPriceUsd: number): TradeData | null {
  // Check if this is a swap transaction
  const isSwap =
    tx.type === 'SWAP' ||
    tx.source === 'JUPITER' ||
    tx.source === 'RAYDIUM' ||
    tx.source === 'ORCA' ||
    tx.source === 'SERUM' ||
    tx.source === 'PHOENIX' ||
    tx.source === 'LIFINITY';

  if (!isSwap) return null;

  let amountUsd = 0;

  if (tx.events?.swap) {
    const swap = tx.events.swap;

    // Native SOL input/output
    if (swap.nativeInput?.amount) {
      const solAmount = Math.abs(swap.nativeInput.amount) / 1e9;
      amountUsd = solAmount * solPriceUsd;
    } else if (swap.nativeOutput?.amount) {
      const solAmount = Math.abs(swap.nativeOutput.amount) / 1e9;
      amountUsd = solAmount * solPriceUsd;
    }

    // Token inputs - check for stablecoins first (most accurate)
    if (amountUsd === 0 && swap.tokenInputs?.length) {
      for (const tokenInput of swap.tokenInputs) {
        const mint = tokenInput.mint || '';
        const stablecoinDecimals = STABLECOIN_MINTS[mint];

        if (stablecoinDecimals !== undefined && tokenInput.rawTokenAmount?.tokenAmount) {
          // Stablecoin - direct USD value
          const rawAmount = parseFloat(tokenInput.rawTokenAmount.tokenAmount);
          const decimals = tokenInput.rawTokenAmount.decimals ?? stablecoinDecimals;
          amountUsd = rawAmount / Math.pow(10, decimals);
          break;
        }
      }
    }

    // Token outputs - check for stablecoins
    if (amountUsd === 0 && swap.tokenOutputs?.length) {
      for (const tokenOutput of swap.tokenOutputs) {
        const mint = tokenOutput.mint || '';
        const stablecoinDecimals = STABLECOIN_MINTS[mint];

        if (stablecoinDecimals !== undefined && tokenOutput.rawTokenAmount?.tokenAmount) {
          const rawAmount = parseFloat(tokenOutput.rawTokenAmount.tokenAmount);
          const decimals = tokenOutput.rawTokenAmount.decimals ?? stablecoinDecimals;
          amountUsd = rawAmount / Math.pow(10, decimals);
          break;
        }
      }
    }
  }

  // Fallback to native transfers if no swap event data
  if (amountUsd === 0 && tx.nativeTransfers?.length) {
    // Take the largest transfer as the trade amount
    const maxTransfer = Math.max(...tx.nativeTransfers.map((t) => Math.abs(t.amount)));
    const solAmount = maxTransfer / 1e9;
    amountUsd = solAmount * solPriceUsd;
  }

  // Skip dust transactions
  if (amountUsd < DUST_THRESHOLD_SOL * solPriceUsd) return null;

  return {
    signature: tx.signature,
    amount: Math.round(amountUsd),
    timestamp: tx.timestamp,
    type: 'swap',
  };
}

/**
 * Estimate TVL for a deployed program
 */
async function estimateProgramTVL(helius: Helius, programId: string): Promise<number> {
  try {
    const solPriceUsd = await getSolPriceUsd();

    // Get program's token holdings via DAS API
    const assets = await withRetry(
      () =>
        helius.rpc.getAssetsByOwner({
          ownerAddress: programId,
          page: 1,
          limit: 100,
        }),
      `getAssetsByOwner ${programId.slice(0, 8)}`
    );

    let totalValue = 0;

    // Sum up token values from DAS API price info
    for (const asset of assets.items || []) {
      const priceInfo = (asset as { token_info?: { price_info?: { total_price?: number } } })
        .token_info?.price_info;
      if (priceInfo?.total_price) {
        totalValue += priceInfo.total_price;
      }
    }

    // Check SOL balance
    if (totalValue === 0) {
      try {
        const balance = await helius.connection.getBalance(new PublicKey(programId));
        totalValue = (balance / 1e9) * solPriceUsd;
      } catch {
        // Program account might not exist or have no SOL
      }
    }

    return Math.round(totalValue);
  } catch (error) {
    debugWarn(`Error estimating TVL for ${programId.slice(0, 8)}...:`, error);
    return 0;
  }
}

// === Mock Data ===

function getMockProgramData(wallet: string): ProgramData[] {
  return [
    {
      address: 'Prog1111111111111111111111111111111111111111',
      name: 'DeFi Protocol',
      deployedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      deployer: wallet,
      estimatedTVL: 50000,
    },
    {
      address: 'Prog2222222222222222222222222222222222222222',
      name: 'NFT Marketplace',
      deployedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      deployer: wallet,
      estimatedTVL: 40000,
    },
    {
      address: 'Prog3333333333333333333333333333333333333333',
      name: 'Gaming Platform',
      deployedAt: new Date(Date.now() - 30 * 86400000).toISOString(),
      deployer: wallet,
      estimatedTVL: 30000,
    },
  ];
}

function getMockTradingData(wallet: string, daysBack: number): TradingVolumeData {
  return {
    totalVolume: 75000,
    tradeCount: 42,
    amounts: [10000, 15000, 20000, 5000, 25000],
    period: daysBack,
    wallet,
  };
}
