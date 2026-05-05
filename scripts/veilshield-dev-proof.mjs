#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { randomBytes } from "node:crypto";
import { spawnSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const fieldModulus = BigInt("21888242871839275222246405745257275088548364400416034343698204186575808495617");

const projects = {
  note: join(root, "circuits/veil_shield_note"),
  transferInputs: join(root, "circuits/veil_shield_transfer_inputs"),
  transfer: join(root, "circuits/veil_shield_transfer"),
  withdraw: join(root, "circuits/veil_shield_withdraw"),
};

function usage() {
  console.log(`
VeilShield developer proof helper

Commands:
  note       Compute a deposit/withdraw note commitment and nullifier with Noir.
  transfer   Compute transfer public inputs, solve witness, and ask bb to prove.
  withdraw   Compute withdraw public inputs, solve witness, and ask bb to prove.

Examples:
  node scripts/veilshield-dev-proof.mjs note --owner 0x... --token 0x3600000000000000000000000000000000000000 --amount-base 1000000
  node scripts/veilshield-dev-proof.mjs transfer --sender 0x... --recipient 0x... --token 0x3600000000000000000000000000000000000000 --input-amount-base 1000000 --transfer-amount-base 250000 --secret 0x... --input-salt 0x... --output-salt 0x... --change-salt 0x...
  node scripts/veilshield-dev-proof.mjs withdraw --owner 0x... --token 0x3600000000000000000000000000000000000000 --amount-base 1000000 --secret 0x... --salt 0x...

This is testnet developer tooling. The browser app does not use this script, and Closed Payment submit stays blocked until a browser prover/note sync path is wired.
`.trim());
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const item = argv[i];
    if (!item.startsWith("--")) {
      args._.push(item);
      continue;
    }

    const key = item.slice(2);
    const value = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
    args[key] = value;
  }
  return args;
}

function findBinary(name, fallback) {
  if (process.env[`${name.toUpperCase()}_BIN`]) return process.env[`${name.toUpperCase()}_BIN`];
  if (existsSync(fallback)) return fallback;
  return name;
}

const nargoBin = findBinary("nargo", "/home/gtee/.nargo/bin/nargo");
const bbBin = findBinary("bb", "/home/gtee/.bb/bb");

function run(command, args, cwd) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: "pipe",
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error([
      `Command failed in ${cwd}: ${command} ${args.join(" ")}`,
      result.stdout.trim(),
      result.stderr.trim(),
    ].filter(Boolean).join("\n"));
  }

  return result.stdout.trim();
}

function requireArg(args, name) {
  const value = args[name];
  if (!value || value === "true") throw new Error(`Missing --${name}`);
  return String(value);
}

function bigintFromValue(value, label) {
  const raw = String(value).trim();
  try {
    if (raw.startsWith("0x")) return BigInt(raw);
    return BigInt(raw);
  } catch {
    throw new Error(`${label} must be an integer or hex field value.`);
  }
}

function field(value, label) {
  const n = bigintFromValue(value, label);
  if (n < 0n || n >= fieldModulus) {
    throw new Error(`${label} must fit in the Noir/BN254 field.`);
  }
  return `0x${n.toString(16).padStart(64, "0")}`;
}

function amount(value, label = "amount") {
  const n = bigintFromValue(value, label);
  if (n <= 0n || n >= 2n ** 128n) {
    throw new Error(`${label} must be a positive u128 base-unit amount.`);
  }
  return n.toString();
}

function optionalField(value) {
  return value ? field(value, "field") : randomField();
}

function randomField() {
  const bytes = randomBytes(32);
  bytes[0] &= 0x1f;
  return `0x${bytes.toString("hex")}`;
}

function tomlValue(value) {
  return `"${value}"`;
}

function writeToml(project, values) {
  const body = Object.entries(values)
    .map(([key, value]) => `${key} = ${tomlValue(value)}`)
    .join("\n");
  writeFileSync(join(project, "Prover.toml"), `${body}\n`, "utf8");
}

function parseReturnValues(project) {
  const raw = readFileSync(join(project, "Prover.toml"), "utf8");
  const match = raw.match(/^return = \[(.+)]$/m);
  if (!match) {
    const single = raw.match(/^return = "([^"]+)"$/m);
    if (single) return [single[1]];
    throw new Error(`No return values found in ${join(project, "Prover.toml")}`);
  }

  return match[1]
    .split(",")
    .map((item) => item.trim().replace(/^"|"$/g, ""));
}

function executeWithReturn(project, witnessName) {
  run(nargoBin, ["execute", witnessName, "--overwrite-return"], project);
  return parseReturnValues(project);
}

function writeVk(project, circuitName) {
  run(bbBin, [
    "write_vk",
    "-b",
    `target/${circuitName}.json`,
    "-o",
    "target/vk",
    "-t",
    "evm",
  ], project);
}

function prove(project, circuitName) {
  run(nargoBin, ["compile"], project);
  writeVk(project, circuitName);
  run(bbBin, [
    "prove",
    "-b",
    `target/${circuitName}.json`,
    "-w",
    `target/${circuitName}.gz`,
    "-k",
    "target/vk/vk",
    "-o",
    "target/proof",
    "-t",
    "evm",
    "--output_format",
    "json",
    "--verify",
  ], project);
}

