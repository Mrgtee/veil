# Veil

Veil is an Arc-based USDC payment workspace for live Open Payments and upcoming native Arc private payments.

Users choose both a payment mode and a payment source before sending:

1. Open Payment or Private Payment
2. Arc Direct or Unified USDC Balance

Open Payment is visible USDC settlement on Arc. Private Payment is currently positioned as "Coming soon with Arc Private Kit." Veil is preparing native Arc privacy integration for hidden/private payment support and does not treat hidden memos, labels, private names, UI-only records, or visible ERC20 transfers as private settlement.

## Why Arc

Arc is the settlement target because it is designed around stablecoin payments and USDC-native user experiences. This repo uses Arc Testnet for wallet switching, explorer links, VeilHub events, and fast USDC payment iteration.

## What Works Today

- RainbowKit wallet connection through the app shell and top bar.
- API-backed payment ledger for Dashboard, History, Activity, Private Records, Access Control, and Audit Trail.
- Arc Direct single and batch Open Payments through the deployed Arc Testnet `VeilHub` and ERC20 USDC when env values are configured.
- USDC allowance checks and `approve` requests only when VeilHub needs more allowance.
- Unified USDC Balance deposits, balance reads, and spends through Circle AppKit with the connected user wallet.
- Unified USDC Balance remains usable even when VeilHub is missing; successful spends are recorded as pending VeilHub registration.
- Pending settlement records when Unified USDC Balance appears deducted but final Arc confirmation is delayed.
- Mobile navigation to every main app area.
- VeilHub contract architecture for live Open Payments.
- Experimental VeilShield research contracts, Noir prototype circuits, generated verifiers, and CLI proof tooling for developer preview only.

## Temporary Testnet Ledger

The API JSON ledger is temporary testnet infrastructure. It is server-owned and more reliable than browser-only `localStorage`, but it is not the final production source of truth.

Production direction:

- database or indexed storage for app records
- VeilHub event indexing for open payments and Unified USDC Balance references
- Arc Private Kit indexing/integration when user-facing private payments are live
- VeilShield event indexing only for experimental research records if that layer continues beyond prototype work
- reconciliation between API records, Arc transactions, and indexed contract events

`localStorage` is only used for harmless wallet/session or Unified USDC Balance display cache, not payment truth.

## Wallet Connection

RainbowKit powers wallet selection, account display, and Arc Testnet network switching. The supported app network is Arc Testnet (`5042002`). WalletConnect and mobile wallet support require a local `VITE_WALLETCONNECT_PROJECT_ID`.

## Payment Modes

### Open Payment

Open Payment sends visible USDC on Arc. Sender, recipient, token, and amount are visible.

### Private Payment

Private Payment is not user-facing yet. The app shows "Coming soon with Arc Private Kit." Veil will prioritize Arc's native privacy kit for hidden/private payment support.

A normal ERC20 transfer cannot hide amount, so Veil does not ship fake privacy. Until the native Arc private-payment stack is available, wired, tested, and audited, the frontend blocks Private Payment submission.

### Experimental Research / Developer Preview

VeilShield remains experimental research, not the user-facing private payment path. Its prototype model is deposit -> private note -> hidden transfer with nullifier/proof -> withdraw.

Milestone 2 now includes local Noir circuits for a first testnet-only hidden-amount prototype:

- transfer circuit: proves a hidden transfer amount is positive, input amount equals transfer plus change, commitments match, and nullifier matches
- withdraw circuit: proves a public withdrawal amount matches a hidden note commitment and nullifier
- shared Pedersen helpers for prototype commitments and nullifiers

These circuits now have generated Solidity verifiers committed under `contracts/src/verifiers/` and a verifier adapter. Local CLI tooling can generate proof artifacts and submit them to VeilShield for developer preview, but browser proof generation, recipient note handoff, indexing, and audits are not complete. Normal Private Payment transfer submission remains blocked in the app.

## Payment Sources

### Arc Direct

Arc Direct requires:

- `VITE_USE_VEIL_HUB=true`
- `VITE_VEIL_HUB_ADDRESS=0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b`
- `VITE_ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000`

When configured, the frontend reads USDC decimals, checks wallet balance and allowance, requests `approve` only when needed, then calls `VeilHub.payOpen` or `VeilHub.payOpenBatch`. There is no native-transfer fallback and no legacy batch-contract flow.

