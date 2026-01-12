'use server';

import { z } from 'zod';
import type { ProgramData, TradingVolumeData } from '@/lib/types';

const walletSchema = z.string().min(32).max(44);

export async function getDeployedPrograms(walletAddress: string): Promise<{
  success: boolean;
  data?: ProgramData[];
  error?: string;
}> {
  try {
    walletSchema.parse(walletAddress);
    const apiKey = process.env.HELIUS_API_KEY;

    if (!apiKey) {
      console.warn('[Vouch] HELIUS_API_KEY not set - using mock data');
      return { success: true, data: getMockProgramData(walletAddress) };
    }

    // TODO: Implement actual Helius API call
    // const helius = new Helius(apiKey);
    // const programs = await helius.rpc.getAssetsByOwner({ ... });
    return { success: true, data: getMockProgramData(walletAddress) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch programs',
    };
  }
}

export async function getTradingVolume(
  walletAddress: string,
  daysBack: number = 30
): Promise<{ success: boolean; data?: TradingVolumeData; error?: string }> {
  try {
    walletSchema.parse(walletAddress);
    const apiKey = process.env.HELIUS_API_KEY;

    if (!apiKey) {
      console.warn('[Vouch] HELIUS_API_KEY not set - using mock data');
      return { success: true, data: getMockTradingData(walletAddress, daysBack) };
    }

    // TODO: Implement actual Helius API call
    return { success: true, data: getMockTradingData(walletAddress, daysBack) };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch trading data',
    };
  }
}

function getMockProgramData(wallet: string): ProgramData[] {
  return [
    {
      address: 'Prog1111111111111111111111111111111111111111',
      deployedAt: new Date(Date.now() - 90 * 86400000).toISOString(),
      deployer: wallet,
      estimatedTVL: 50000,
    },
    {
      address: 'Prog2222222222222222222222222222222222222222',
      deployedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      deployer: wallet,
      estimatedTVL: 40000,
    },
    {
      address: 'Prog3333333333333333333333333333333333333333',
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
