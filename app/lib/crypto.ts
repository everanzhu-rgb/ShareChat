const encoder = new TextEncoder();
const decoder = new TextDecoder();

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function asArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

export async function createDeviceKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson<T>(
  key: CryptoKey,
  id: string,
  value: T,
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const additionalData = encoder.encode(`qijian:local:v1:${id}`);
  const plaintext = encoder.encode(JSON.stringify(value));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData, tagLength: 128 },
    key,
    plaintext,
  );

  return {
    iv: toBase64(iv),
    ciphertext: toBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptJson<T>(
  key: CryptoKey,
  id: string,
  iv: string,
  ciphertext: string,
): Promise<T> {
  const additionalData = encoder.encode(`qijian:local:v1:${id}`);
  const decrypted = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv: asArrayBuffer(fromBase64(iv)),
      additionalData: asArrayBuffer(additionalData),
      tagLength: 128,
    },
    key,
    asArrayBuffer(fromBase64(ciphertext)),
  );
  return JSON.parse(decoder.decode(decrypted)) as T;
}
