import { afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  _resetKeyCacheForTests,
  decryptField,
  encryptField,
  lastFourSsn,
} from "./crypto";

function randomB64Key(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

describe("convex/lib/crypto", () => {
  beforeAll(() => {
    process.env.PHI_ENCRYPTION_KEY = randomB64Key();
  });

  afterEach(() => {
    _resetKeyCacheForTests();
  });

  it("round-trips ASCII plaintext", async () => {
    const ct = await encryptField("123-45-6789");
    expect(ct).not.toContain("123-45-6789");
    expect(await decryptField(ct)).toBe("123-45-6789");
  });

  it("round-trips unicode plaintext", async () => {
    const plaintext = "María López — DOB 1948-07-19";
    const ct = await encryptField(plaintext);
    expect(await decryptField(ct)).toBe(plaintext);
  });

  it("produces different ciphertexts for the same plaintext (random IV)", async () => {
    const a = await encryptField("123-45-6789");
    const b = await encryptField("123-45-6789");
    expect(a).not.toBe(b);
  });

  it("rejects empty plaintext at encrypt time", async () => {
    await expect(encryptField("")).rejects.toThrow();
  });

  it("rejects tampered ciphertext", async () => {
    const ct = await encryptField("123-45-6789");
    const tampered = ct.slice(0, -4) + "AAAA";
    await expect(decryptField(tampered)).rejects.toThrow();
  });

  it("requires a key to be configured", async () => {
    const prev = process.env.PHI_ENCRYPTION_KEY;
    delete process.env.PHI_ENCRYPTION_KEY;
    _resetKeyCacheForTests();
    await expect(encryptField("hi")).rejects.toThrow(/PHI_ENCRYPTION_KEY/);
    process.env.PHI_ENCRYPTION_KEY = prev;
  });

  it("rejects keys that don't decode to 32 bytes", async () => {
    process.env.PHI_ENCRYPTION_KEY = "shortkey";
    _resetKeyCacheForTests();
    await expect(encryptField("hi")).rejects.toThrow(/32 bytes/);
  });

  it("masks all but the last four digits of an SSN", () => {
    expect(lastFourSsn("123-45-6789")).toBe("***-**-6789");
    expect(lastFourSsn("123456789")).toBe("***-**-6789");
    expect(lastFourSsn("12")).toBe("***-**-****");
  });
});
