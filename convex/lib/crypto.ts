/**
 * Field-level encryption helpers for PHI (SSN, full DOB).
 *
 * Algorithm: AES-256-GCM, 12-byte random IV, 16-byte auth tag.
 * Wire format: base64( IV (12) || AUTH_TAG (16) || CIPHERTEXT ).
 *
 * The key is read from `PHI_ENCRYPTION_KEY` (base64-encoded 32 bytes). It must be
 * set via Convex environment variables (`npx convex env set PHI_ENCRYPTION_KEY ...`)
 * — never hard-coded, never committed.
 *
 * Implemented with WebCrypto so the same module runs in Convex's V8 runtime,
 * Node 20 (jsdom test env), and the browser (where it must NEVER be called —
 * server-only contract enforced by callers).
 *
 * Rotation plan (deferred, but the data layout supports it): when we rotate, we
 * re-encrypt every ciphertext through a backfill action; both old and new
 * ciphertexts are tagged with a key id once rotation lands.
 */

const ALG = "AES-GCM";
const IV_LENGTH = 12;
const TAG_LENGTH_BITS = 128; // 16 bytes
const KEY_LENGTH_BYTES = 32;

let cachedKey: CryptoKey | null = null;
let cachedKeyMaterialB64: string | null = null;

function readKeyMaterial(): string {
  const raw = process.env.PHI_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("PHI_ENCRYPTION_KEY is not set; refusing to handle PHI.");
  }
  return raw;
}

async function getKey(): Promise<CryptoKey> {
  const materialB64 = readKeyMaterial();
  if (cachedKey && cachedKeyMaterialB64 === materialB64) {
    return cachedKey;
  }
  const bytes = base64ToBytes(materialB64);
  if (bytes.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `PHI_ENCRYPTION_KEY must decode to ${KEY_LENGTH_BYTES} bytes (got ${bytes.length}).`,
    );
  }
  cachedKey = await crypto.subtle.importKey("raw", bytes, ALG, false, [
    "encrypt",
    "decrypt",
  ]);
  cachedKeyMaterialB64 = materialB64;
  return cachedKey;
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(b64, "base64"));
  }
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(bytes).toString("base64");
  }
  let bin = "";
  for (const byte of bytes) bin += String.fromCharCode(byte);
  return btoa(bin);
}

/**
 * Encrypts a plaintext string and returns the wire-format ciphertext.
 * Throws if `plaintext` is empty (always a programmer error — caller should not
 * persist a placeholder for an absent field; use `undefined` instead).
 */
export async function encryptField(plaintext: string): Promise<string> {
  if (typeof plaintext !== "string" || plaintext.length === 0) {
    throw new Error("encryptField requires a non-empty string.");
  }
  const key = await getKey();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const ctBuf = await crypto.subtle.encrypt(
    { name: ALG, iv, tagLength: TAG_LENGTH_BITS },
    key,
    new TextEncoder().encode(plaintext),
  );
  const ct = new Uint8Array(ctBuf);
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv, 0);
  out.set(ct, iv.length);
  return bytesToBase64(out);
}

/**
 * Decrypts a wire-format ciphertext back to plaintext. Throws on tampered or
 * truncated input (WebCrypto rejects the auth-tag mismatch).
 */
export async function decryptField(wire: string): Promise<string> {
  const bytes = base64ToBytes(wire);
  if (bytes.length <= IV_LENGTH + TAG_LENGTH_BITS / 8) {
    throw new Error("Ciphertext too short.");
  }
  const iv = bytes.subarray(0, IV_LENGTH);
  const ctAndTag = bytes.subarray(IV_LENGTH);
  const key = await getKey();
  const ptBuf = await crypto.subtle.decrypt(
    { name: ALG, iv, tagLength: TAG_LENGTH_BITS },
    key,
    ctAndTag,
  );
  return new TextDecoder().decode(ptBuf);
}

/**
 * UI-safe rendering of an SSN: "***-**-1234". Caller must already hold the
 * decrypted plaintext; this helper does no decryption itself.
 */
export function lastFourSsn(plain: string): string {
  const digits = plain.replace(/\D/g, "");
  return digits.length >= 4 ? `***-**-${digits.slice(-4)}` : "***-**-****";
}

/** For test reset only — the production code path caches per key material. */
export function _resetKeyCacheForTests(): void {
  cachedKey = null;
  cachedKeyMaterialB64 = null;
}
