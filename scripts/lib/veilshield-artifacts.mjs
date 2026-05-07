import { readFileSync } from "node:fs";

export const ZERO_BYTES32 = `0x${"0".repeat(64)}`;
export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARTIFACT_VERSION = 1;

const hex32Pattern = /^0x[a-fA-F0-9]{64}$/;
const bytesPattern = /^0x([a-fA-F0-9]{2})*$/;
const addressPattern = /^0x[a-fA-F0-9]{40}$/;

export function isHex32(value) {
  return typeof value === "string" && hex32Pattern.test(value);
}

export function isBytes(value) {
  return typeof value === "string" && bytesPattern.test(value);
}

export function isAddress(value) {
  return typeof value === "string" && addressPattern.test(value);
}

export function normalizeHex(value) {
  return typeof value === "string" ? `0x${value.replace(/^0x/i, "").toLowerCase()}` : value;
}

export function addressToField(address) {
  if (!isAddress(address)) throw new Error(`Invalid address: ${address}`);
  return `0x${address.slice(2).toLowerCase().padStart(64, "0")}`;
}

export function fieldToAddress(field, label = "field") {
  if (!isHex32(field)) throw new Error(`${label} must be a bytes32 field value.`);
  const clean = field.slice(2).toLowerCase();
  const high = clean.slice(0, 24);
  if (high !== "0".repeat(24)) {
    throw new Error(`${label} is not an EVM address field.`);
  }
  return `0x${clean.slice(24)}`;
}

export function amountBaseToDisplay(value, decimals = 6) {
  const base = BigInt(value);
  const divisor = 10n ** BigInt(decimals);
  const whole = base / divisor;
  const fraction = base % divisor;
  const fractional = fraction.toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractional ? `${whole}.${fractional}` : whole.toString();
}

export function proofFieldsToBytes(fields) {
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error("Proof fields must be a non-empty array.");
  }

  for (const [index, field] of fields.entries()) {
    if (!isHex32(field)) throw new Error(`Proof field ${index} must be bytes32.`);
  }

  return `0x${fields.map((field) => field.slice(2)).join("")}`;
}

export function readBbProof(proofDir) {
  const proofJson = JSON.parse(readFileSync(`${proofDir}/proof.json`, "utf8"));
  const publicInputsJson = JSON.parse(readFileSync(`${proofDir}/public_inputs.json`, "utf8"));
  const fields = proofJson.proof;
  const publicInputs = publicInputsJson.public_inputs;

  return {
    fields,
    bytes: proofFieldsToBytes(fields),
    publicInputs,
    bbVersion: proofJson.bb_version || publicInputsJson.bb_version,
    scheme: proofJson.scheme || publicInputsJson.scheme,
  };
}

export function assertPublicInputs(actual, expected, label) {
  if (!Array.isArray(actual)) throw new Error(`${label} public inputs must be an array.`);
  if (actual.length !== expected.length) {
    throw new Error(`${label} public input length mismatch: expected ${expected.length}, got ${actual.length}.`);
  }

  actual.forEach((item, index) => {
    if (normalizeHex(item) !== normalizeHex(expected[index])) {
      throw new Error(`${label} public input ${index} mismatch.`);
    }
  });
}

export function makeTransferArtifact(input) {
  const proof = input.proof;
  const publicInputs = [
    input.sender,
    input.recipient,
    input.token,
    input.inputCommitment,
    input.outputCommitment,
    input.changeCommitment,
    input.nullifier,
  ];
  assertPublicInputs(proof.publicInputs, publicInputs, "transfer");

  const senderAddress = input.senderAddress || fieldToAddress(input.sender, "sender");
  const recipientAddress = input.recipientAddress || fieldToAddress(input.recipient, "recipient");
  const tokenAddress = input.tokenAddress || fieldToAddress(input.token, "token");

  return {
    artifactVersion: ARTIFACT_VERSION,
    kind: "transfer",
    network: {
      name: "Arc Testnet",
      chainId: input.chainId || ARC_TESTNET_CHAIN_ID,
    },
    contract: {
      veilShield: input.veilShield || "",
      functionName: "transferNote",
      token: tokenAddress,
    },
    proof: {
      encoding: "bb-proof-field-array-concat",
      bytes: proof.bytes,
      fields: proof.fields,
      bbVersion: proof.bbVersion,
      scheme: proof.scheme,
    },
    publicInputs: {
      ordered: publicInputs,
      sender: input.sender,
      senderAddress,
      recipient: input.recipient,
      recipientAddress,
      token: input.token,
      tokenAddress,
      inputCommitment: input.inputCommitment,
      outputCommitment: input.outputCommitment,
      changeCommitment: input.changeCommitment,
      nullifier: input.nullifier,
      encryptedNoteRef: input.encryptedNoteRef || ZERO_BYTES32,
    },
    contractCall: {
      functionName: "transferNote",
      args: {
        nullifierHash: input.nullifier,
        inputNoteCommitment: input.inputCommitment,
        outputNoteCommitment: input.outputCommitment,
        changeNoteCommitment: input.changeCommitment,
        encryptedNoteRef: input.encryptedNoteRef || ZERO_BYTES32,
        recipient: recipientAddress,
      },
    },
    localPrivate: {
      inputAmountBase: input.inputAmount,
      transferAmountBase: input.transferAmount,
      changeAmountBase: input.changeAmount,
      secret: input.secret,
      inputSalt: input.inputSalt,
      outputSalt: input.outputSalt,
      changeSalt: input.changeSalt,
    },
    ledger: {
      source: "veilshield_closed",
      operation: "shield_transfer",
      amountHidden: true,
      amount: "hidden",
      amountBase: "0",
      token: "USDC",
    },
  };
}

