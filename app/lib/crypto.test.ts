import { describe, expect, it } from "vitest";
import { createDeviceKey, decryptJson, encryptJson } from "./crypto";

describe("本机加密保险箱", () => {
  it("可以加密并恢复结构化手记", async () => {
    const key = await createDeviceKey();
    const value = { title: "雨停以前", body: "一段只在设备解锁后出现的文字" };
    const encrypted = await encryptJson(key, "entry-1", value);

    expect(encrypted.ciphertext).not.toContain(value.body);
    await expect(
      decryptJson<typeof value>(key, "entry-1", encrypted.iv, encrypted.ciphertext),
    ).resolves.toEqual(value);
  });

  it("拒绝把密文调换到另一个对象", async () => {
    const key = await createDeviceKey();
    const encrypted = await encryptJson(key, "entry-1", { body: "私密内容" });

    await expect(
      decryptJson(key, "entry-2", encrypted.iv, encrypted.ciphertext),
    ).rejects.toThrow();
  });

  it("拒绝被篡改的密文", async () => {
    const key = await createDeviceKey();
    const encrypted = await encryptJson(key, "entry-1", { body: "私密内容" });
    const tampered = `${encrypted.ciphertext.slice(0, -2)}AA`;

    await expect(
      decryptJson(key, "entry-1", encrypted.iv, tampered),
    ).rejects.toThrow();
  });
});
