'use client';

import { useState } from 'react';

import { SUPPORTED_CHAINS, type Approval, type RiskLevel } from '@/types/approval';
import type { RevokeStatus } from '@/lib/hooks/use-revoke';

const LEVEL_LABEL: Record<RiskLevel, string> = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
  safe: 'Safe',
};

const LEVEL_COLOR: Record<RiskLevel, string> = {
  critical: '#fca5a5',
  high: '#fdba74',
  medium: '#fde047',
  low: '#86efac',
  safe: '#86efac',
};

const LEVEL_BG: Record<RiskLevel, string> = {
  critical: 'rgba(239,68,68,0.12)',
  high: 'rgba(249,115,22,0.12)',
  medium: 'rgba(234,179,8,0.12)',
  low: 'rgba(34,197,94,0.12)',
  safe: 'rgba(34,197,94,0.12)',
};

function explorerBase(chainId: number): string {
  const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
  return chain?.blockExplorer ?? 'https://etherscan.io';
}

function short(address: string): string {
  return `${address.slice(0, 10)}…${address.slice(-6)}`;
}

/** Relative age in words, so no row ever reads "Deployed 0 days". */
function ago(seconds: number): string {
  const whole = Math.floor(seconds / 86_400);
  if (whole <= 0) return 'today';
  if (whole === 1) return '1 day ago';
  return `${whole} days ago`;
}

function Signal({
  label,
  value,
  unknownNote = 'not measured',
}: {
  label: string;
  value: string | null;
  unknownNote?: string;
}) {
  const measured = value !== null;
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <span style={{ color: 'var(--text-tertiary)' }}>{label}</span>
      <span style={{ color: measured ? 'var(--text-secondary)' : 'var(--text-tertiary)', fontStyle: measured ? 'normal' : 'italic' }}>
        {measured ? value : unknownNote}
      </span>
    </div>
  );
}

interface Props {
  approval: Approval;
  status: RevokeStatus;
  txHash?: string;
  error?: string;
  selected: boolean;
  /** False in read-only mode: the inspected address is not the connected wallet. */
  canRevoke: boolean;
  onToggleSelect: (id: string) => void;
  onRevoke: (approval: Approval) => void;
}