export function makeWithdrawArtifact(input) {
  const proof = input.proof;
  const publicInputs = [
    input.owner,
    input.token,
    input.commitment,
    input.nullifier,
    input.withdrawAmountField,
  ];
  assertPublicInputs(proof.publicInputs, publicInputs, "withdraw");

  const ownerAddress = input.ownerAddress || fieldToAddress(input.owner, "owner");
  const tokenAddress = input.tokenAddress || fieldToAddress(input.token, "token");
  const recipientAddress = input.recipientAddress || ownerAddress;

  return {
    artifactVersion: ARTIFACT_VERSION,
    kind: "withdraw",
    network: {
      name: "Arc Testnet",
      chainId: input.chainId || ARC_TESTNET_CHAIN_ID,
    },
    contract: {
      veilShield: input.veilShield || "",
      functionName: "withdraw",
      token: tokenAddress,
    },
    proof: {
      encoding: "bb-proof-field-array-concat",
      bytes: proof.bytes,
      fields: proof.fields,
      bbVersion: proof.bbVersion,
      scheme: proof.scheme,
    },
    publicInputs: {
      ordered: publicInputs,
      owner: input.owner,
      ownerAddress,
      recipientAddress,
      token: input.token,
      tokenAddress,
      commitment: input.commitment,
      nullifier: input.nullifier,
      withdrawAmountBase: input.amount,
      withdrawAmountField: input.withdrawAmountField,
    },
    contractCall: {
      functionName: "withdraw",
      args: {
        nullifierHash: input.nullifier,
        noteCommitment: input.commitment,
        recipient: recipientAddress,
        amount: input.amount,
      },
    },
    localPrivate: {
      amountBase: input.amount,
      secret: input.secret,
      salt: input.salt,
    },
    ledger: {
      source: "veilshield_closed",
      operation: "shield_withdraw",
      amountHidden: false,
      amount: amountBaseToDisplay(input.amount),
      amountBase: input.amount,
      token: "USDC",
    },
  };
}

function requireKind(artifact, expected) {
  if (!artifact || typeof artifact !== "object") throw new Error("Artifact must be an object.");
  if (artifact.artifactVersion !== ARTIFACT_VERSION) throw new Error("Unsupported artifact version.");
  if (artifact.kind !== expected) throw new Error(`Expected ${expected} artifact.`);
}

function validateCommonArtifact(artifact) {
  if (!artifact.proof || artifact.proof.encoding !== "bb-proof-field-array-concat") {
    throw new Error("Artifact proof encoding is unsupported.");
  }
  if (!isBytes(artifact.proof.bytes) || artifact.proof.bytes.length <= 2) {
    throw new Error("Artifact proof bytes are missing or invalid.");
  }
  if (proofFieldsToBytes(artifact.proof.fields) !== normalizeHex(artifact.proof.bytes)) {
    throw new Error("Artifact proof bytes do not match proof fields.");
  }
  if (!Array.isArray(artifact.publicInputs?.ordered)) {
    throw new Error("Artifact public input order is missing.");
  }
}

export function validateTransferArtifact(artifact) {
  requireKind(artifact, "transfer");
  validateCommonArtifact(artifact);

  const p = artifact.publicInputs;
  const expected = [
    p.sender,
    p.recipient,
    p.token,
    p.inputCommitment,
    p.outputCommitment,
    p.changeCommitment,
    p.nullifier,
  ];

  expected.forEach((value, index) => {
    if (!isHex32(value)) throw new Error(`Transfer public input ${index} must be bytes32.`);
  });
  assertPublicInputs(p.ordered, expected, "transfer artifact");

  if (fieldToAddress(p.sender, "sender") !== normalizeHex(p.senderAddress)) {
    throw new Error("Transfer artifact sender address does not match sender field.");
  }
  if (fieldToAddress(p.recipient, "recipient") !== normalizeHex(p.recipientAddress)) {
    throw new Error("Transfer artifact recipient address does not match recipient field.");
  }
  if (fieldToAddress(p.token, "token") !== normalizeHex(p.tokenAddress)) {
    throw new Error("Transfer artifact token address does not match token field.");
  }
  if (!isHex32(p.encryptedNoteRef)) throw new Error("Transfer encrypted note reference must be bytes32.");

  return artifact;
}

export function validateWithdrawArtifact(artifact) {
  requireKind(artifact, "withdraw");
  validateCommonArtifact(artifact);

  const p = artifact.publicInputs;
  const expected = [
    p.owner,
    p.token,
    p.commitment,
    p.nullifier,
    p.withdrawAmountField,
  ];

  expected.forEach((value, index) => {
    if (!isHex32(value)) throw new Error(`Withdraw public input ${index} must be bytes32.`);
  });
  assertPublicInputs(p.ordered, expected, "withdraw artifact");

  if (fieldToAddress(p.owner, "owner") !== normalizeHex(p.ownerAddress)) {
    throw new Error("Withdraw artifact owner address does not match owner field.");
  }
  if (fieldToAddress(p.token, "token") !== normalizeHex(p.tokenAddress)) {
    throw new Error("Withdraw artifact token address does not match token field.");
  }
  if (!isAddress(p.recipientAddress)) throw new Error("Withdraw artifact recipient address is invalid.");

  return artifact;
}

export function readArtifact(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}
