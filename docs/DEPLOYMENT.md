# Deployment

## Current Arc Testnet Deployment

VeilHub is deployed on Arc Testnet and is the required on-chain route for Arc Direct open payments.

| Item | Value |
| --- | --- |
| Chain | Arc Testnet |
| Chain ID | `5042002` |
| Deployer | `0xfE84F8661D575B4fEd8BEAFcbF6b3Fa9c4f9207F` |
| Arc USDC | `0x3600000000000000000000000000000000000000` |
| VeilHub | `0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b` |

Arc Direct single and batch payments have been live-tested through this deployment. The API ledger should show those records as `source=arc_direct`, `status=settled`, with the VeilHub transaction hash plus `paymentId` or `batchId`.

## Frontend Env

Create `/home/gtee/projects/veil/.env.local` locally. Do not commit it.

```bash
VITE_API_BASE_URL=http://localhost:8787
VITE_USE_VEIL_HUB=true
VITE_VEIL_HUB_ADDRESS=0x30c77c1C20A5cBB171DE9090789F3dB98aA9734b
VITE_ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
VITE_ARC_CHAIN_ID=5042002
VITE_ARC_RPC_URL=https://rpc.testnet.arc.network
```

With these values, Arc Direct single payments call `VeilHub.payOpen`, and Arc Direct batch payments call `VeilHub.payOpenBatch`. The frontend reads USDC decimals, checks wallet USDC balance and VeilHub allowance, requests `approve` only when needed, then records the real transaction result in the API ledger.

## API Env

The local API ledger can use the default path or a local override. Do not commit API env files.

```bash
VEIL_LEDGER_PATH=./data/veil-ledger.json
```

## VeilShield Prototype Env

Closed Payment remains blocked until verifier/prover wiring is real. The frontend accepts these placeholders only to show setup state:

```bash
VITE_VEIL_SHIELD_ADDRESS=<future deployed VeilShield address>
VITE_VEIL_SHIELD_VERIFIER_ADDRESS=<future verifier or verifier-adapter address>
```

Do not set these values to placeholder or mock contracts in a production-facing environment. A configured address is not enough to enable Closed Payment; proof generation, verifier adapters, indexing, and audits are still required.

## Contract Deployment Command

The deployment script is `contracts/script/DeployVeilHub.s.sol`.

`contracts/.env` must remain local and untracked:

```bash
PRIVATE_KEY=<testnet deployer private key>
ARC_TESTNET_RPC_URL=https://rpc.testnet.arc.network
ARC_CHAIN_ID=5042002
ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

Deploy or redeploy with:

```bash
cd /home/gtee/projects/veil/contracts
set -a && source .env && set +a
forge script script/DeployVeilHub.s.sol:DeployVeilHub --rpc-url "$ARC_TESTNET_RPC_URL" --broadcast --chain-id "$ARC_CHAIN_ID" -vvv
```

Copy the `VeilHub deployed 0x...` output into `.env.local` as `VITE_VEIL_HUB_ADDRESS`.

## VeilShield Next Deployment Step

VeilShield is not deployed in this milestone. To prepare an Arc Testnet prototype:

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

3. Review generated verifier names, ABI, and public input order.
4. Add a verifier adapter if needed for `IVeilShieldVerifier`.
5. Add a Foundry deployment script and tests for the real verifier adapter plus `VeilShield`.
6. Only then deploy on Arc Testnet and configure `VITE_VEIL_SHIELD_ADDRESS`.

## Verification

Run:

```bash
npm run build
npm test
npm run lint
cd apps/api && npm run build
cd ../contracts && forge test -vvv
cd ../circuits/veil_shield_transfer && /home/gtee/.nargo/bin/nargo test
cd ../veil_shield_withdraw && /home/gtee/.nargo/bin/nargo test
```

Static checks should show no production use of `eth_sendTransaction`, `BatchPayout`, `PaymentVault`, or native-transfer fallback code.

Closed Payment remains setup-required until VeilShield + Noir/ZK verifier/prover wiring is deployed and audited.
