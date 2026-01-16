/**
 * Privacy Cash SDK Integration
 * Enables private credential funding for Vouch Protocol
 *
 * Privacy Cash allows users to:
 * 1. Shield SOL before proof generation (hide funding source)
 * 2. Withdraw privately after verification (break link to original wallet)
 *
 * @see https://github.com/Privacy-Cash/privacy-cash-sdk
 */

import type { WalletContextState } from '@solana/wallet-adapter-react';

/**
 * Privacy Cash SDK types (based on SDK documentation)
 */
interface PrivacyCashClient {
  deposit(wallet: WalletContextState, amount: number): Promise<string>;
  withdraw(
    wallet: WalletContextState,
    recipient: string,
    amount?: number
  ): Promise<string>;
  getPrivateBalance(wallet: WalletContextState): Promise<number>;
  depositSPL(
    wallet: WalletContextState,
    tokenMint: string,
    amount: number
  ): Promise<string>;
  withdrawSPL(
    wallet: WalletContextState,
    tokenMint: string,
    recipient: string,
    amount?: number
  ): Promise<string>;
}

// SDK client singleton
let privacyCashInstance: PrivacyCashClient | null = null;

/**
 * Initialize Privacy Cash SDK
 * Lazy loads the SDK to avoid import issues on server
 */
async function getPrivacyCashClient(): Promise<PrivacyCashClient> {
  if (privacyCashInstance) return privacyCashInstance;

  try {
    // Dynamic import to avoid SSR issues
    // @ts-expect-error - SDK may not have types
    const sdk = await import('privacy-cash-sdk');
    const PrivacyCash = sdk.PrivacyCash || sdk.default?.PrivacyCash || sdk.default;
    if (!PrivacyCash) {
      throw new Error('PrivacyCash class not found in SDK');
    }
    privacyCashInstance = new PrivacyCash() as PrivacyCashClient;
    return privacyCashInstance;
  } catch (error) {
    console.error('[Privacy Cash] SDK not available:', error);
    throw new Error(
      'Privacy Cash SDK not installed. Run: pnpm add privacy-cash-sdk'
    );
  }
}

/**
 * Shield SOL before proof generation for extra privacy
 * User deposits SOL into Privacy Cash pool, breaking the link to their wallet
 *
 * @param wallet - Connected wallet adapter
 * @param amountSol - Amount of SOL to shield
 * @returns Transaction signature
 */
export async function shieldForProof(
  wallet: WalletContextState,
  amountSol: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  if (amountSol <= 0) {
    throw new Error('Amount must be positive');
  }

  console.log(`[Privacy Cash] Shielding ${amountSol} SOL...`);

  const client = await getPrivacyCashClient();
  const txSignature = await client.deposit(wallet, amountSol);

  console.log(`[Privacy Cash] Shield complete: ${txSignature}`);
  return txSignature;
}

/**
 * Withdraw privately after credential verification
 * Funds sent to burner/recipient wallet with no on-chain link to original wallet
 *
 * @param wallet - Connected wallet adapter (must have shielded balance)
 * @param recipientAddress - Destination address (typically a burner wallet)
 * @param amountSol - Amount to withdraw (optional, defaults to full balance)
 * @returns Transaction signature
 */
export async function withdrawPrivately(
  wallet: WalletContextState,
  recipientAddress: string,
  amountSol?: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  if (!recipientAddress || recipientAddress.length < 32) {
    throw new Error('Invalid recipient address');
  }

  console.log(
    `[Privacy Cash] Private withdrawal to ${recipientAddress.slice(0, 8)}...`
  );

  const client = await getPrivacyCashClient();
  const txSignature = await client.withdraw(wallet, recipientAddress, amountSol);

  console.log(`[Privacy Cash] Withdrawal complete: ${txSignature}`);
  return txSignature;
}

/**
 * Get private balance (hidden from chain observers)
 *
 * @param wallet - Connected wallet adapter
 * @returns Shielded SOL balance
 */
export async function getPrivateBalance(
  wallet: WalletContextState
): Promise<number> {
  if (!wallet.publicKey) {
    return 0;
  }

  try {
    const client = await getPrivacyCashClient();
    return await client.getPrivateBalance(wallet);
  } catch {
    return 0;
  }
}

/**
 * Shield SPL tokens (USDC, USDT, etc.)
 *
 * @param wallet - Connected wallet adapter
 * @param tokenMint - SPL token mint address
 * @param amount - Amount to shield (in token units)
 * @returns Transaction signature
 */
export async function shieldSPL(
  wallet: WalletContextState,
  tokenMint: string,
  amount: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  if (!tokenMint || tokenMint.length < 32) {
    throw new Error('Invalid token mint address');
  }

  const client = await getPrivacyCashClient();
  return await client.depositSPL(wallet, tokenMint, amount);
}

/**
 * Withdraw SPL tokens privately
 *
 * @param wallet - Connected wallet adapter
 * @param tokenMint - SPL token mint address
 * @param recipientAddress - Destination address
 * @param amount - Amount to withdraw (optional, defaults to full balance)
 * @returns Transaction signature
 */
export async function withdrawSPLPrivately(
  wallet: WalletContextState,
  tokenMint: string,
  recipientAddress: string,
  amount?: number
): Promise<string> {
  if (!wallet.publicKey || !wallet.signTransaction) {
    throw new Error('Wallet not connected');
  }

  const client = await getPrivacyCashClient();
  return await client.withdrawSPL(wallet, tokenMint, recipientAddress, amount);
}

/**
 * Check if Privacy Cash SDK is available
 * Useful for conditional UI rendering
 */
export async function isPrivacyCashAvailable(): Promise<boolean> {
  try {
    await getPrivacyCashClient();
    return true;
  } catch {
    return false;
  }
}

/**
 * Privacy Cash proof flow helper
 * Combines shield -> proof -> withdraw into a unified flow
 */
export interface PrivacyProofFlowOptions {
  wallet: WalletContextState;
  burnerWallet: string;
  amountSol: number;
  onShieldComplete?: (txSignature: string) => void;
  onWithdrawComplete?: (txSignature: string) => void;
}

export async function executePrivacyFlow(
  options: PrivacyProofFlowOptions
): Promise<{
  shieldTx: string;
  withdrawTx: string;
}> {
  const { wallet, burnerWallet, amountSol, onShieldComplete, onWithdrawComplete } =
    options;

  // Step 1: Shield SOL
  const shieldTx = await shieldForProof(wallet, amountSol);
  onShieldComplete?.(shieldTx);

  // Step 2: Withdraw privately to burner
  const withdrawTx = await withdrawPrivately(wallet, burnerWallet, amountSol);
  onWithdrawComplete?.(withdrawTx);

  return { shieldTx, withdrawTx };
}
