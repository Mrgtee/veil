# Deployment

## Current Arc Testnet Open Payment Deployment

VeilHub is deployed on Arc Testnet and is the required on-chain route for Arc Direct Open Payments. User-facing Private Payment is coming soon with Arc Private Kit; VeilShield is not the normal private-payment path.

The user-facing app brand is Veilarc, but the deployed contract names and addresses below remain unchanged.

| Item | Value |
| --- | --- |
| Chain | Arc Testnet |
| Chain ID | `5042002` |
| Deployer | `0xfE84F8661D575B4fEd8BEAFcbF6b3Fa9c4f9207F` |
| Arc USDC | `0x3600000000000000000000000000000000000000` |
| VeilHub | `0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b` |

Arc Direct single and batch payments have been live-tested through this deployment. The API ledger should show those records as `source=arc_direct`, `status=settled`, with the VeilHub transaction hash plus `paymentId` or `batchId`.

## Experimental Research / Developer Preview

The VeilShield contracts below remain testnet-only research infrastructure. They are not production-ready and do not enable user-facing Private Payment in the app.

| Item | Value |
| --- | --- |
| TransferVerifier | `0xc5B31339159d9371Cb0efb49F001d5506407CE6a` |
| WithdrawVerifier | `0xA1e76f8AC92220596AacC7009d62a2fe22a55253` |
| VeilShieldVerifierAdapter | `0x9EfeBa2F99D7f79541A2e8824bFcd8Be628D0253` |
| VeilShield | `0x1BC23d45aEc7229809841a6FCd578A9C61A5667D` |

Deployment transactions:

- TransferVerifier: `0x853300597a66658b8ce734d3f23af808d2d494490bd8e8bef0308efd9b93b35a`
- WithdrawVerifier: `0x596193bacc60337fd84ef459ae503d7bb18745db22edc5dd2a7c55159a1ba582`
- VeilShieldVerifierAdapter: `0xe92de510489c5d2d97380c4785c3abf7e19370407947beb08a8acaa4ee63977f`
- VeilShield: `0xdd818e1c44f4b649bb699c0988c371a3c19bdcfe1ff37a99640135a49464592e`

## Frontend Env

Create `/home/gtee/projects/veil/.env.local` locally. Do not commit it.

```bash
VITE_API_BASE_URL=http://localhost:8787
VITE_USE_VEIL_HUB=true
VITE_VEIL_HUB_ADDRESS=0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b
VITE_ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_ARC_CHAIN_ID=5042002
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VITE_WALLETCONNECT_PROJECT_ID=<walletconnect project id>
```

RainbowKit uses Arc Testnet (`5042002`) for wallet selection, account display, and network switching. `VITE_WALLETCONNECT_PROJECT_ID` is required for WalletConnect and mobile wallet support.

With these values, Arc Direct single payments call `VeilHub.payOpen`, and Arc Direct batch payments call `VeilHub.payOpenBatch`. The frontend reads USDC decimals, checks wallet USDC balance and VeilHub allowance, requests `approve` only when needed, then records the real transaction result in the API ledger.

## API Env

The local API ledger can use the default path or a local override. Do not commit API env files.

```bash
VEIL_LEDGER_PATH=./data/veil-ledger.json
```

## Vercel Preview Deployment

Veilarc includes a Vercel configuration for preview hosting:

- Vite builds to `dist`.
- React Router routes rewrite to `index.html`.
- API ledger routes are served from the Vercel serverless function in `api/[...path].ts`.
- Production frontend builds use same-origin API calls when `VITE_API_BASE_URL` is not set.

The checked-in `vercel.json` sets only public Arc Testnet values:

```bash
VITE_USE_VEIL_HUB=true
VITE_VEIL_HUB_ADDRESS=0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b
VITE_ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_ARC_CHAIN_ID=5042002
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
VEIL_LEDGER_PATH=/tmp/veil-ledger.json
```

Set this value in Vercel project settings for production-quality wallet support:

```bash
VITE_WALLETCONNECT_PROJECT_ID=<walletconnect project id>
```

The Vercel JSON ledger is preview infrastructure only. Serverless `/tmp` storage can be reset by platform lifecycle events and is not a durable source of truth. A production Vercel deployment should point `VITE_API_BASE_URL` at a durable API or replace the JSON ledger with database/indexer storage.

## VeilShield Prototype Env

These public Arc Testnet addresses are optional research references only. The normal app now positions Private Payment as `Coming soon with Arc Private Kit`.

```bash
VITE_VEIL_SHIELD_ADDRESS=0x1BC23d45aEc7229809841a6FCd578A9C61A5667D
VITE_VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS=0xc5B31339159d9371Cb0efb49F001d5506407CE6a
VITE_VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS=0xA1e76f8AC92220596AacC7009d62a2fe22a55253
```

Do not set these values to placeholder or mock contracts in a production-facing environment. Configured addresses are not enough to enable Private Payment submission.

## VeilShield Developer Preview Commands

Generate a note commitment/nullifier for a shield deposit:

```bash
cd /home/gtee/projects/veil
node scripts/veilshield-dev-proof.mjs note --owner <wallet> --token 0x3600000000000000000000000000000000000000 --amount-base <usdc-base-units>
```

Generate local transfer or withdraw proof artifacts for developer experiments:

```bash
node scripts/veilshield-dev-proof.mjs transfer --sender <wallet> --recipient <recipient> --token 0x3600000000000000000000000000000000000000 --input-amount-base <input> --transfer-amount-base <transfer> --secret <secret> --input-salt <salt> --output-salt <salt> --change-salt <salt> --artifact-out /tmp/veil-transfer-artifact.json
node scripts/veilshield-dev-proof.mjs withdraw --owner <wallet> --recipient <recipient> --token 0x3600000000000000000000000000000000000000 --amount-base <amount> --secret <secret> --salt <salt> --artifact-out /tmp/veil-withdraw-artifact.json
```

