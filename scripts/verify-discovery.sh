#!/usr/bin/env bash
#
# Print exactly what a scan found for one address, and how each permission was
# found, straight from the same API the dashboard uses.
#
# This exists so the central claim — "Anchrion finds approvals a known-spender
# list cannot" — is checkable rather than asserted. Point it at a wallet you
# know has a permission to an obscure contract and read the `via` column.
#
# Usage:
#   ./scripts/verify-discovery.sh 0xYourAddress [chainId] [baseUrl]
#
#   chainId  default 1 (Ethereum mainnet); 11155111 is Sepolia
#   baseUrl  default http://localhost:3000 (start `npm run dev` first)

set -euo pipefail

ADDRESS="${1:?usage: verify-discovery.sh <address> [chainId] [baseUrl]}"
CHAIN_ID="${2:-1}"
BASE_URL="${3:-http://localhost:3000}"

if ! printf '%s' "$ADDRESS" | grep -Eq '^0x[0-9a-fA-F]{40}$'; then
  echo "Refusing to run: '$ADDRESS' is not a 40-hex-character address." >&2
  exit 1
fi

echo "Scanning $ADDRESS on chain $CHAIN_ID via $BASE_URL"
echo

curl -sS --max-time 180 -X POST "$BASE_URL/api/approvals" \
  -H 'Content-Type: application/json' \
  -d "{\"walletAddress\":\"$ADDRESS\",\"chainId\":$CHAIN_ID}" |
  node -e '
let raw = "";
process.stdin.on("data", (chunk) => (raw += chunk));
process.stdin.on("end", () => {
  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    console.error("Could not parse the API response. Is the dev server running?");
    console.error(raw.slice(0, 400));
    process.exit(1);
  }
  if (payload.error) {
    console.error("Scan failed:", payload.error);
    process.exit(1);
  }

  const c = payload.coverage;
  const pad = (s, n) => String(s).padEnd(n);

  console.log("COVERAGE");
  console.log("  transactions read ............", c.transactionsScanned);
  console.log("  token transfers read .........", c.transfersScanned);
  console.log("  approve() calls decoded ......", c.approveCallsParsed);
  console.log("  Approval events decoded ......", c.approvalLogsParsed);
  console.log("  tokens scanned ...............", c.tokensScanned);
  console.log("  pairs read on chain ..........", c.pairsChecked);
  console.log("  granted then revoked .........", c.revokedFound);
  console.log("  candidate never granted ......", c.notGrantedFound ?? 0);
  console.log(
    "  log window reached ...........",
    c.logsWindowBlocks === null ? "none (unmeasured)" : c.logsWindowBlocks + " blocks",
  );
  console.log("  explorer reachable ...........", c.explorerReachable);
  console.log("  prices .......................", c.priceSource);

  console.log();
  console.log("LIVE PERMISSIONS:", payload.approvals.length);
  if (payload.approvals.length > 0) {
    console.log(
      "  " +
        pad("risk", 5) +
        pad("level", 8) +
        pad("token", 10) +
        pad("allowance", 12) +
        pad("value", 12) +
        pad("via", 15) +
        "spender",
    );
    for (const a of payload.approvals) {
      console.log(
        "  " +
          pad(a.riskScore, 5) +
          pad(a.riskLevel, 8) +
          pad(a.token.symbol, 10) +
          pad(a.allowanceFormatted, 12) +
          pad("$" + a.valueAtRiskUsd, 12) +
          pad(a.discoverySource, 15) +
          (a.spenderLabel ? a.spenderLabel + " " : "") +
          a.spenderAddress,
      );
    }
  }

  console.log();
  console.log("COVERAGE NOTES (verbatim, as shown in the UI)");
  for (const note of c.notes) console.log("  -", note);
});
'
