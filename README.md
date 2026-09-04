<div align="center">
  <img src="public/logo.png" alt="Anchrion" width="100" />
  
  # Anchrion
  
  **Your Wallet's AI Bodyguard**
  
  [![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org)
  [![Tailwind CSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)](https://tailwindcss.com)
  [![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)
</div>

---

## What is Anchrion?

Anchrion is an AI-powered wallet security guardian that monitors, explains, and protects your token approvals across multiple blockchain networks.

### The Problem

Every crypto user has approved tokens to use dApps. Some of those approvals can drain your entire wallet. Most people don't know which contracts are dangerous until it's too late.

### The Solution

Anchrion watches every approval the moment it happens, explains the risk in plain English, and lets you revoke dangerous contracts with one click.

**Connect → Scan → Understand → Protect**

---

## Features

- 🛡️ **Real-time Monitoring** — Catches new approvals instantly
- 🧠 **AI Risk Analysis** — Plain English explanations of why approvals are dangerous
- ⚡ **One-Click Revoke** — Revoke dangerous approvals with a single click
- 🔒 **Encrypted Memory** — Remembers your approval history over time
- 🔗 **Multi-Chain** — Ethereum, Base, Arbitrum, Optimism

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS |
| Wallet | wagmi, viem |
| Data | The Graph (Messari Standardized Subgraphs) |
| AI | 0G Compute (TEE-attested inference) |
| Payments | Hedera x402 + Blocky402 |
| Storage | 0G Storage (encrypted approval history) |

---

## Getting Started

```bash
git clone https://github.com/thesithunyein/anchrion.git
cd anchrion
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

```env
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=
NEXT_PUBLIC_GRAPH_API_KEY=
NEXT_PUBLIC_0G_COMPUTE_API_KEY=
NEXT_PUBLIC_HEDERA_ACCOUNT_ID=
```

---

## How It Works

1. **Connect** — Link your MetaMask, Coinbase Wallet, or any Web3 wallet
2. **Scan** — Anchrion fetches all token approvals from The Graph
3. **Understand** — AI explains each approval in plain English
4. **Protect** — One-click revoke dangerous approvals

---

## Sponsor Integrations

- **The Graph** — Fetches approval data using Messari Standardized Subgraphs
- **Hedera** — x402 pay-per-scan payments on Hedera testnet
- **0G** — TEE-attested AI risk analysis + encrypted history storage

---

## License

MIT

---

<div align="center">
  <p>Built by <a href="https://github.com/thesithunyein">Sithu Nyein</a></p>
</div>