export function ApprovalRow({
  approval,
  status,
  txHash,
  error,
  selected,
  canRevoke,
  onToggleSelect,
  onRevoke,
}: Props) {
  const [open, setOpen] = useState(false);
  const level = approval.riskLevel;
  const borderColor =
    level === 'critical'
      ? 'rgba(239,68,68,0.25)'
      : level === 'high'
        ? 'rgba(249,115,22,0.2)'
        : level === 'medium'
          ? 'rgba(234,179,8,0.15)'
          : 'rgba(255,255,255,0.06)';
  const bgColor = level === 'critical' ? 'rgba(239,68,68,0.04)' : 'rgba(255,255,255,0.02)';

  const revoking = status === 'signing' || status === 'pending';
  const revoked = status === 'confirmed';
  /** The transaction landed but the allowance did not read zero afterwards. */
  const unverified = status === 'unverified';
  const base = explorerBase(approval.chainId);

  return (
    <div
      style={{
        borderRadius: 10,
        background: bgColor,
        border: `1px solid ${revoked ? 'rgba(34,197,94,0.25)' : borderColor}`,
        transition: 'border-color .2s',
        opacity: revoked ? 0.75 : 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 18px' }}>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect(approval.id)}
          aria-label={`Select ${approval.token.symbol} approval for batch revoke`}
          style={{ width: 15, height: 15, accentColor: 'var(--blue)', flexShrink: 0, cursor: 'pointer' }}
        />

        <div
          onClick={() => setOpen(!open)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flex: 1, cursor: 'pointer', minWidth: 0 }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                background: 'rgba(26,115,232,0.1)',
                color: 'var(--blue-light)',
                border: '1px solid rgba(26,115,232,0.15)',
                flexShrink: 0,
              }}
            >
              {approval.token.symbol.slice(0, 2)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {approval.token.name}
              </p>
              <p style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-tertiary)' }}>
                {approval.spenderLabel ?? 'Unrecognised contract'}{' '}
                <span style={{ fontFamily: 'monospace' }}>{short(approval.spenderAddress)}</span>
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 14, fontWeight: 600 }}>
                {approval.valueAtRiskUsd === null
                  ? 'No figure'
                  : `$${approval.valueAtRiskUsd.toLocaleString()}`}
                {approval.priceSource === 'static' && (
                  <span style={{ fontSize: 10, color: 'var(--text-tertiary)', marginLeft: 4 }}>est.</span>
                )}
              </p>
              <p style={{ fontSize: 12, color: approval.isUnlimited ? '#fca5a5' : 'var(--text-tertiary)' }}>
                {approval.isUnlimited ? 'Unlimited' : `${approval.allowanceFormatted} ${approval.token.symbol}`}
              </p>
            </div>
            <span
              style={{
                padding: '3px 12px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 600,
                background: LEVEL_BG[level],
                color: LEVEL_COLOR[level],
                whiteSpace: 'nowrap',
              }}
            >
              {LEVEL_LABEL[level]}
            </span>
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform .2s', color: 'var(--text-tertiary)' }}
            >
              <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
      </div>

      {open && (
        <div style={{ padding: '14px 18px 18px', borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.15)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                Why this scored {approval.riskScore}/100
              </h4>
              {approval.riskFactors.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  No risk factors fired. That means nothing in the model was measurable for this permission — not that it is safe.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {approval.riskFactors.map((factor) => (
                    <li key={factor.name} style={{ fontSize: 13 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ color: 'var(--text)', fontWeight: 500 }}>{factor.name}</span>
                        <span style={{ fontWeight: 600, color: factor.impact > 0 ? '#fca5a5' : '#86efac', whiteSpace: 'nowrap' }}>
                          {factor.impact > 0 ? '+' : ''}
                          {factor.impact}
                        </span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 2 }}>
                        {factor.description}{' '}
                        <span
                          style={{
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.05em',
                            color: factor.evidence === 'detected' ? 'var(--blue-light)' : 'var(--text-tertiary)',
                          }}
                        >
                          {factor.evidence}
                        </span>
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                What we measured
              </h4>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontSize: 13 }}>
                <Signal
                  label="Contract code"
                  value={
                    approval.signals.hasBytecode === null
                      ? null
                      : approval.signals.hasBytecode
                        ? 'deployed'
                        : 'no code at this address'
                  }
                />
                <Signal
                  label="Source verified"
                  value={
                    approval.signals.sourceVerified === null
                      ? null
                      : approval.signals.sourceVerified
                        ? 'yes'
                        : 'no — unverified'
                  }
                />
                <Signal label="Contract name" value={approval.signals.contractName} unknownNote="not published" />
                <Signal
                  label="Explorer scam flag"
                  value={
                    approval.signals.isScamFlag === null
                      ? null
                      : approval.signals.isScamFlag
                        ? 'flagged as scam'
                        : 'not flagged'
                  }
                  unknownNote="not reported"
                />
                <Signal
                  label="Deployed"
                  value={
                    approval.signals.contractAgeDays === null
                      ? null
                      : ago(approval.signals.contractAgeDays * 86_400)
                  }
                />
                <Signal
                  label="Deployer"
                  value={
                    approval.signals.creatorAddress ? short(approval.signals.creatorAddress) : null
                  }
                />
                <Signal
                  label="Token last moved"
                  value={
                    approval.signals.lastTokenActivityDays === null
                      ? null
                      : ago(approval.signals.lastTokenActivityDays * 86_400)
                  }
                />
                <Signal
                  label="Found via"
                  value={
                    approval.discoverySource === 'approve-call'
                      ? 'approve() in transaction history'
                      : approval.discoverySource === 'approval-log'
                        ? 'Approval event on the token'
                        : 'live allowance read only'
                  }
                />
                <Signal
                  label="Anchrion first saw this"
                  value={
                    approval.firstSeenByAnchrion
                      ? new Date(approval.firstSeenByAnchrion).toLocaleDateString()
                      : null
                  }
                  unknownNote="first scan"
                />
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Approved</span>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {approval.approvedAt ? new Date(approval.approvedAt).toLocaleDateString() : 'date unknown'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => onRevoke(approval)}
              disabled={!canRevoke || revoking || revoked}
              title={canRevoke ? undefined : 'Connect the wallet that owns this address to revoke'}
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: canRevoke ? 'white' : 'var(--text-secondary)',
                background: !canRevoke
                  ? 'rgba(255,255,255,0.06)'
                  : revoked
                    ? 'var(--risk-safe)'
                    : revoking
                      ? 'rgba(239,68,68,0.6)'
                      : 'var(--risk-critical)',
                opacity: unverified ? 0.75 : 1,
                border: !canRevoke ? '1px solid rgba(255,255,255,0.08)' : 'none',
                cursor: !canRevoke || revoking || revoked ? 'default' : 'pointer',
                transition: 'opacity .2s',
              }}
            >
              {!canRevoke
                ? 'Connect wallet to revoke'
                : revoked
                  ? 'Revoked'
                  : unverified
                    ? 'Still allowed — check'
                    : status === 'signing'
                      ? 'Confirm in your wallet…'
                      : status === 'pending'
                        ? 'Confirming on chain…'
                        : 'Revoke permission'}
            </button>

            {txHash && (
              <a
                href={`${base}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, color: 'var(--blue-light)' }}
              >
                View transaction ↗
              </a>
            )}

            <a
              href={`${base}/token/${approval.token.address}?a=${approval.spenderAddress}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '9px 18px',
                borderRadius: 8,
                fontSize: 13,
                color: 'var(--text-secondary)',
                border: '1px solid rgba(255,255,255,0.08)',
                textDecoration: 'none',
              }}
            >
              View on explorer
            </a>

            {error && (
              <span style={{ fontSize: 12, color: '#fca5a5', maxWidth: 340 }}>
                {error.includes('User rejected') || error.includes('denied')
                  ? 'You rejected the transaction in your wallet.'
                  : error}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
