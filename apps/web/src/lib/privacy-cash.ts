/**
 * Privacy Cash SDK Integration
 * Enables anonymous funding for Vouch Protocol burner wallets
 *
 * Privacy Cash is a Tornado Cash-style mixer for Solana that breaks
 * the on-chain link between deposit and withdrawal transactions.
 *
 * Flow:
 * 1. User deposits SOL to Privacy Cash pool
 * 2. Pool mixes funds with other users
 * 3. User withdraws to burner wallet (no on-chain link!)
 *
 * @see https://github.com/Privacy-Cash/privacy-cash-sdk
 * @see https://privacycash.co
 */

import { Keypair, Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import type { WalletContextState } from '@solana/wallet-adapter-react';

// SDK types based on actual SDK type definitions
interface PrivacyCashConfig {
  RPC_url: string;
  owner: string | number[] | Uint8Array | Keypair;
  enableDebug?: boolean;
}

interface DepositResult {
  tx: string;
}

interface WithdrawResult {
  isPartial: boolean;
  tx: string;
  recipient: string;
  amount_in_lamports: number;
  fee_in_lamports: number;
}

interface BalanceResult {
  lamports: number;
}

interface SPLDepositResult {
  tx: string;
}

interface SPLWithdrawResult {
  isPartial: boolean;
  tx: string;
  recipient: string;
  base_units: number;
  fee_base_units: number;
}

interface SPLBalanceResult {
  base_units: number;
  amount: number;
  lamports: number;
}

/**
 * Privacy Cash client interface matching the actual SDK
 */
interface PrivacyCashClient {
  deposit(options: { lamports: number }): Promise<DepositResult>;
  withdraw(options: { lamports: number; recipientAddress?: string; referrer?: string }): Promise<WithdrawResult>;
  getPrivateBalance(abortSignal?: AbortSignal): Promise<BalanceResult>;
  depositSPL(options: { base_units?: number; amount?: number; mintAddress: PublicKey | string }): Promise<SPLDepositResult>;
  withdrawSPL(options: { base_units?: number; amount?: number; mintAddress: PublicKey | string; recipientAddress?: string; referrer?: string }): Promise<SPLWithdrawResult>;
  getPrivateBalanceSpl(mintAddress: PublicKey | string): Promise<SPLBalanceResult>;
  clearCache(): Promise<PrivacyCashClient>;
  publicKey: PublicKey;
}

type PrivacyCashConstructor = new (config: PrivacyCashConfig) => PrivacyCashClient;

// Cached SDK module
let PrivacyCashClass: PrivacyCashConstructor | null = null;

/**
 * Dynamically import Privacy Cash SDK
 * Uses dynamic import to avoid SSR issues
 */
async function getPrivacyCashClass(): Promise<PrivacyCashConstructor> {
  if (PrivacyCashClass) return PrivacyCashClass;

  try {
    const sdk = await import('privacycash');
    PrivacyCashClass = sdk.PrivacyCash as unknown as PrivacyCashConstructor;

    if (!PrivacyCashClass) {
      throw new Error('PrivacyCash class not found in SDK');
    }

    return PrivacyCashClass;
  } catch (error) {
    console.error('[Privacy Cash] SDK not available:', error);
    throw new Error('Privacy Cash SDK not installed. Run: pnpm add privacycash');
  }
}

/**
 * Check if Privacy Cash SDK is available
 */
export async function isPrivacyCashAvailable(): Promise<boolean> {
  try {
    await getPrivacyCashClass();
    return true;
  } catch {
    return false;
  }
}

/**
 * Ephemeral Keypair Manager
 *
 * Privacy Cash SDK requires a private key, but wallet adapters don't expose it.
 * Solution: Generate ephemeral keypairs in browser for Privacy Cash operations.
 *
 * Flow:
 * 1. Generate ephemeral keypair
 * 2. User sends SOL to ephemeral (visible but to random address)
 * 3. Ephemeral uses Privacy Cash to fund burner
 * 4. Burner has no direct link to real wallet
 */
export interface EphemeralKeypair {
  keypair: Keypair;
  publicKey: string;
  secretKey: Uint8Array;
}

/**
 * Generate a new ephemeral keypair for Privacy Cash operations
 */
export function generateEphemeralKeypair(): EphemeralKeypair {
  const keypair = Keypair.generate();
  return {
    keypair,
    publicKey: keypair.publicKey.toBase58(),
    secretKey: keypair.secretKey,
  };
}

/**
 * Fund an ephemeral wallet from the user's main wallet
 * This is the one visible transaction (to a random address)
 */
export async function fundEphemeralWallet(
  connection: Connection,
  wallet: WalletContextState,
  ephemeralPublicKey: PublicKey,
  amountSol: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  const transaction = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: wallet.publicKey,
      toPubkey: ephemeralPublicKey,
      lamports,
    })
  );

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  transaction.recentBlockhash = blockhash;
  transaction.feePayer = wallet.publicKey;

  const signed = await wallet.signTransaction(transaction);
  const signature = await connection.sendRawTransaction(signed.serialize());

  await connection.confirmTransaction({
    signature,
    blockhash,
    lastValidBlockHeight,
  });

  console.log(`[Privacy Cash] Funded ephemeral wallet: ${signature}`);
  return signature;
}

