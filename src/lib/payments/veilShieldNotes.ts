import { ARC_USDC_ADDRESS } from "@/lib/env";

const NOTE_INDEX_PREFIX = "veil.veilshield.preview.notes";
const NOTE_KEY_STORAGE = "veil.veilshield.preview.local-key";
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export type VeilShieldNoteStatus = "prepared" | "deposited" | "spent" | "withdrawn";

export type EncryptedVeilShieldNote = {
  id: string;
  owner: string;
  token: string;
  commitment: `0x${string}`;
  encryptedNoteRef: `0x${string}`;
  status: VeilShieldNoteStatus;
  createdAt: string;
  updatedAt: string;
  depositTxHash?: string;
  transferTxHash?: string;
  withdrawTxHash?: string;
  encryptedPayload: {
    version: 1;
    algorithm: "AES-GCM";
    iv: string;
    ciphertext: string;
  };
};

export type DecryptedVeilShieldNote = EncryptedVeilShieldNote & {
  amount: string;
  amountBase: string;
  decimals: number;
  secret: `0x${string}`;
  salt: `0x${string}`;
  nullifier?: `0x${string}`;
};

type NotePayload = {
  amount: string;
  amountBase: string;
  decimals: number;
  secret: `0x${string}`;
  salt: `0x${string}`;
  nullifier?: `0x${string}`;
};

function storageKey(owner: string) {
  return `${NOTE_INDEX_PREFIX}.${owner.toLowerCase()}`;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function randomNoirField(): `0x${string}` {
  const bytes = randomBytes(32);
  bytes[0] &= 0x1f;
  return `0x${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

export function randomBytes32(): `0x${string}` {
  const bytes = randomBytes(32);
  return `0x${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function getLocalKey() {
  let raw = localStorage.getItem(NOTE_KEY_STORAGE);
  if (!raw) {
    raw = bytesToBase64(randomBytes(32));
    localStorage.setItem(NOTE_KEY_STORAGE, raw);
  }

  return crypto.subtle.importKey(
    "raw",
    base64ToBytes(raw),
    "AES-GCM",
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPayload(payload: NotePayload) {
  const key = await getLocalKey();
  const iv = randomBytes(12);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    textEncoder.encode(JSON.stringify(payload))
  );

  return {
    version: 1 as const,
    algorithm: "AES-GCM" as const,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

async function decryptPayload(note: EncryptedVeilShieldNote): Promise<NotePayload> {
  const key = await getLocalKey();
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(note.encryptedPayload.iv) },
    key,
    base64ToBytes(note.encryptedPayload.ciphertext)
  );

  return JSON.parse(textDecoder.decode(plaintext)) as NotePayload;
}

function readEncryptedNotes(owner: string): EncryptedVeilShieldNote[] {
  try {
    const raw = localStorage.getItem(storageKey(owner));
    return raw ? JSON.parse(raw) as EncryptedVeilShieldNote[] : [];
  } catch {
    return [];
  }
}

function writeEncryptedNotes(owner: string, notes: EncryptedVeilShieldNote[]) {
  localStorage.setItem(storageKey(owner), JSON.stringify(notes));
}

export function buildNoirNoteCommand(input: {
  owner: string;
  token?: string;
  amountBase: string;
  secret: string;
  salt: string;
}) {
  return [
    "node scripts/veilshield-dev-proof.mjs note",
    `--owner ${input.owner}`,
    `--token ${input.token || ARC_USDC_ADDRESS}`,
    `--amount-base ${input.amountBase}`,
    `--secret ${input.secret}`,
    `--salt ${input.salt}`,
  ].join(" ");
}

export function buildNoirTransferCommand(input: {
  sender: string;
  recipient: string;
  token?: string;
  inputAmountBase: string;
  transferAmountBase: string;
  secret: string;
  inputSalt: string;
  outputSalt: string;
  changeSalt: string;
}) {
  return [
    "node scripts/veilshield-dev-proof.mjs transfer",
    `--sender ${input.sender}`,
    `--recipient ${input.recipient}`,
    `--token ${input.token || ARC_USDC_ADDRESS}`,
    `--input-amount-base ${input.inputAmountBase}`,
    `--transfer-amount-base ${input.transferAmountBase}`,
    `--secret ${input.secret}`,
    `--input-salt ${input.inputSalt}`,
    `--output-salt ${input.outputSalt}`,
    `--change-salt ${input.changeSalt}`,
  ].join(" ");
}

export async function savePreparedVeilShieldNote(input: {
  owner: string;
  amount: string;
  amountBase: string;
  decimals: number;
  commitment: `0x${string}`;
  encryptedNoteRef: `0x${string}`;
  secret: `0x${string}`;
  salt: `0x${string}`;
  nullifier?: `0x${string}`;
  depositTxHash?: string;
}) {
  const now = new Date().toISOString();
  const encryptedPayload = await encryptPayload({
    amount: input.amount,
    amountBase: input.amountBase,
    decimals: input.decimals,
    secret: input.secret,
    salt: input.salt,
    nullifier: input.nullifier,
  });

  const note: EncryptedVeilShieldNote = {
    id: `shield_note_${Date.now()}_${input.commitment.slice(2, 10)}`,
    owner: input.owner,
    token: ARC_USDC_ADDRESS,
    commitment: input.commitment,
    encryptedNoteRef: input.encryptedNoteRef,
    status: input.depositTxHash ? "deposited" : "prepared",
    createdAt: now,
    updatedAt: now,
    depositTxHash: input.depositTxHash,
    encryptedPayload,
  };

  const notes = readEncryptedNotes(input.owner)
    .filter((item) => item.commitment.toLowerCase() !== input.commitment.toLowerCase());
  notes.unshift(note);
  writeEncryptedNotes(input.owner, notes);
  return note;
}

export async function listVeilShieldNotes(owner?: string): Promise<DecryptedVeilShieldNote[]> {
  if (!owner) return [];

  const encrypted = readEncryptedNotes(owner);
  const decrypted = await Promise.all(
    encrypted.map(async (note) => {
      const payload = await decryptPayload(note);
      return { ...note, ...payload };
    })
  );

  return decrypted.sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
}

export function getShieldedNoteBalance(notes: DecryptedVeilShieldNote[]) {
  return notes
    .filter((note) => note.status === "deposited")
    .reduce((sum, note) => sum + Number(note.amount || "0"), 0);
}
