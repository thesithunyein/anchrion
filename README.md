<div align="center">
  <svg width="120" height="120" viewBox="0 0 100 100" fill="none">
    <rect width="100" height="100" rx="20" fill="#1a73e8" />
    <path d="M30 70L50 30L70 70" stroke="white" strokeWidth="8" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M38 55H62" stroke="white" strokeWidth="6" strokeLinecap="round" />
  </svg>
  
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
- 💰 **x402 Payments** — Pay-per-scan via Hedera (premium feature)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14, React 19, TypeScript, Tailwind CSS |
| Wallet | wagmi, viem, RainbowKit |
| Data | The Graph (Messari Standardized Subgraphs) |
| AI | 0G Compute (TEE-attested inference) |
| Payments | Hedera x402 + Blocky402 |
| Storage | 0G Storage (encrypted approval history) |
| Database | Supabase (PostgreSQL) |

---

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- MetaMask or other Web3 wallet

### Installation

```bash
# Clone the repository
git clone https://github.com/SithuNyein/anchrion.git
cd anchrion

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Project Structure

```
anchrion/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── layout.tsx         # Root layout with providers
│   │   ├── page.tsx           # Landing page
│   │   ├── providers.tsx      # Wagmi + React Query providers
│   │   └── dashboard/         # Main dashboard
│   ├── components/            # Reusable UI components
│   ├── lib/                   # Core logic
│   │   ├── graph/             # The Graph integration
│   │   ├── risk/              # Risk scoring engine
│   │   └── wagmi.ts           # Wallet configuration
│   └── types/                 # TypeScript types
├── public/                    # Static assets
└── package.json
```

---

## How It Works

### 1. Wallet Connection
Connect your MetaMask, Rainbow, or other Web3 wallet. No private keys are ever stored.

### 2. Approval Scanning
Anchrion queries The Graph to fetch all ERC-20 token approvals for your wallet across supported chains.

### 3. Risk Scoring
Each approval is scored based on:
- Spending limits (unlimited = high risk)
- Contract age (newer = riskier)
- Known safe/malicious contracts
- Value at risk

### 4. AI Explanations
Get plain English explanations of why each approval is dangerous. Powered by 0G Compute TEE for verifiable, attested analysis.

### 5. One-Click Revoke
Revoke dangerous approvals with a single click. Transactions are built and signed through your wallet.

---

## Sponsor Integrations

### The Graph
- Fetches approval data using Messari Standardized Subgraphs
- Single query pattern covers multiple protocols

### Hedera
- x402 pay-per-scan payments
- Settlement on Hedera testnet via Blocky402

### 0G
- TEE-attested AI risk analysis
- Encrypted approval history storage

---

## Environment Variables

```env
# WalletConnect (optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# The Graph
NEXT_PUBLIC_GRAPH_API_KEY=

# 0G Compute
NEXT_PUBLIC_0G_COMPUTE_API_KEY=

# Hedera
NEXT_PUBLIC_HEDERA_ACCOUNT_ID=
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) first.

---

## Security

If you discover a security vulnerability, please report it responsibly. See [SECURITY.md](SECURITY.md) for details.

---

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

<div align="center">
  <p>Built with ❤️ by <a href="https://github.com/SithuNyein">Sithu Nyein</a></p>
  <p>Powered by The Graph + Hedera + 0G</p>
</div>
