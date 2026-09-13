'use client';

import { SUPPORTED_CHAINS, type Approval, type Incident } from '@/types/approval';
import type { RevokeStatus } from '@/lib/hooks/use-revoke';

function explorerBase(chainId: number): string {
  const chain = SUPPORTED_CHAINS[chainId as keyof typeof SUPPORTED_CHAINS];
  return chain?.blockExplorer ?? 'https://etherscan.io';
}

function short(address: string): string {
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
}

interface Props {
  incident: Incident;
  loading: boolean;
  error: string | null;
  onRun: () => void;
  onRevoke: (approval: Approval) => void;
  statuses: Record<string, RevokeStatus>;
  hashes: Record<string, string>;
  /** False in read-only mode: the address is not the connected wallet. */
  canRevoke: boolean;
  onRevokeFamily: () => void;
  batch: { done: number; total: number } | null;
}

export function IncidentPanel({
  incident,
  loading,
  error,
  onRun,
  onRevoke,
  statuses,
  hashes,
  canRevoke,
  onRevokeFamily,
  batch,
}: Props) {
  const base = explorerBase(incident.chainId);
  const family = incident.familyApprovals;
  const revocable = canRevoke
    ? family.filter((approval) => statuses[approval.id] !== 'confirmed')
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div
        style={{
          padding: '18px 20px',
          borderRadius: 10,
          background: 'rgba(255,255,255,0.02)',
          border: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div style={{ maxWidth: 640 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400, marginBottom: 6 }}>
              Incident reconstruction
            </h3>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              Preventive tools tell you what you are about to sign. This reads what already happened: which
              transaction moved funds out of this wallet, which permission authorised it, and what the same
              attacker can still reach. Every line is a public transaction you can open yourself.
            </p>
          </div>
          <button
            onClick={onRun}
            disabled={loading}
            style={{
              padding: '10px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: 'white',
              background: 'var(--blue)',
              border: 'none',
              cursor: loading ? 'wait' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {loading ? 'Reconstructing…' : 'Run reconstruction'}
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '14px 18px', borderRadius: 10, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 13, color: '#fca5a5' }}>
          {error}
        </div>
      )}

      {incident.narrative.length > 0 && (
        <div
          style={{
            padding: '18px 20px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
            What happened
          </h4>
          <ol style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {incident.narrative.map((line, index) => (
              <li key={index} style={{ display: 'flex', gap: 12, fontSize: 14, lineHeight: 1.6 }}>
                <span style={{ color: 'var(--blue-light)', fontFamily: 'monospace', fontSize: 12, paddingTop: 3 }}>
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span style={{ color: 'var(--text-secondary)' }}>{line}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {incident.transfers.length > 0 && (
        <div
          style={{
            padding: '18px 20px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
            Funds that left in transactions you did not submit
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {incident.transfers.map((transfer) => (
              <div
                key={transfer.txHash}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 16,
                  flexWrap: 'wrap',
                  padding: '12px 14px',
                  borderRadius: 8,
                  background: 'rgba(239,68,68,0.04)',
                  border: '1px solid rgba(239,68,68,0.15)',
                }}
              >
                <div style={{ fontSize: 13 }}>
                  <p style={{ fontWeight: 600 }}>
                    {transfer.amountFormatted} {transfer.token.symbol}
                    <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                      {' '}≈ ${transfer.valueAtRiskUsd.toLocaleString()}
                    </span>
                  </p>
                  <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 3 }}>
                    initiated by <span style={{ fontFamily: 'monospace' }}>{short(transfer.initiatedBy)}</span> →
                    recipient <span style={{ fontFamily: 'monospace' }}>{short(transfer.recipient)}</span>
                    {transfer.timestamp ? ` · ${new Date(transfer.timestamp).toLocaleString()}` : ''}
                  </p>
                  {/*
                    * Whether the submitting address still holds a permission here is the
                    * difference between a spent approval and a relayed transaction, so it
                    * is stated on the row instead of left to the narrative.
                    */}
                  <p style={{ fontSize: 12, marginTop: 4, color: transfer.authorizedByLivePermission ? '#fbbf24' : 'var(--text-tertiary)' }}>
                    {transfer.authorizedByLivePermission
                      ? 'This address still holds a live permission on this wallet'
                      : 'No live permission from this address. Either a permit signature, or a relayed transaction you signed'}
                  </p>
                </div>
                <a
                  href={`${base}/tx/${transfer.txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: 12, color: 'var(--blue-light)', whiteSpace: 'nowrap' }}
                >
                  Verify on explorer ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {family.length > 0 && (
        <div
          style={{
            padding: '18px 20px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <h4 style={{ fontSize: 11, fontWeight: 600, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-tertiary)' }}>
                Still reachable by this family
              </h4>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                {family.length} permission{family.length === 1 ? '' : 's'} ·{' '}
                {incident.unboundedApprovalCount > 0
                  ? `${incident.unboundedApprovalCount} unlimited`
                  : `estimated $${incident.stillExposedUsd.toLocaleString()} exposed`}
                {incident.unboundedApprovalCount > 0 && incident.stillExposedUsd > 0
                  ? ` · estimated $${incident.stillExposedUsd.toLocaleString()} capped`
                  : ''}
              </p>
            </div>
            <button
              onClick={onRevokeFamily}
              disabled={!canRevoke || revocable.length === 0 || (batch !== null && batch.done < batch.total)}
              title={canRevoke ? undefined : 'Connect the wallet that owns this address to revoke'}
              style={{
                padding: '10px 18px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 600,
                color: 'white',
                background: !canRevoke
                  ? 'rgba(255,255,255,0.08)'
                  : revocable.length === 0
                    ? 'rgba(34,197,94,0.5)'
                    : 'var(--risk-critical)',
                border: 'none',
                cursor: !canRevoke || revocable.length === 0 ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              {!canRevoke
                ? 'Connect wallet to revoke'
                : revocable.length === 0
                  ? 'All revoked'
                  : batch && batch.done < batch.total
                    ? `Revoking ${batch.done + 1} of ${batch.total}…`
                    : `Revoke all ${revocable.length}`}
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {family.map((approval) => {
              const status = statuses[approval.id] ?? 'idle';
              const done = status === 'confirmed';
              return (
                <div
                  key={approval.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 16,
                    flexWrap: 'wrap',
                    padding: '10px 14px',
                    borderRadius: 8,
                    background: 'rgba(0,0,0,0.15)',
                    border: `1px solid ${done ? 'rgba(34,197,94,0.25)' : 'rgba(255,255,255,0.06)'}`,
                  }}
                >
                  <div style={{ fontSize: 13 }}>
                    <p style={{ fontWeight: 600 }}>
                      {approval.isUnlimited ? 'Unlimited' : `${approval.allowanceFormatted}`} {approval.token.symbol}
                      <span style={{ color: 'var(--text-tertiary)', fontWeight: 400 }}>
                        {' '}→ {approval.spenderLabel ?? short(approval.spenderAddress)} · risk {approval.riskScore}/100
                      </span>
                    </p>
                    {approval.signals.creatorAddress && (
                      <p style={{ color: 'var(--text-tertiary)', fontSize: 12, marginTop: 3 }}>
                        same deployer {short(approval.signals.creatorAddress)}
                      </p>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {hashes[approval.id] && (
                      <a
                        href={`${base}/tx/${hashes[approval.id]}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: 'var(--blue-light)' }}
                      >
                        View transaction ↗
                      </a>
                    )}
                    <button
                      onClick={() => onRevoke(approval)}
                      disabled={!canRevoke || done || status === 'signing' || status === 'pending'}
                      title={canRevoke ? undefined : 'Connect the wallet that owns this address to revoke'}
                      style={{
                        padding: '7px 14px',
                        borderRadius: 7,
                        fontSize: 12,
                        fontWeight: 600,
                        color: !canRevoke ? 'var(--text-secondary)' : done ? '#86efac' : 'white',
                        background: !canRevoke
                          ? 'rgba(255,255,255,0.06)'
                          : done
                            ? 'rgba(34,197,94,0.15)'
                            : 'rgba(239,68,68,0.85)',
                        border: 'none',
                        cursor: !canRevoke || done ? 'default' : 'pointer',
                      }}
                    >
                      {!canRevoke
                        ? 'Connect wallet to revoke'
                        : done
                          ? 'Revoked'
                          : status === 'signing'
                            ? 'Confirm in wallet…'
                            : status === 'pending'
                              ? 'Confirming…'
                              : 'Revoke'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {incident.coverage.notes.length > 0 && (
        <div
          style={{
            padding: '14px 18px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.02)',
            border: '1px dashed rgba(255,255,255,0.1)',
            fontSize: 12,
            color: 'var(--text-tertiary)',
            lineHeight: 1.6,
          }}
        >
          <strong style={{ color: 'var(--text-secondary)' }}>Coverage limits for this reconstruction</strong>
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {incident.coverage.notes.map((note, index) => (
              <li key={index}>{note}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
