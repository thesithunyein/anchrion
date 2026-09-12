#!/usr/bin/env bash
#
# Stage a reproducible drain on a TESTNET so the incident reconstruction has
# something real to reconstruct.
#
# TESTNET ONLY. This script refuses to run against a chain id that is not 11155111.
#
# What it does:
#   1. builds and deploys contracts/DemoDrainer.sol with your deployer key
#   2. prints the one command you run from the VICTIM wallet to grant it an
#      unlimited approval (use a second, throwaway account as the victim)
#   3. calls drain() so tokens actually move out of the victim
#
# Requirements: foundry (forge, cast), a funded Sepolia deployer key, and a
# victim account that already holds an ERC-20 on Sepolia and has approved a DEX
# (so Anchrion has a permission to show before the drain).
#
# Usage:
#   export DEPLOYER_KEY=0x...        # funded with Sepolia ETH, throwaway
#   export VICTIM_ADDRESS=0x...      # the wallet that gets drained
#   export TOKEN=0x...               # ERC-20 the victim holds on Sepolia
#   ./scripts/stage-drain.sh

set -euo pipefail

RPC_URL="${RPC_URL:-https://ethereum-sepolia-rpc.publicnode.com}"
CHAIN_ID=$(cast chain-id --rpc-url "$RPC_URL")

if [ "$CHAIN_ID" != "11155111" ]; then
  echo "Refusing to run: chain id is $CHAIN_ID, expected 11155111 (Sepolia)." >&2
  exit 1
fi

: "${DEPLOYER_KEY:?set DEPLOYER_KEY to a funded Sepolia key (throwaway)}"
: "${VICTIM_ADDRESS:?set VICTIM_ADDRESS to the wallet that will be drained}"
: "${TOKEN:?set TOKEN to an ERC-20 address the victim holds on Sepolia}"

DEPLOYER_ADDRESS=$(cast wallet address --private-key "$DEPLOYER_KEY")
echo "Deployer (attacker): $DEPLOYER_ADDRESS"
echo "Victim:              $VICTIM_ADDRESS"
echo "Token:               $TOKEN"
echo

echo "==> Deploying DemoDrainer"
DRAINER=$(forge create contracts/DemoDrainer.sol:DemoDrainer \
  --rpc-url "$RPC_URL" \
  --private-key "$DEPLOYER_KEY" \
  --broadcast \
  --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s).deployedTo))")

echo "    drainer deployed at $DRAINER"
echo
echo "==> Next, from the VICTIM wallet, grant an unlimited approval:"
echo
echo "    cast send $TOKEN \"approve(address,uint256)\" $DRAINER \\"
echo "      $(cast max-uint) --rpc-url $RPC_URL --private-key \$VICTIM_KEY"
echo
read -r -p "Press enter once the victim approval is confirmed..."

echo "==> Previewing what can be taken"
cast call "$DRAINER" "preview(address,address)(uint256)" "$TOKEN" "$VICTIM_ADDRESS" --rpc-url "$RPC_URL"

echo "==> Draining"
cast send "$DRAINER" "drain(address,address,uint256)" "$TOKEN" "$VICTIM_ADDRESS" 0 \
  --rpc-url "$RPC_URL" --private-key "$DEPLOYER_KEY"

echo
echo "Done. Open Anchrion, connect the VICTIM wallet, and run the incident"
echo "reconstruction. It should find the transfer, name $DRAINER as the initiator,"
echo "and offer to revoke the permission it used."
