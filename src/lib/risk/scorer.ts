/**
 * Anchrion risk model.
 *
 * This is a transparent, published scoring model — not a trained model and not a
 * third-party threat feed. Weights are documented in README.md so anyone can
 * recompute a score by hand and disagree with it in the open.
 *
 * Honesty rules baked in here:
 *   1. A signal that was not measured contributes no score and produces no factor.
 *      Unknown is never rendered as safe, and never inflates a score either.
 *   2. Every factor is tagged 'detected' (read from chain or explorer) or
 *      'estimated' (derived from a heuristic). The UI shows the difference.
 *   3. There is no bundled "known malicious" list. Anchrion has no threat feed,
 *      and pretending otherwise would be the most dangerous thing in this file.
 */

import type { Approval, RiskFactor, RiskLevel } from '@/types/approval';

/** Protocols users deliberately approve. Recognised labels reduce score. */
const KNOWN_PROTOCOLS = [
  'uniswap',
  'aave',
  'compound',
  'maker',
  'curve',
  'sushiswap',
  'pancakeswap',
  '1inch',
  'lido',
  'rocket pool',
  'coinbase',
  'metamask',
  'binance',
  'kraken',
  '0x exchange',
  'paraswap',
  'balancer',
  'yearn',
];

/**
 * Optional operator-supplied threat list, comma separated addresses.
 * Empty by default and intentionally so: Anchrion ships no threat intel of its
 * own, and will not imply that it has any.
 */
function threatList(): Set<string> {
  const raw = process.env.NEXT_PUBLIC_THREAT_LIST ?? '';
  return new Set(
    raw
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter((entry) => /^0x[0-9a-f]{40}$/.test(entry)),
  );
}

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  factors: RiskFactor[];
}