### Unified USDC Balance

Unified USDC Balance uses Circle AppKit in the browser with the connected wallet. Backend-managed wallets are not used for user-facing deposit, balance, or spend.

If a Unified USDC Balance spend succeeds and VeilHub is configured, Veil records the payment and registers a VeilHub reference. If VeilHub is missing or registration fails after spend, Veil records `pending_veilhub_registration`. If balance is deducted but final settlement is delayed, Veil records `pending_settlement`. If balance is not deducted, Veil does not record success.

## Batch Payments

Batch Payments use form rows as the main UX. Users add/remove recipients, review total USDC, choose mode/source, and see per-recipient progress.

## Dashboard And History

Dashboard and History read from the API ledger. They show settled, failed, pending settlement, and pending VeilHub registration states. Payment details expose transaction hashes, pending references, source, mode, and settlement notes.

## Contract Architecture

- `contracts/src/VeilHub.sol`: main on-chain identity for open ERC20 USDC payments on Arc. It routes single/batch payments, records Unified USDC Balance references, emits `bytes32` IDs, and uses SafeERC20, ReentrancyGuard, Pausable, and Ownable patterns.
- `contracts/src/VeilShield.sol`: experimental testnet-only hidden-amount architecture with deposits, note commitments, nullifiers, proof hooks, and withdrawals.
- `contracts/src/interfaces/IVeilShieldVerifier.sol`: verifier interface for future Noir/ZK circuits.
- `contracts/src/VeilShieldVerifierAdapter.sol`: maps VeilShield transfer/withdraw public inputs into generated Barretenberg verifier contracts.
- `contracts/src/verifiers/TransferVerifier.sol`: generated Solidity verifier for the transfer circuit.
- `contracts/src/verifiers/WithdrawVerifier.sol`: generated Solidity verifier for the withdraw circuit.
- `contracts/src/verifiers/BaseZKHonkVerifier.sol`: shared generated Barretenberg verifier base.
- `contracts/test`: Foundry tests for VeilHub and VeilShield.
- `circuits/veil_shield_transfer`: Noir transfer proof prototype.
- `circuits/veil_shield_withdraw`: Noir withdraw proof prototype.
- `circuits/veil_shield_note`: developer helper circuit for note commitment/nullifier calculation.
- `circuits/veil_shield_transfer_inputs`: developer helper circuit for transfer public-input calculation.

## Current Arc Testnet Deployment

- Chain ID: `5042002`
- Deployer: `0xfE84F8661D575B4fEd8BEAFcbF6b3Fa9c4f9207F`
- Arc USDC: `0x3600000000000000000000000000000000000000`
- VeilHub: `0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b`

Arc Direct single and batch Open Payments have been live-tested through this VeilHub deployment and recorded in the API ledger as settled Arc Testnet transactions.

### Experimental Research / Developer Preview Addresses

- TransferVerifier: `0xc5B31339159d9371Cb0efb49F001d5506407CE6a`
- WithdrawVerifier: `0xA1e76f8AC92220596AacC7009d62a2fe22a55253`
- VeilShieldVerifierAdapter: `0x9EfeBa2F99D7f79541A2e8824bFcd8Be628D0253`
- VeilShield: `0x1BC23d45aEc7229809841a6FCd578A9C61A5667D`

VeilShield contracts are deployed only for experimental developer-preview verification. They are not the current user-facing Private Payment path.

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
VITE_WALLETCONNECT_PROJECT_ID=<walletconnect project id>
VEIL_LEDGER_PATH=./data/veil-ledger.json
```

Optional experimental research env only:

```bash
VITE_VEIL_SHIELD_ADDRESS=0x1BC23d45aEc7229809841a6FCd578A9C61A5667D
VITE_VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS=0xc5B31339159d9371Cb0efb49F001d5506407CE6a
VITE_VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS=0xA1e76f8AC92220596AacC7009d62a2fe22a55253
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

cd /home/gtee/projects/veil/circuits/veil_shield_note
/home/gtee/.nargo/bin/nargo test

cd /home/gtee/projects/veil/circuits/veil_shield_transfer_inputs
/home/gtee/.nargo/bin/nargo test

