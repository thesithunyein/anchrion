import { NextResponse } from 'next/server';

import { reconstructIncident } from '@/lib/incident/reconstruct';
import { isSupportedChainId } from '@/types/approval';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      walletAddress?: string;
      chainId?: number;
      txHash?: string;
    };
    const walletAddress = (body.walletAddress ?? '').toLowerCase();
    const chainId = Number(body.chainId);
    const txHash =
      typeof body.txHash === 'string' && /^0x[0-9a-fA-F]{64}$/.test(body.txHash)
        ? body.txHash
        : undefined;

    if (!/^0x[0-9a-f]{40}$/.test(walletAddress)) {
      return NextResponse.json({ error: 'A valid wallet address is required.' }, { status: 400 });
    }
    if (!isSupportedChainId(chainId)) {
      return NextResponse.json(
        { error: `Unsupported chain ${chainId}. Switch to a supported network.` },
        { status: 400 },
      );
    }

    const incident = await reconstructIncident(chainId, walletAddress, txHash);
    return NextResponse.json({ incident });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to reconstruct incident';
    console.error('Incident API error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