function note(args) {
  const owner = field(requireArg(args, "owner"), "owner");
  const token = field(requireArg(args, "token"), "token");
  const amountBase = amount(requireArg(args, "amount-base"), "amount-base");
  const secret = optionalField(args.secret);
  const salt = optionalField(args.salt);

  writeToml(projects.note, {
    owner,
    token,
    amount: amountBase,
    secret,
    salt,
  });

  const [commitment, nullifier] = executeWithReturn(projects.note, "veil_shield_note");

  console.log(JSON.stringify({
    owner,
    token,
    amountBase,
    secret,
    salt,
    commitment,
    nullifier,
    proverToml: join(projects.note, "Prover.toml"),
  }, null, 2));
}

function transfer(args) {
  const sender = field(requireArg(args, "sender"), "sender");
  const recipient = field(requireArg(args, "recipient"), "recipient");
  const token = field(requireArg(args, "token"), "token");
  const inputAmount = amount(requireArg(args, "input-amount-base"), "input-amount-base");
  const transferAmount = amount(requireArg(args, "transfer-amount-base"), "transfer-amount-base");
  const inputAmountBig = BigInt(inputAmount);
  const transferAmountBig = BigInt(transferAmount);
  if (transferAmountBig > inputAmountBig) throw new Error("transfer amount cannot exceed input amount.");
  const changeAmount = (inputAmountBig - transferAmountBig).toString();
  const secret = field(requireArg(args, "secret"), "secret");
  const inputSalt = field(requireArg(args, "input-salt"), "input-salt");
  const outputSalt = optionalField(args["output-salt"]);
  const changeSalt = optionalField(args["change-salt"]);

  const transferBaseValues = {
    input_amount: inputAmount,
    transfer_amount: transferAmount,
    change_amount: changeAmount,
    secret,
    input_salt: inputSalt,
    output_salt: outputSalt,
    change_salt: changeSalt,
    sender,
    recipient,
    token,
  };

  writeToml(projects.transferInputs, transferBaseValues);
  const [inputCommitment, outputCommitment, changeCommitment, nullifier] =
    executeWithReturn(projects.transferInputs, "veil_shield_transfer_inputs");

  const prover = {
    ...transferBaseValues,
    input_commitment: inputCommitment,
    output_commitment: outputCommitment,
    change_commitment: changeCommitment,
    nullifier_hash: nullifier,
  };

  writeToml(projects.transfer, prover);
  run(nargoBin, ["execute"], projects.transfer);
  prove(projects.transfer, "veil_shield_transfer");

  console.log(JSON.stringify({
    publicInputs: {
      sender,
      recipient,
      token,
      inputCommitment,
      outputCommitment,
      changeCommitment,
      nullifier,
    },
    privateInputs: {
      inputAmount,
      transferAmount,
      changeAmount,
      secret,
      inputSalt,
      outputSalt,
      changeSalt,
    },
    proofPath: join(projects.transfer, "target/proof"),
    witnessPath: join(projects.transfer, "target/veil_shield_transfer.gz"),
    proverToml: join(projects.transfer, "Prover.toml"),
  }, null, 2));
}

function withdraw(args) {
  const owner = field(requireArg(args, "owner"), "owner");
  const token = field(requireArg(args, "token"), "token");
  const amountBase = amount(requireArg(args, "amount-base"), "amount-base");
  const secret = field(requireArg(args, "secret"), "secret");
  const salt = field(requireArg(args, "salt"), "salt");

  writeToml(projects.note, {
    owner,
    token,
    amount: amountBase,
    secret,
    salt,
  });
  const [commitment, nullifier] = executeWithReturn(projects.note, "veil_shield_note");

  writeToml(projects.withdraw, {
    amount: amountBase,
    secret,
    salt,
    owner,
    token,
    commitment,
    nullifier_hash: nullifier,
    withdraw_amount: amountBase,
  });
  run(nargoBin, ["execute"], projects.withdraw);
  prove(projects.withdraw, "veil_shield_withdraw");

  console.log(JSON.stringify({
    publicInputs: {
      owner,
      token,
      commitment,
      nullifier,
      withdrawAmount: amountBase,
    },
    privateInputs: {
      amount: amountBase,
      secret,
      salt,
    },
    proofPath: join(projects.withdraw, "target/proof"),
    witnessPath: join(projects.withdraw, "target/veil_shield_withdraw.gz"),
    proverToml: join(projects.withdraw, "Prover.toml"),
  }, null, 2));
}

try {
  const args = parseArgs(process.argv.slice(2));
  const command = args._[0];

  if (!command || command === "help" || command === "--help") {
    usage();
    process.exit(command ? 0 : 1);
  }

  if (command === "note") note(args);
  else if (command === "transfer") transfer(args);
  else if (command === "withdraw") withdraw(args);
  else throw new Error(`Unknown command: ${command}`);
} catch (err) {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
}