node /home/gtee/projects/veil/scripts/generate-veilshield-verifiers.mjs
```

Run `forge test` only when Foundry is installed.

## Deployment Notes

1. Use the current Arc Testnet VeilHub deployment above, or redeploy with `contracts/script/DeployVeilHub.s.sol`.
2. Configure frontend env values for VeilHub and Arc USDC.
3. Run the API with a durable `VEIL_LEDGER_PATH` for testnet.
4. Move production records to database/indexer infrastructure before mainnet use.
5. User-facing Private Payment should prioritize Arc Private Kit integration when the native Arc privacy stack is available.
6. Keep VeilShield under Experimental Research / Developer Preview unless the product direction explicitly changes after audits.

### Vercel Preview Deployment

Veil can be deployed to Vercel as a Vite frontend with serverless API routes under `/api`. In production builds, the frontend uses same-origin API calls when `VITE_API_BASE_URL` is not set.

The checked-in `vercel.json` configures the public Arc Testnet values for the current VeilHub deployment. Add a real `VITE_WALLETCONNECT_PROJECT_ID` in the Vercel project settings for WalletConnect and mobile wallet support.

The Vercel serverless JSON ledger uses `/tmp/veil-ledger.json` for preview deployments. That is useful for smoke testing, but it is not durable production storage. Use a database or indexer-backed API before relying on hosted payment history.

## Experimental Research / Developer Preview

VeilShield is retained as an experimental research layer. It is testnet-only, unaudited, and no longer drives the normal Private Payment UI. Use it only from local developer tooling when intentionally testing the prototype.

CLI helper:

```bash
cd /home/gtee/projects/veil
node scripts/veilshield-dev-proof.mjs note --owner <wallet> --token 0x3600000000000000000000000000000000000000 --amount-base <usdc-base-units>
node scripts/veilshield-dev-proof.mjs transfer --sender <wallet> --recipient <recipient> --token 0x3600000000000000000000000000000000000000 --input-amount-base <input> --transfer-amount-base <transfer> --secret <secret> --input-salt <salt> --output-salt <salt> --change-salt <salt> --artifact-out /tmp/veil-transfer-artifact.json
node scripts/veilshield-dev-proof.mjs withdraw --owner <wallet> --recipient <recipient> --token 0x3600000000000000000000000000000000000000 --amount-base <amount> --secret <secret> --salt <salt> --artifact-out /tmp/veil-withdraw-artifact.json
```

Submit a generated proof artifact from a local developer shell:

```bash
cd /home/gtee/projects/veil
set -a && source contracts/.env && set +a
node scripts/veilshield-submit-proof.mjs transfer --artifact /tmp/veil-transfer-artifact.json --record-ledger
node scripts/veilshield-submit-proof.mjs withdraw --artifact /tmp/veil-withdraw-artifact.json --record-ledger
```

The submitter simulates the contract call, checks note/nullifier state, submits only real proof bytes, waits for a real tx hash, and records the API ledger only after success when `--record-ledger` and `VEIL_API_BASE_URL` are set. Browser Private Payment submit remains blocked and is expected to prioritize Arc Private Kit.

## Known Limitations

- The JSON ledger is temporary testnet infrastructure, not production storage.
- Arc Direct is disabled until VeilHub env values are configured in `.env.local`.
- Browser Private Payment settlement is blocked until Arc Private Kit integration is available, wired, tested, and audited.
- VeilShield developer CLI proof submission exists for testnet research only and is not the user-facing private-payment path.
- VeilShield research note secrets must stay local to the developer environment. This is not a production custody or recovery model.
- Noir prototype commitments currently use Pedersen for local correctness; the production hash choice must be reviewed before deployment.
- The generated verifiers are deploy-ready for Arc Testnet experiments, not production-ready confidential payment infrastructure.
- The deployed transfer prototype currently requires additional note-handoff work before recipient output notes can be safely discovered and spent.
- Unified USDC Balance availability depends on Circle AppKit and supported testnet chains.
- Foundry must be installed locally to run Solidity tests.

## Roadmap

- Add production monitoring and event indexing for the deployed Arc Testnet VeilHub.
- Add database/indexer-backed ledger storage.
- Index VeilHub events for open payments and Unified USDC Balance references.
- Integrate Arc Private Kit for user-facing hidden/private payment support.
- Keep VeilShield research isolated unless it is explicitly revisited after audits.
- Add settlement reconciliation jobs for delayed Unified USDC Balance finalization.