/**
 * Create Privacy Cash client with ephemeral keypair
 */
export async function createPrivacyCashClient(
  rpcUrl: string,
  ephemeralKeypair: Keypair,
  enableDebug = false
): Promise<PrivacyCashClient> {
  const PrivacyCash = await getPrivacyCashClass();

  return new PrivacyCash({
    RPC_url: rpcUrl,
    owner: ephemeralKeypair.secretKey,
    enableDebug,
  });
}

/**
 * Deposit SOL to Privacy Cash pool
 */
export async function depositToPrivacyCash(
  client: PrivacyCashClient,
  amountSol: number
): Promise<string> {
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  console.log(`[Privacy Cash] Depositing ${amountSol} SOL to pool...`);
  const result = await client.deposit({ lamports });

  console.log(`[Privacy Cash] Deposit complete: ${result.tx}`);
  return result.tx;
}

/**
 * Withdraw SOL from Privacy Cash to any address (no link!)
 */
export async function withdrawFromPrivacyCash(
  client: PrivacyCashClient,
  amountSol: number,
  recipientAddress: string
): Promise<string> {
  const lamports = Math.floor(amountSol * LAMPORTS_PER_SOL);

  console.log(`[Privacy Cash] Withdrawing ${amountSol} SOL to ${recipientAddress.slice(0, 8)}...`);
  const result = await client.withdraw({
    lamports,
    recipientAddress,
  });

  console.log(`[Privacy Cash] Withdrawal complete: ${result.tx}`);
  return result.tx;
}

/**
 * Get private balance in Privacy Cash pool
 */
export async function getPrivateCashBalance(
  client: PrivacyCashClient
): Promise<number> {
  const result = await client.getPrivateBalance();
  return result.lamports / LAMPORTS_PER_SOL;
}

/**
 * Complete flow: Fund burner wallet anonymously via Privacy Cash
 *
 * This is the main function that orchestrates the entire flow:
 * 1. Generate ephemeral keypair
 * 2. Fund ephemeral from user wallet (visible but to random address)
 * 3. Deposit from ephemeral to Privacy Cash pool
 * 4. Withdraw from pool to burner wallet (NO LINK!)
 */
export interface PrivacyFundingOptions {
  connection: Connection;
  wallet: WalletContextState;
  burnerPublicKey: PublicKey;
  amountSol: number;
  rpcUrl: string;
  onProgress?: (step: string, message: string) => void;
}

export interface PrivacyFundingResult {
  success: boolean;
  ephemeralPublicKey: string;
  fundEphemeralTx?: string;
  depositTx?: string;
  withdrawTx?: string;
  error?: string;
}

