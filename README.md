# Veil

Veil is an Arc-based USDC payment workspace for open payments today and closed, hidden-amount payments through the VeilShield architecture.

The product gives a connected wallet two explicit choices before payment:

1. Payment mode: Open Payment or Closed Payment
2. Payment source: Arc Direct or Unified Balance USDC

Open Payment means a normal visible USDC payment on Arc. Closed Payment means sender and recipient remain visible while the amount is hidden onchain. Veil does not treat hidden memos, labels, or UI-only privacy as closed payment settlement.

## Why Arc

Arc is the settlement target for Veil because it is designed around stablecoin payments and USDC-native user experiences. Veil uses Arc Testnet in this repo for fast USDC payment iteration, wallet switching, explorer links, and payment-specific contract events.

## What Works Today

- Global wallet connection through the app shell and top bar.
- Open Arc Direct single payments from the connected wallet.
- Open Arc Direct batch payments through the configured batch payout contract.
- Unified Balance deposits from the connected wallet on supported testnet source chains.
- Unified Balance balance reads from the connected wallet, including confirmed and pending balances.
- Unified Balance single and batch spends from the connected wallet, not backend-managed wallets.
- Pending payment recording when Unified Balance appears deducted but final Arc settlement confirmation is delayed.
- Dashboard and History based on current local payment records.
- Mobile navigation to every main app area.
- VeilHub contract architecture for ERC20 USDC open payment routing and Unified Balance references.
- VeilShield experimental contract skeleton for deposit, note commitment, nullifier, hidden transfer, and withdraw flows.

## Experimental

Closed Payment is experimental and testnet-only. The current app intentionally blocks visible Arc transfers when Closed Payment is selected because that would expose the amount. VeilShield contracts, interfaces, tests, and docs define the right architecture, but full confidential transfers still require Noir/ZK circuits, verifier deployment, prover integration, and security audit.

## Core Flows

### Open Payment

Open Payment sends visible USDC on Arc. Use it for normal payments where the sender, recipient, and amount can be public.

### Closed Payment

Closed Payment is designed for sender-visible, recipient-visible, amount-hidden settlement. The intended model is:

1. Deposit USDC into VeilShield.
2. Mint a private note or private balance commitment.
3. Spend privately with a nullifier and zero-knowledge proof.
4. Let the recipient withdraw when needed.

Normal ERC20 or native transfers do not hide amounts.

### Arc Direct

Arc Direct uses the connected wallet on Arc. Single payments send directly from the wallet. Batch payments use the configured Arc batch payout contract.

### Unified Balance USDC

Unified Balance lets the connected wallet deposit USDC from supported source chains and spend confirmed balance into Arc payments. Pending balance is shown but cannot be spent.

### Batch Payments

Batch Payments use form rows as the primary UX. Add or remove recipients, review total USDC, choose mode/source, and watch per-recipient progress.

### Dashboard and History

Dashboard summarizes current payment records, pending settlement count, and Unified Balance cache state. History shows settled, pending, failed, open, closed, Arc Direct, and Unified Balance records.

## Contract Architecture

- `contracts/src/VeilHub.sol`: Main Veil identity for ERC20 USDC open payments on Arc. It routes single and batch payments, records Unified Balance open payment references, emits events with `bytes32` IDs, and uses SafeERC20, ReentrancyGuard, Pausable, and Ownable patterns.
- `contracts/src/VeilShield.sol`: Experimental testnet-only hidden-amount architecture. It supports deposit, note commitments, nullifiers, transfer proof hooks, withdraw proof hooks, and double-spend prevention.
- `contracts/src/interfaces/IVeilShieldVerifier.sol`: Verifier interface for future Noir/ZK circuits.
- `contracts/test`: Foundry tests for VeilHub and VeilShield behavior.

## Setup

```bash
npm install
```

If the API service is needed:

```bash
cd apps/api
npm install
```

## Environment Variables

Frontend variables:

```bash
VITE_API_BASE_URL=http://localhost:8787
VITE_PAYMENT_VAULT_ADDRESS=0x...
VITE_BATCH_PAYOUT_ADDRESS=0x...
VITE_VEIL_HUB_ADDRESS=0x...
VITE_ARC_USDC_ADDRESS=0x...
```

API variables:

```bash
PORT=8787
ENCRYPTION_KEY_HEX=<32-byte-hex-key>
UB_EVM_PRIVATE_KEY=<operator-only-testnet-key>
```

Do not commit `.env`, `.env.local`, `.env.contracts`, private keys, API keys, or secrets.

## Build Commands

```bash
npm run build
```

```bash
cd apps/api
npm run build
```

## Test Commands

Frontend tests:

```bash
npm test
```

Contracts, when Foundry is installed:

```bash
cd contracts
forge test
```

## Deployment Notes

1. Deploy USDC or configure the Arc USDC token address.
2. Deploy `VeilHub` with the USDC token and owner.
3. Configure frontend contract addresses.
4. Keep VeilShield on testnet until circuits, verifier, and audits are complete.
5. Disable or protect any operator-only API scripts that use backend-managed wallets.

## Known Limitations

- Closed Payment settlement is not production-ready.
- Unified Balance availability depends on Circle AppKit and supported testnet chains.
- Payment history is stored locally in the browser in this app version.
- Foundry must be installed locally to run Solidity tests.
- Large frontend chunks remain from wallet/Circle dependencies.

## Roadmap

- Deploy VeilHub on Arc and route frontend Arc Direct flows through it.
- Build Noir circuits for VeilShield note creation, transfer, and withdraw.
- Add a production verifier and audited proving flow.
- Move payment history to durable indexed storage.
- Add contract event indexing for dashboard/history.
- Add richer settlement reconciliation for delayed Unified Balance spends.

