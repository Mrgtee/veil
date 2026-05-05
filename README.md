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
- Arc Direct single and batch Open Payments through the deployed Arc Testnet `VeilHub` and ERC20 USDC when env values are configured.
- USDC allowance checks and `approve` requests only when VeilHub needs more allowance.
- Unified Balance deposits, balance reads, and spends through Circle AppKit with the connected user wallet.
- Unified Balance remains usable even when VeilHub is missing; successful spends are recorded as pending VeilHub registration.
- Pending settlement records when Unified Balance appears deducted but final Arc confirmation is delayed.
- Mobile navigation to every main app area.
- VeilHub and VeilShield contract architecture.
- Milestone 2 Noir prototype circuits for VeilShield transfer and withdraw proofs.
- Generated Solidity verifier contracts and a VeilShield verifier adapter for Arc Testnet deployment.

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

Closed Payment is blocked/setup-required until frontend proof generation, note management, and audits are complete. A normal ERC20 transfer cannot hide amount. VeilShield’s intended model is deposit -> private note -> hidden transfer with nullifier/proof -> withdraw.

Milestone 2 now includes local Noir circuits for a first testnet-only hidden-amount prototype:

- transfer circuit: proves a hidden transfer amount is positive, input amount equals transfer plus change, commitments match, and nullifier matches
- withdraw circuit: proves a public withdrawal amount matches a hidden note commitment and nullifier
- shared Pedersen helpers for prototype commitments and nullifiers

These circuits now have generated Solidity verifiers committed under `contracts/src/verifiers/` and a verifier adapter, but frontend proof generation is not implemented yet. Closed Payment remains blocked in the app.

## Payment Sources

### Arc Direct

Arc Direct requires:

- `VITE_USE_VEIL_HUB=true`
- `VITE_VEIL_HUB_ADDRESS=0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b`
- `VITE_ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000`

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
- `contracts/src/VeilShieldVerifierAdapter.sol`: maps VeilShield transfer/withdraw public inputs into generated Barretenberg verifier contracts.
- `contracts/src/verifiers/TransferVerifier.sol`: generated Solidity verifier for the transfer circuit.
- `contracts/src/verifiers/WithdrawVerifier.sol`: generated Solidity verifier for the withdraw circuit.
- `contracts/src/verifiers/BaseZKHonkVerifier.sol`: shared generated Barretenberg verifier base.
- `contracts/test`: Foundry tests for VeilHub and VeilShield.
- `circuits/veil_shield_transfer`: Noir transfer proof prototype.
- `circuits/veil_shield_withdraw`: Noir withdraw proof prototype.

## Current Arc Testnet Deployment

- Chain ID: `5042002`
- Deployer: `0xfE84F8661D575B4fEd8BEAFcbF6b3Fa9c4f9207F`
- Arc USDC: `0x3600000000000000000000000000000000000000`
- VeilHub: `0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b`
- TransferVerifier: `0xc5B31339159d9371Cb0efb49F001d5506407CE6a`
- WithdrawVerifier: `0xA1e76f8AC92220596AacC7009d62a2fe22a55253`
- VeilShieldVerifierAdapter: `0x9EfeBa2F99D7f79541A2e8824bFcd8Be628D0253`
- VeilShield: `0x1BC23d45aEc7229809841a6FCd578A9C61A5667D`

Arc Direct single and batch payments have been live-tested through this VeilHub deployment and recorded in the API ledger as settled Arc Testnet transactions.
VeilShield contracts are deployed for developer-preview verification, but Closed Payment submission remains blocked until proof generation and note management are wired.

See `docs/DEPLOYMENT.md` for frontend env, contract env, and redeploy commands.

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
VITE_VEIL_HUB_ADDRESS=0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b
VITE_ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_ARC_CHAIN_ID=5042002
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_VEIL_SHIELD_ADDRESS=0x1BC23d45aEc7229809841a6FCd578A9C61A5667D
VITE_VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS=0xc5B31339159d9371Cb0efb49F001d5506407CE6a
VITE_VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS=0xA1e76f8AC92220596AacC7009d62a2fe22a55253
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

cd /home/gtee/projects/veil/circuits/veil_shield_transfer
/home/gtee/.nargo/bin/nargo test

cd /home/gtee/projects/veil/circuits/veil_shield_withdraw
/home/gtee/.nargo/bin/nargo test

node /home/gtee/projects/veil/scripts/generate-veilshield-verifiers.mjs
```

Run `forge test` only when Foundry is installed.

## Deployment Notes

1. Use the current Arc Testnet VeilHub deployment above, or redeploy with `contracts/script/DeployVeilHub.s.sol`.
2. Configure frontend env values for VeilHub and Arc USDC.
3. Run the API with a durable `VEIL_LEDGER_PATH` for testnet.
4. Move production records to database/indexer infrastructure before mainnet use.
5. To deploy the testnet-only VeilShield stack, use `contracts/script/DeployVeilShield.s.sol`. It deploys `TransferVerifier`, `WithdrawVerifier`, `VeilShieldVerifierAdapter`, and `VeilShield`.
6. Keep Closed Payment blocked in the frontend until proof generation, note discovery, indexing, and audits are complete.

## Known Limitations

- The JSON ledger is temporary testnet infrastructure, not production storage.
- Arc Direct is disabled until VeilHub env values are configured in `.env.local`.
- Closed Payment settlement is blocked until frontend proof generation and note discovery are complete and audited.
- Noir prototype commitments currently use Pedersen for local correctness; the production hash choice must be reviewed before deployment.
- The generated verifiers are deploy-ready for Arc Testnet experiments, not production-ready confidential payment infrastructure.
- Unified Balance availability depends on Circle AppKit and supported testnet chains.
- Foundry must be installed locally to run Solidity tests.

## Roadmap

- Add production monitoring and event indexing for the deployed Arc Testnet VeilHub.
- Add database/indexer-backed ledger storage.
- Index VeilHub events for open payments and Unified Balance references.
- Deploy VeilShield verifiers, adapter, and shield contract on Arc Testnet.
- Add frontend proof-generation flow.
- Index VeilShield events for closed-payment discovery.
- Add settlement reconciliation jobs for delayed Unified Balance finalization.