Submit proof artifacts with a local testnet key:

```bash
cd /home/gtee/projects/veil
set -a && source contracts/.env && set +a
node scripts/veilshield-submit-proof.mjs transfer --artifact /tmp/veil-transfer-artifact.json --record-ledger
node scripts/veilshield-submit-proof.mjs withdraw --artifact /tmp/veil-withdraw-artifact.json --record-ledger
```

The developer submit script can submit `transferNote` and `withdraw` with real proof artifacts, but this remains research tooling. Browser Private Payment is expected to prioritize Arc Private Kit.

## Contract Deployment Command

The deployment script is `contracts/script/DeployVeilHub.s.sol`.

`contracts/.env` must remain local and untracked:

```bash
PRIVATE_KEY=<testnet deployer private key>
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VEIL_HUB_ADDRESS=0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b
VEIL_SHIELD_ADDRESS=0x1BC23d45aEc7229809841a6FCd578A9C61A5667D
VEIL_API_BASE_URL=http://localhost:8787
```

Deploy or redeploy with:

```bash
cd /home/gtee/projects/veil/contracts
set -a && source .env && set +a
forge script script/DeployVeilHub.s.sol:DeployVeilHub --rpc-url "$ARC_TESTNET_RPC_URL" --broadcast --chain-id "$ARC_CHAIN_ID" -vvv
```

Copy the `VeilHub deployed 0x...` output into `.env.local` as `VITE_VEIL_HUB_ADDRESS`.

## VeilShield Deployment Step

VeilShield has been deployed for Arc Testnet research, but user-facing Private Payment now prioritizes Arc Private Kit and remains blocked in the frontend.

Important: if Foundry prompts that `TransferVerifier` or `WithdrawVerifier` is above the contract size limit, answer `n`. The committed `contracts/foundry.toml` enables size-focused optimization with `optimizer_runs = 1`; rerun the deploy from the repo after pulling this config. Do not force-broadcast oversized verifier bytecode.

1. Run the Noir tests:

```bash
cd /home/gtee/projects/veil/circuits/veil_shield_transfer
/home/gtee/.nargo/bin/nargo test

cd /home/gtee/projects/veil/circuits/veil_shield_withdraw
/home/gtee/.nargo/bin/nargo test
```

2. Compile and generate verifier artifacts:

```bash
cd /home/gtee/projects/veil/circuits/veil_shield_transfer
/home/gtee/.nargo/bin/nargo compile
/home/gtee/.bb/bb gates -b target/veil_shield_transfer.json -t evm
/home/gtee/.bb/bb write_vk -b target/veil_shield_transfer.json -o target/vk -t evm
/home/gtee/.bb/bb write_solidity_verifier -k target/vk/vk -o target/VeilShieldTransferVerifier.sol -t evm

cd /home/gtee/projects/veil/circuits/veil_shield_withdraw
/home/gtee/.nargo/bin/nargo compile
/home/gtee/.bb/bb gates -b target/veil_shield_withdraw.json -t evm
/home/gtee/.bb/bb write_vk -b target/veil_shield_withdraw.json -o target/vk -t evm
/home/gtee/.bb/bb write_solidity_verifier -k target/vk/vk -o target/VeilShieldWithdrawVerifier.sol -t evm
```

3. Update committed verifier contracts:

```bash
cd /home/gtee/projects/veil
node scripts/generate-veilshield-verifiers.mjs
```

4. Deploy on Arc Testnet:

```bash
cd /home/gtee/projects/veil/contracts
set -a && source .env && set +a
forge script script/DeployVeilShield.s.sol:DeployVeilShield --rpc-url "$ARC_TESTNET_RPC_URL" --broadcast --chain-id "$ARC_CHAIN_ID" -vvv
```

The script deploys:

- `TransferVerifier`
- `WithdrawVerifier`
- `VeilShieldVerifierAdapter`
- `VeilShield`

If redeploying, copy the logged addresses into `.env.local`:

```bash
VITE_VEIL_SHIELD_ADDRESS=<VeilShield deployed address>
VITE_VEIL_SHIELD_TRANSFER_VERIFIER_ADDRESS=<Transfer verifier deployed address>
VITE_VEIL_SHIELD_WITHDRAW_VERIFIER_ADDRESS=<Withdraw verifier deployed address>
```

Private Payment still remains blocked until Arc Private Kit integration is available, wired, tested, and audited. VeilShield remains research-only.

## Verification

Run:

```bash
npm run build
npm test
npm run lint
cd apps/api && npm run build
cd /home/gtee/projects/veil/contracts && forge test -vvv
cd /home/gtee/projects/veil/circuits/veil_shield_transfer && /home/gtee/.nargo/bin/nargo test
cd /home/gtee/projects/veil/circuits/veil_shield_withdraw && /home/gtee/.nargo/bin/nargo test
cd /home/gtee/projects/veil/circuits/veil_shield_note && /home/gtee/.nargo/bin/nargo test
cd /home/gtee/projects/veil/circuits/veil_shield_transfer_inputs && /home/gtee/.nargo/bin/nargo test
```

Static checks should show no production use of `eth_sendTransaction`, `BatchPayout`, `PaymentVault`, or native-transfer fallback code.

Private Payment transfer submission remains blocked until Arc Private Kit integration is available, wired, tested, and audited.
