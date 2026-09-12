'use client';

import { useCallback, useState } from 'react';
import { usePublicClient, useWriteContract } from 'wagmi';

import { erc20Abi } from '@/lib/abi/erc20';
import type { ChainId } from '@/types/approval';

export type RevokeStatus = 'idle' | 'signing' | 'pending' | 'confirmed' | 'unverified' | 'error';

export interface RevokeTarget {
  id: string;
  tokenAddress: string;
  spenderAddress: string;
  /**
   * Chain the permission lives on. Pinned on the write, not inferred from the
   * wallet. Typed as the supported-chain union because that is the only value the
   * scan can produce: every approval comes from a chain Anchrion reads.
   */
  chainId: ChainId;
  /** The wallet that owns the permission, needed to re-read the allowance after. */
  owner: string;
}

export interface RevokeController {
  statuses: Record<string, RevokeStatus>;
  hashes: Record<string, string>;
  errors: Record<string, string>;
  batch: { done: number; total: number } | null;
  isBusy: boolean;
  revoke: (target: RevokeTarget) => Promise<void>;
  revokeMany: (targets: RevokeTarget[], onProgress?: () => void) => Promise<void>;
  reset: () => void;
}

/**
 * Revoking an ERC-20 permission is `approve(spender, 0)` on the token contract.
 *
 * The batch path runs strictly sequentially and waits for each receipt, because
 * firing several approvals at once against one nonce is how demos break.
 */
export function useRevoke(): RevokeController {
  const { mutateAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [statuses, setStatuses] = useState<Record<string, RevokeStatus>>({});
  const [hashes, setHashes] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [batch, setBatch] = useState<{ done: number; total: number } | null>(null);

  const setStatus = useCallback((id: string, status: RevokeStatus) => {
    setStatuses((current) => ({ ...current, [id]: status }));
  }, []);

  const revokeOne = useCallback(
    async (target: RevokeTarget) => {
      setErrors((current) => {
        const next = { ...current };
        delete next[target.id];
        return next;
      });
      setStatus(target.id, 'signing');
      try {
        const hash = await mutateAsync({
          address: target.tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'approve',
          args: [target.spenderAddress as `0x${string}`, BigInt(0)],
          /*
           * Pinned to the chain the permission was found on. Without this the write
           * goes to whatever network the wallet happens to be on, and the only thing
           * preventing a wrong-chain revoke is the UI disabling the button.
           */
          chainId: target.chainId as ChainId,
        });
        setHashes((current) => ({ ...current, [target.id]: hash }));
        setStatus(target.id, 'pending');

        if (!publicClient) {
          setStatus(target.id, 'confirmed');
          return;
        }

        const receipt = await publicClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== 'success') {
          throw new Error(`The revoke transaction reverted. Open ${hash} on the explorer.`);
        }

        /*
         * A confirmed approve(spender, 0) is not the same as a revoked permission, and
         * the difference is not theoretical: tokens with non-standard approval logic can
         * report success and leave the allowance standing. So the allowance is read back
         * from the token contract, and anything other than zero is reported as unverified
         * rather than shown as a green tick.
         */
        const remaining = await publicClient.readContract({
          address: target.tokenAddress as `0x${string}`,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [target.owner as `0x${string}`, target.spenderAddress as `0x${string}`],
        });
        if (remaining !== BigInt(0)) {
          setErrors((current) => ({
            ...current,
            [target.id]: `The transaction succeeded, but the token contract still reports an allowance of ${remaining.toString()}. This token does not implement approve(spender, 0) as expected, so the permission may still be live.`,
          }));
          setStatus(target.id, 'unverified');
          return;
        }

        setStatus(target.id, 'confirmed');
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Revoke failed';
        setErrors((current) => ({ ...current, [target.id]: message }));
        setStatus(target.id, 'error');
      }
    },
    [mutateAsync, publicClient, setStatus],
  );

  const revokeMany = useCallback(
    async (targets: RevokeTarget[], onProgress?: () => void) => {
      setBatch({ done: 0, total: targets.length });
      for (let index = 0; index < targets.length; index += 1) {
        await revokeOne(targets[index]);
        setBatch({ done: index + 1, total: targets.length });
        onProgress?.();
      }
    },
    [revokeOne],
  );

  const reset = useCallback(() => {
    setStatuses({});
    setHashes({});
    setErrors({});
    setBatch(null);
  }, []);

  const isBusy = batch !== null && batch.done < batch.total;

  return { statuses, hashes, errors, batch, isBusy, revoke: revokeOne, revokeMany, reset };
}
