import sodium from "libsodium-wrappers-sumo";
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from "@scure/bip39";
import { wordlist } from "@scure/bip39/wordlists/english.js";

export const CRYPTO_PROTOCOL_VERSION = 1;

export interface CipherEnvelope {
  version: 1;
  algorithm: "xchacha20poly1305-ietf";
  nonce: string;
  ciphertext: string;
}

export interface SigningKeyPair {
  publicKey: string;
  privateKey: string;
}

export interface EncryptionKeyPair {
  publicKey: string;
  privateKey: string;
}

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function ready() {
  await sodium.ready;
  return sodium;
}

function bytesToBase64(bytes: Uint8Array): string {
  return sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
}

function base64ToBytes(value: string): Uint8Array {
  return sodium.from_base64(value, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export function buildAad(input: {
  objectType: string;
  objectId: string;
  scopeId: string;
  revision: number;
  keyVersion: number;
  chunkIndex?: number;
}): Uint8Array {
  const normalized = [
    `qijian-v${CRYPTO_PROTOCOL_VERSION}`,
    input.objectType,
    input.objectId,
    input.scopeId,
    input.revision.toString(),
    input.keyVersion.toString(),
    input.chunkIndex?.toString() ?? "-",
  ].join(":");
  return encoder.encode(normalized);
}

export async function randomKey(): Promise<Uint8Array> {
  const lib = await ready();
  return lib.randombytes_buf(lib.crypto_aead_xchacha20poly1305_ietf_KEYBYTES);
}

export async function encryptObject(
  value: unknown,
  key: Uint8Array,
  aad: Uint8Array,
): Promise<CipherEnvelope> {
  const lib = await ready();
  const nonce = lib.randombytes_buf(lib.crypto_aead_xchacha20poly1305_ietf_NPUBBYTES);
  const ciphertext = lib.crypto_aead_xchacha20poly1305_ietf_encrypt(
    encoder.encode(JSON.stringify(value)),
    aad,
    null,
    nonce,
    key,
  );
  return {
    version: 1,
    algorithm: "xchacha20poly1305-ietf",
    nonce: bytesToBase64(nonce),
    ciphertext: bytesToBase64(ciphertext),
  };
}

export async function decryptObject<T>(
  envelope: CipherEnvelope,
  key: Uint8Array,
  aad: Uint8Array,
): Promise<T> {
  const lib = await ready();
  if (envelope.version !== 1 || envelope.algorithm !== "xchacha20poly1305-ietf") {
    throw new Error("UNSUPPORTED_CRYPTO_VERSION");
  }
  const plaintext = lib.crypto_aead_xchacha20poly1305_ietf_decrypt(
    null,
    base64ToBytes(envelope.ciphertext),
    aad,
    base64ToBytes(envelope.nonce),
    key,
  );
  return JSON.parse(decoder.decode(plaintext)) as T;
}

export async function generateEncryptionKeyPair(): Promise<EncryptionKeyPair> {
  const lib = await ready();
  const keys = lib.crypto_box_keypair();
  return { publicKey: bytesToBase64(keys.publicKey), privateKey: bytesToBase64(keys.privateKey) };
}

export async function sealKey(dataKey: Uint8Array, recipientPublicKey: string): Promise<string> {
  const lib = await ready();
  return bytesToBase64(lib.crypto_box_seal(dataKey, base64ToBytes(recipientPublicKey)));
}

export async function openSealedKey(
  envelope: string,
  recipientPublicKey: string,
  recipientPrivateKey: string,
): Promise<Uint8Array> {
  const lib = await ready();
  return lib.crypto_box_seal_open(
    base64ToBytes(envelope),
    base64ToBytes(recipientPublicKey),
    base64ToBytes(recipientPrivateKey),
  );
}

export async function generateSigningKeyPair(): Promise<SigningKeyPair> {
  const lib = await ready();
  const keys = lib.crypto_sign_keypair();
  return { publicKey: bytesToBase64(keys.publicKey), privateKey: bytesToBase64(keys.privateKey) };
}

export async function signEnvelope(envelope: string, privateKey: string): Promise<string> {
  const lib = await ready();
  return bytesToBase64(lib.crypto_sign_detached(encoder.encode(envelope), base64ToBytes(privateKey)));
}

export async function verifyEnvelope(
  envelope: string,
  signature: string,
  publicKey: string,
): Promise<boolean> {
  const lib = await ready();
  return lib.crypto_sign_verify_detached(
    base64ToBytes(signature),
    encoder.encode(envelope),
    base64ToBytes(publicKey),
  );
}

export async function createRecoveryPhrase(): Promise<string> {
  const lib = await ready();
  return entropyToMnemonic(lib.randombytes_buf(32), wordlist);
}

export function validateRecoveryPhrase(phrase: string): boolean {
  return validateMnemonic(phrase.trim().toLowerCase(), wordlist);
}

export function recoveryEntropy(phrase: string): Uint8Array {
  if (!validateRecoveryPhrase(phrase)) throw new Error("INVALID_RECOVERY_PHRASE");
  return mnemonicToEntropy(phrase.trim().toLowerCase(), wordlist);
}

export async function safetyPhraseFingerprint(
  firstPublicKey: string,
  secondPublicKey: string,
  coupleSpaceId: string,
): Promise<string> {
  const lib = await ready();
  const keys = [firstPublicKey, secondPublicKey].sort().join(":");
  const digest = lib.crypto_generichash(
    12,
    encoder.encode(`qijian-safety-v1:${coupleSpaceId}:${keys}`),
    null,
  );
  return Array.from(digest)
    .map((byte) => byte.toString(10).padStart(3, "0"))
    .join(" ")
    .match(/.{1,15}/g)!
    .join(" · ");
}
