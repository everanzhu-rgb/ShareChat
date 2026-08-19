import { describe, expect, it } from "vitest";
import {
  buildAad,
  createRecoveryPhrase,
  decryptObject,
  encryptObject,
  generateEncryptionKeyPair,
  generateSigningKeyPair,
  openSealedKey,
  randomKey,
  safetyPhraseFingerprint,
  sealKey,
  signEnvelope,
  validateRecoveryPhrase,
  verifyEnvelope,
} from "./index";

describe("栖笺生产加密协议", () => {
  it("使用 XChaCha20-Poly1305 绑定对象上下文", async () => {
    const key = await randomKey();
    const aad = buildAad({ objectType: "entry", objectId: "e1", scopeId: "couple-1", revision: 1, keyVersion: 1 });
    const envelope = await encryptObject({ body: "只有我们看到" }, key, aad);
    await expect(decryptObject(envelope, key, aad)).resolves.toEqual({ body: "只有我们看到" });

    const wrongAad = buildAad({ objectType: "entry", objectId: "e2", scopeId: "couple-1", revision: 1, keyVersion: 1 });
    await expect(decryptObject(envelope, key, wrongAad)).rejects.toThrow();
  });

  it("可以为接收者封装数据密钥", async () => {
    const recipient = await generateEncryptionKeyPair();
    const key = await randomKey();
    const sealed = await sealKey(key, recipient.publicKey);
    const opened = await openSealedKey(sealed, recipient.publicKey, recipient.privateKey);
    expect(Array.from(opened)).toEqual(Array.from(key));
  });

  it("签名可以发现 envelope 被替换", async () => {
    const signer = await generateSigningKeyPair();
    const envelope = "sealed-key-envelope";
    const signature = await signEnvelope(envelope, signer.privateKey);
    await expect(verifyEnvelope(envelope, signature, signer.publicKey)).resolves.toBe(true);
    await expect(verifyEnvelope(`${envelope}-changed`, signature, signer.publicKey)).resolves.toBe(false);
  });

  it("生成有校验的 24 词恢复短语", async () => {
    const phrase = await createRecoveryPhrase();
    expect(phrase.split(" ")).toHaveLength(24);
    expect(validateRecoveryPhrase(phrase)).toBe(true);
    expect(validateRecoveryPhrase(`${phrase} wrong`)).toBe(false);
  });

  it("双方公钥顺序不影响安全短语", async () => {
    const a = await generateEncryptionKeyPair();
    const b = await generateEncryptionKeyPair();
    await expect(safetyPhraseFingerprint(a.publicKey, b.publicKey, "couple-1")).resolves.toBe(
      await safetyPhraseFingerprint(b.publicKey, a.publicKey, "couple-1"),
    );
  });
});