export function calculateRiskScore(approval: Approval): RiskAssessment {
  let score = 0;
  const factors: RiskFactor[] = [];

  const add = (factor: RiskFactor) => {
    score += factor.impact;
    factors.push(factor);
  };

  // Detected: unlimited spending permission.
  if (approval.isUnlimited) {
    add({
      name: 'Unlimited spending',
      description:
        'This permission has no cap. If the spender is ever compromised or malicious, every token of this type can be moved.',
      impact: 30,
      severity: 'high',
      evidence: 'detected',
    });
  } else if (Number(approval.allowanceFormatted) > 1_000_000) {
    add({
      name: 'Very high limit',
      description: 'This permission allows spending more than one million tokens.',
      impact: 20,
      severity: 'medium',
      evidence: 'detected',
    });
  }

  // Detected: the spender has no bytecode at all (EOA, or a self-destructed contract).
  if (approval.signals.hasBytecode === false) {
    add({
      name: 'Spender has no contract code',
      description:
        'This address has no deployed code. It is an externally-owned account or a contract that no longer exists — a permission here is not a normal protocol permission.',
      impact: 40,
      severity: 'critical',
      evidence: 'detected',
    });
  }

  // Detected: the explorer's own public reputation flag marks this address as a scam.
  if (approval.signals.isScamFlag === true) {
    add({
      name: 'Flagged as a scam address',
      description:
        'The block explorer publicly flags this address as a scam. Anchrion did not decide this — it is the explorer\u2019s own published reputation flag.',
      impact: 45,
      severity: 'critical',
      evidence: 'detected',
    });
  }

  // Detected: source not verified on the explorer.
  if (approval.signals.sourceVerified === false) {
    add({
      name: 'Unverified contract source',
      description:
        'The explorer has no verified source code for this contract, so nobody outside the deployer can confirm what it does with your tokens.',
      impact: 20,
      severity: 'high',
      evidence: 'detected',
    });
  }

  // Detected: contract age.
  const age = approval.signals.contractAgeDays;
  if (age !== null) {
    if (age < 7) {
      add({
        name: 'Very new contract',
        description: `Deployed ${Math.max(0, Math.floor(age))} day(s) ago. A newly deployed spender with an unlimited permission has had no time to build a track record.`,
        impact: 25,
        severity: 'high',
        evidence: 'detected',
      });
    } else if (age < 30) {
      add({
        name: 'Recent contract',
        description: `Deployed ${Math.floor(age)} days ago.`,
        impact: 15,
        severity: 'medium',
        evidence: 'detected',
      });
    } else if (age < 90) {
      add({
        name: 'Somewhat new contract',
        description: `Deployed ${Math.floor(age)} days ago.`,
        impact: 5,
        severity: 'low',
        evidence: 'detected',
      });
    }
  }

  // Detected: operator-supplied threat list only.
  if (threatList().has(approval.spenderAddress.toLowerCase())) {
    add({
      name: 'On your threat list',
      description:
        'This address is on the threat list you configured via NEXT_PUBLIC_THREAT_LIST.',
      impact: 50,
      severity: 'critical',
      evidence: 'detected',
    });
  }

  /*
   * Estimated: value at risk, for capped permissions only.
   *
   * An unlimited permission has no dollar figure — the placeholder used in the UI
   * (10,000 units at the current price) is not a measurement, and adding a factor
   * derived from it would put invented precision into a security score. Unlimited
   * is already scored as unlimited, above.
   */
  if (!approval.isUnlimited) {
    if (approval.valueAtRiskUsd >= 10_000) {
      add({
        name: 'High value at risk',
        description: `About $${Math.round(
          approval.valueAtRiskUsd,
        ).toLocaleString()} of this token is reachable through this permission (estimated at ${
          approval.priceSource === 'live' ? 'live' : 'static snapshot'
        } prices).`,
        impact: 15,
        severity: 'high',
        evidence: 'estimated',
      });
    } else if (approval.valueAtRiskUsd >= 1_000) {
      add({
        name: 'Moderate value at risk',
        description: `About $${Math.round(
          approval.valueAtRiskUsd,
        ).toLocaleString()} is reachable through this permission (estimated at ${
          approval.priceSource === 'live' ? 'live' : 'static snapshot'
        } prices).`,
        impact: 10,
        severity: 'medium',
        evidence: 'estimated',
      });
    }
  }

  // Estimated: dormant unlimited permission.
  const idleDays = approval.signals.lastTokenActivityDays;
  if (approval.isUnlimited && idleDays !== null && idleDays > 365) {
    add({
      name: 'Dormant unlimited permission',
      description: `This token has not moved for this wallet in ${Math.floor(
        idleDays,
      )} days, yet the permission is still live. Dormant permissions are the ones people forget.`,
      impact: 10,
      severity: 'low',
      evidence: 'estimated',
    });
  }

  /*
   * Detected: a recognised protocol label lowers the score — but only when the
   * label came from the bundled, address-verified list.
   *
   * Matching a substring against whatever name the explorer reports would hand a
   * 20-point discount to any contract that registers itself as "Uniswap Helper".
   * That is attacker-controlled input feeding a security score, so it does not
   * count here, and an unrecognised address simply gets no discount.
   */
  const label = (approval.spenderLabel ?? '').toLowerCase();
  if (
    approval.signals.spenderLabelSource === 'bundled' &&
    label !== '' &&
    KNOWN_PROTOCOLS.some((protocol) => label.includes(protocol))
  ) {
    add({
      name: 'Recognised protocol',
      description: `${approval.spenderLabel} is on Anchrion's bundled protocol allowlist, matched by contract address rather than by name.`,
      impact: -20,
      severity: 'low',
      evidence: 'detected',
    });
  }

  score = Math.max(0, Math.min(100, score));

  let level: RiskLevel = 'safe';
  if (score >= 70) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 30) level = 'medium';
  else if (score >= 10) level = 'low';

  return { score, level, factors };
}

export function getRiskColor(level: RiskLevel): string {
  const colors: Record<RiskLevel, string> = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
    safe: 'badge-safe',
  };
  return colors[level];
}

export function getRiskLabel(level: RiskLevel): string {
  const labels: Record<RiskLevel, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    safe: 'Safe',
  };
  return labels[level];
}

export function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 70) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 30) return 'medium';
  if (score >= 10) return 'low';
  return 'safe';
}
