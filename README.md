# Veil

Veil is an Arc-based open and closed USDC payment workspace.

Users choose both a payment mode and a payment source before sending:

1. Open Payment or Closed Payment
2. Arc Direct or Unified Balance USDC

Open Payment is visible USDC settlement on Arc. Closed Payment means sender and recipient remain visible while the amount is hidden onchain. Veil does not treat hidden memos, labels, private names, or UI-only records as closed settlement.

## Why Arc

Arc is the settlement target because it is designed around stablecoin payments and USDC-native user experiences. This repo uses Arc Testnet for wallet switching, explorer links, VeilHub events, and fast USDC payment iteration.

## What Works Today

- Global wallet connection through the app shell and top bar.
- API-backed payment ledger for Dashboard, History, Activity, Closed Records, Access Control, and Audit Trail.
- Arc Direct single and batch Open Payments through `VeilHub` and ERC20 USDC when env values are configured.
- USDC allowance checks and `approve` requests only when VeilHub needs more allowance.
- Unified Balance deposits, balance reads, and spends through Circle AppKit with the connected user wallet.
- Unified Balance remains usable even when VeilHub is missing; successful spends are recorded as pending VeilHub registration.
- Pending settlement records when Unified Balance appears deducted but final Arc confirmation is delayed.
- Mobile navigation to every main app area.
- VeilHub and VeilShield contract architecture.

## Temporary Testnet Ledger

The API JSON ledger is temporary testnet infrastructure. It is server-owned and more reliable than browser-only `localStorage`, but it is not the final production source of truth.

Production direction:

- database or indexed storage for app records
- VeilHub event indexing for open payments and Unified Balance references
- VeilShield event indexing when closed payments are live
- reconciliation between API records, Arc transactions, and indexed contract events

`localStorage` is only used for harmless wallet/session or Unified Balance display cache, not payment truth.

## Payment Modes

### Open Payment

Open Payment sends visible USDC on Arc. Sender, recipient, token, and amount are visible.

### Closed Payment

Closed Payment is blocked/setup-required until VeilShield + Noir/ZK verifier/circuits are deployed and audited. A normal ERC20 transfer cannot hide amount. VeilShield’s intended model is deposit -> private note -> hidden transfer with nullifier/proof -> withdraw.

## Payment Sources

### Arc Direct

Arc Direct requires:

- `VITE_USE_VEIL_HUB=true`
- `VITE_VEIL_HUB_ADDRESS`
- `VITE_ARC_USDC_ADDRESS`

When configured, the frontend reads USDC decimals, checks wallet balance and allowance, requests `approve` only when needed, then calls `VeilHub.payOpen` or `VeilHub.payOpenBatch`. There is no native-transfer fallback and no legacy batch-contract flow.

### Unified Balance USDC

Unified Balance uses Circle AppKit in the browser with the connected wallet. Backend-managed wallets are not used for user-facing deposit, balance, or spend.

If a Unified Balance spend succeeds and VeilHub is configured, Veil records the payment and registers a VeilHub reference. If VeilHub is missing or registration fails after spend, Veil records `pending_veilhub_registration`. If balance is deducted but final settlement is delayed, Veil records `pending_settlement`. If balance is not deducted, Veil does not record success.

## Batch Payments

Batch Payments use form rows as the main UX. Users add/remove recipients, review total USDC, choose mode/source, and see per-recipient progress.

## Dashboard And History

Dashboard and History read from the API ledger. They show settled, failed, pending settlement, and pending VeilHub registration states. Payment details expose transaction hashes, pending references, source, mode, and settlement notes.

## Contract Architecture

- `contracts/src/VeilHub.sol`: main on-chain identity for open ERC20 USDC payments on Arc. It routes single/batch payments, records Unified Balance references, emits `bytes32` IDs, and uses SafeERC20, ReentrancyGuard, Pausable, and Ownable patterns.
- `contracts/src/VeilShield.sol`: experimental testnet-only hidden-amount architecture with deposits, note commitments, nullifiers, proof hooks, and withdrawals.
- `contracts/src/interfaces/IVeilShieldVerifier.sol`: verifier interface for future Noir/ZK circuits.
- `contracts/test`: Foundry tests for VeilHub and VeilShield.

## Setup

```bash
npm install
cd apps/api
npm install
```

Create local env files from `.env.example`. Do not commit real `.env` files or secrets.

## Environment Variables

```bash
VITE_API_BASE_URL=http://localhost:8787
VITE_USE_VEIL_HUB=true
VITE_VEIL_HUB_ADDRESS=0x...
VITE_ARC_USDC_ADDRESS=0x...
VITE_ARC_CHAIN_ID=5042002
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VEIL_LEDGER_PATH=./data/veil-ledger.json
```

Do not commit `.env`, `.env.contracts`, private keys, Circle keys, database URLs, encryption keys, or API secrets.

## Build Commands

```bash
npm run build
cd apps/api
npm run build
```

## Test Commands

```bash
npm test
npm run lint
cd contracts
forge test
```

Run `forge test` only when Foundry is installed.

## Deployment Notes

1. Deploy or identify Arc USDC.
2. Deploy `VeilHub(usdc, owner)` on Arc.
3. Configure frontend env values for VeilHub and Arc USDC.
4. Run the API with a durable `VEIL_LEDGER_PATH` for testnet.
5. Move production records to database/indexer infrastructure before mainnet use.
6. Keep VeilShield testnet-only until circuits, verifier, proving flow, and audits are complete.

## Known Limitations

- The JSON ledger is temporary testnet infrastructure, not production storage.
- VeilHub deployment addresses are not included in this repo.
- Arc Direct is disabled until VeilHub env values are configured.
- Closed Payment settlement is blocked until VeilShield + Noir/ZK is complete and audited.
- Unified Balance availability depends on Circle AppKit and supported testnet chains.
- Foundry must be installed locally to run Solidity tests.

## Roadmap

- Deploy VeilHub on Arc and publish deployment addresses.
- Add database/indexer-backed ledger storage.
- Index VeilHub events for open payments and Unified Balance references.
- Build Noir circuits for VeilShield note creation, hidden transfer, and withdraw.
- Deploy audited verifier contracts.
- Index VeilShield events for closed-payment discovery.
- Add settlement reconciliation jobs for delayed Unified Balance finalization.