export async function fundBurnerViaPrivacyCash(
  options: PrivacyFundingOptions
): Promise<PrivacyFundingResult> {
  const { connection, wallet, burnerPublicKey, amountSol, rpcUrl, onProgress } = options;

  const report = (step: string, message: string) => {
    console.log(`[Privacy Cash] ${step}: ${message}`);
    onProgress?.(step, message);
  };

  try {
    // Step 1: Generate ephemeral keypair
    report('generating', 'Creating ephemeral wallet...');
    const ephemeral = generateEphemeralKeypair();

    // Step 2: Fund ephemeral (add extra for fees)
    const fundAmount = amountSol + 0.01; // Extra for Privacy Cash fees
    report('funding', `Funding ephemeral wallet with ${fundAmount} SOL...`);
    const fundEphemeralTx = await fundEphemeralWallet(
      connection,
      wallet,
      ephemeral.keypair.publicKey,
      fundAmount
    );

    // Wait a bit for transaction to finalize
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Step 3: Create Privacy Cash client
    report('connecting', 'Connecting to Privacy Cash...');
    const client = await createPrivacyCashClient(
      rpcUrl,
      ephemeral.keypair,
      process.env.NODE_ENV === 'development'
    );

    // Step 4: Deposit to Privacy Cash pool
    report('depositing', 'Depositing to privacy pool...');
    const depositTx = await depositToPrivacyCash(client, amountSol);

    // Step 5: Withdraw to burner (NO LINK!)
    report('withdrawing', 'Withdrawing to burner wallet...');
    const withdrawTx = await withdrawFromPrivacyCash(
      client,
      amountSol - 0.005, // Subtract small amount for fees
      burnerPublicKey.toBase58()
    );

    report('complete', 'Burner wallet funded anonymously!');

    return {
      success: true,
      ephemeralPublicKey: ephemeral.publicKey,
      fundEphemeralTx,
      depositTx,
      withdrawTx,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    report('error', errorMessage);

    return {
      success: false,
      ephemeralPublicKey: '',
      error: errorMessage,
    };
  }
}

/**
 * Shield SOL for proof generation (simplified API for prove-flow.ts)
 * This creates an ephemeral keypair and deposits to Privacy Cash
 */
export async function shieldForProof(
  connection: Connection,
  wallet: WalletContextState,
  amountSol: number,
  rpcUrl?: string
): Promise<{ ephemeralKeypair: EphemeralKeypair; depositTx: string }> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const effectiveRpcUrl = rpcUrl || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  // Generate ephemeral keypair
  const ephemeral = generateEphemeralKeypair();

  // Fund ephemeral wallet
  const fundAmount = amountSol + 0.01; // Extra for fees
  await fundEphemeralWallet(
    connection,
    wallet,
    ephemeral.keypair.publicKey,
    fundAmount
  );

  // Wait for confirmation
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Create Privacy Cash client with ephemeral
  const client = await createPrivacyCashClient(
    effectiveRpcUrl,
    ephemeral.keypair,
    process.env.NODE_ENV === 'development'
  );

  // Deposit to Privacy Cash
  const depositTx = await depositToPrivacyCash(client, amountSol);

  return { ephemeralKeypair: ephemeral, depositTx };
}

/**
 * Withdraw privately to recipient (simplified API for prove-flow.ts)
 */
export async function withdrawPrivately(
  ephemeralKeypair: EphemeralKeypair,
  recipientAddress: string,
  amountSol: number,
  rpcUrl?: string
): Promise<string> {
  const effectiveRpcUrl = rpcUrl || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  // Create client with ephemeral keypair
  const client = await createPrivacyCashClient(
    effectiveRpcUrl,
    ephemeralKeypair.keypair,
    process.env.NODE_ENV === 'development'
  );

  // Withdraw to recipient
  const withdrawAmount = amountSol - 0.005; // Leave room for fees
  return withdrawFromPrivacyCash(client, withdrawAmount, recipientAddress);
}

/**
 * Get private balance helper
 */
export async function getPrivateBalance(
  ephemeralKeypair: EphemeralKeypair,
  rpcUrl?: string
): Promise<number> {
  const effectiveRpcUrl = rpcUrl || process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';

  const client = await createPrivacyCashClient(
    effectiveRpcUrl,
    ephemeralKeypair.keypair,
    false
  );

  return getPrivateCashBalance(client);
}

/**
 * SPL Token Operations
 */
export async function depositSPLToPrivacyCash(
  client: PrivacyCashClient,
  mintAddress: string,
  amount: number
): Promise<string> {
  console.log(`[Privacy Cash] Depositing ${amount} SPL tokens...`);
  const result = await client.depositSPL({ amount, mintAddress });
  console.log(`[Privacy Cash] SPL deposit complete: ${result.tx}`);
  return result.tx;
}

export async function withdrawSPLFromPrivacyCash(
  client: PrivacyCashClient,
  mintAddress: string,
  amount: number,
  recipientAddress: string
): Promise<string> {
  console.log(`[Privacy Cash] Withdrawing ${amount} SPL tokens...`);
  const result = await client.withdrawSPL({
    amount,
    mintAddress,
    recipientAddress,
  });
  console.log(`[Privacy Cash] SPL withdrawal complete: ${result.tx}`);
  return result.tx;
}

export async function getSPLPrivateBalance(
  client: PrivacyCashClient,
  mintAddress: string
): Promise<number> {
  const result = await client.getPrivateBalanceSpl(mintAddress);
  return result.amount;
}
