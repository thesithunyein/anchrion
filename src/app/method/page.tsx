import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Anchrion — risk model and limits',
  description:
    'The published Anchrion scoring model: every weight, every signal, and everything Anchrion cannot detect.',
};

interface Weight {
  name: string;
  points: string;
  evidence: 'detected' | 'estimated';
  why: string;
}

const WEIGHTS: Weight[] = [
  {
    name: 'Unlimited spending permission',
    points: '+30',
    evidence: 'detected',
    why: 'Read from the token contract: allowance is at or above 2^255. No cap means the whole balance of that token is reachable.',
  },
  {
    name: 'Allowance above one million tokens',
    points: '+20',
    evidence: 'detected',
    why: 'A cap exists, but it is larger than one million units of the token. Capped does not mean small.',
  },
  {
    name: 'Spender has no contract code',
    points: '+40',
    evidence: 'detected',
    why: '`eth_getCode` returned nothing. The spender is an externally-owned account or a self-destructed contract. A permission granted to a non-contract is not a normal protocol permission.',
  },
  {
    name: 'Explorer flags the address as a scam',
    points: '+45',
    evidence: 'detected',
    why: 'The block explorer publishes its own scam flag for this address. Anchrion is not the source: it ships no threat intel, it only reads the flag the explorer already shows. Where the explorer reports nothing, this weight adds nothing and the UI says not reported.',
  },
  {
    name: 'Unverified contract source',
    points: '+20',
    evidence: 'detected',
    why: 'The explorer holds no verified source for the spender, so nobody outside the deployer can confirm what it does with the permission.',
  },
  {
    name: 'Contract deployed less than 7 / 30 / 90 days ago',
    points: '+25 / +15 / +5',
    evidence: 'detected',
    why: 'Deployment age comes from the creation transaction. New contracts have no track record.',
  },
  {
    name: 'Address on your own threat list',
    points: '+50',
    evidence: 'detected',
    why: 'Only fires for addresses you supply through NEXT_PUBLIC_THREAT_LIST. Anchrion ships no threat feed of its own.',
  },
  {
    name: 'Capped value at risk of at least $10k / $1k',
    points: '+15 / +10',
    evidence: 'estimated',
    why: 'What the permission can actually move — the smaller of its allowance and this wallet\u2019s live token balance — multiplied by a USD price. Price is live when reachable, otherwise a dated static snapshot, and the value is labelled an estimate either way. An unlimited permission is not scored on a dollar figure: unlimited is already scored above, and its reachable amount is today\u2019s balance rather than what the permission permits.',
  },
  {
    name: 'Dormant unlimited permission (no movement in over a year)',
    points: '+10',
    evidence: 'estimated',
    why: 'Derived from the last observed transfer of that token for this wallet. Dormant permissions are the ones people forget they granted.',
  },
  {
    name: 'Recognised protocol on the bundled allowlist',
    points: '−20',
    evidence: 'detected',
    why: 'A small bundled list of well-known routers, matched by contract address. Only an address match earns the discount: a name the explorer reports cannot move a score, because whoever deploys a contract chooses that name. A name on the list is still not a safety guarantee.',
  },
];

const LIMITS = [
  'Money and score are separate numbers, and a low score is not a statement that you have nothing to revoke. The dollar figure is what a permission can move today; the score is the sum of the danger weights that fired. A $540,000 permission to an old, verified, non-flagged contract scores 15 — correctly, because no danger signal fired. Read the two together.',
  'Scores are not probabilities and not a ranking of danger. A score of 45 and a score of 50 sit next to each other on one number line, but the difference between them is one weight firing, not a difference in measured outcome. Read the factors, not only the total.',
  'ERC-20 allowance approvals only. ERC-721 (NFT) approvals and off-chain permits such as Permit2 and ERC-2612 are not covered.',
  'Approvals granted inside a contract call are only found within a bounded recent log window, because public RPC endpoints reject deep log ranges. That window is measured per scan rather than assumed: the scan probes the endpoint, validates each range against a narrower read, and reports the window it actually reached, or reports it as unmeasured.',
  'Discovery reads the wallet’s recent transaction history and token transfers. Wallets with thousands of approvals will not have all of them enumerated in a single scan.',
  'Contract enrichment is capped per scan to stay inside public rate limits, and the cap is reported in the coverage panel.',
  'Unknown is not safe. Wherever a signal could not be measured, the UI shows it as not measured, and the risk model adds nothing for it.',
  'Anchrion reads public chain data with view calls only. It never asks for a private key and cannot move funds. Revoking sends a transaction your own wallet signs, and the app then reads the allowance back from the token contract before calling it revoked.',
];

export default function MethodPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: 'clamp(32px,6vh,72px) clamp(20px,5vw,48px)' }}>
        <a href="/dashboard" style={{ fontSize: 13, color: 'var(--blue-light)' }}>
          ← Back to dashboard
        </a>

        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(28px,4vw,40px)', fontWeight: 400, margin: '24px 0 12px' }}>
          Risk model and limits
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.7, maxWidth: 720 }}>
          Every Anchrion score is the sum of the weights below. It is a transparent rule set, not a
          trained model and not a third-party threat feed. You can recompute any score by hand from the
          numbers in the row detail, and you should feel free to argue with it.
        </p>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, margin: '36px 0 14px' }}>
          Weights
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {WEIGHTS.map((weight) => (
            <div
              key={weight.name}
              style={{
                padding: '14px 16px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 14, fontWeight: 600 }}>{weight.name}</span>
                <span style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span
                    style={{
                      fontSize: 10,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      color: weight.evidence === 'detected' ? 'var(--blue-light)' : 'var(--text-tertiary)',
                    }}
                  >
                    {weight.evidence}
                  </span>
                  <span style={{ fontFamily: 'monospace', fontSize: 14, color: weight.points.startsWith('−') ? '#86efac' : '#fca5a5' }}>
                    {weight.points}
                  </span>
                </span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginTop: 6 }}>
                {weight.why}
              </p>
            </div>
          ))}
        </div>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, margin: '36px 0 14px' }}>
          Bands
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Total is clamped to 0–100. Critical is 70 and above, high 50–69, medium 30–49, low 10–29, and
          anything below 10 is shown as safe. A score of zero means no measurable signal fired — it does
          not mean the permission is harmless, and the UI says so.
        </p>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, margin: '36px 0 14px' }}>
          What Anchrion cannot detect
        </h2>
        <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          {LIMITS.map((limit) => (
            <li key={limit}>{limit}</li>
          ))}
        </ul>

        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400, margin: '36px 0 14px' }}>
          Data sources
        </h2>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          Public JSON-RPC endpoints for live allowance, bytecode, and log reads, and keyless Blockscout
          explorer endpoints for transaction history, contract verification, and deployment age.
          Value-at-risk prices come from CoinGecko when reachable, with a dated static snapshot as a
          labelled fallback. No API key is required to run Anchrion with full functionality.
        </p>

        <div style={{ marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(255,255,255,0.06)', fontSize: 13, color: 'var(--text-tertiary)' }}>
          <a href="/dashboard" style={{ color: 'var(--blue-light)' }}>
            Open the dashboard
          </a>
          {' · '}
          <a href="https://github.com/thesithunyein/anchrion" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue-light)' }}>
            Source on GitHub
          </a>
        </div>
      </div>
    </div>
  );
}
