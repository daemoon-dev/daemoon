/* Daemoon token vault — envelope encryption.
 *
 * Threat model:
 *   - A full DB leak must not expose plaintext tokens (= unusable without the env master key).
 *   - A master key leak must only affect some tokens (= per-token DEK).
 *
 * Envelope pattern:
 *   1. Generate a fresh 32-byte *Data Encryption Key (DEK)* per token.
 *   2. Encrypt the token body with *DEK + AES-256-GCM* → ciphertext.
 *   3. Encrypt the DEK with *master key + AES-256-GCM* → wrappedDek.
 *   4. Store in DB: { ciphertext, iv1, tag1, wrappedDek, iv2, tag2 }.
 *   5. Decrypt: master → DEK → token.
 *
 * Key rotation:
 *   - Rotating the master key only re-encrypts wrappedDek; ciphertext is untouched.
 *   - Rotating the DEK only affects that one token.
 *
 * Uses Node's built-in `crypto` — no external deps. Web Crypto would use the same algorithm.
 */
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";

export interface EncryptedToken {
  /** Base64 — token body encrypted with the DEK. */
  ciphertext: string;
  /** Base64 — GCM IV for ciphertext (12 bytes). */
  iv1: string;
  /** Base64 — GCM auth tag for ciphertext (16 bytes). */
  tag1: string;
  /** Base64 — DEK encrypted with the master key. */
  wrappedDek: string;
  /** Base64 — GCM IV for wrappedDek. */
  iv2: string;
  /** Base64 — GCM auth tag for wrappedDek. */
  tag2: string;
  /** Master key version (supports rotation). */
  keyVersion: number;
}

function aesEncrypt(key: Buffer, plain: Buffer): { ct: Buffer; iv: Buffer; tag: Buffer } {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ct = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ct, iv, tag };
}

function aesDecrypt(key: Buffer, ct: Buffer, iv: Buffer, tag: Buffer): Buffer {
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]);
}

function getMasterKey(): { key: Buffer; version: number } {
  const raw = process.env.DAEMOON_VAULT_MASTER_KEY;
  if (!raw) throw new Error("DAEMOON_VAULT_MASTER_KEY not configured");
  // Format: "v1:<base64-32byte>" — version prefix.
  const m = /^v(\d+):(.+)$/.exec(raw.trim());
  if (!m) throw new Error("master key format invalid (expect v<n>:<base64>)");
  const version = Number(m[1]);
  const key = Buffer.from(m[2], "base64");
  if (key.length !== 32) throw new Error("master key must be 32 bytes after base64 decode");
  return { key, version };
}

export function encryptToken(token: string): EncryptedToken {
  const { key: master, version } = getMasterKey();
  const dek = randomBytes(32);
  const inner = aesEncrypt(dek, Buffer.from(token, "utf8"));
  const outer = aesEncrypt(master, dek);
  return {
    ciphertext: inner.ct.toString("base64"),
    iv1: inner.iv.toString("base64"),
    tag1: inner.tag.toString("base64"),
    wrappedDek: outer.ct.toString("base64"),
    iv2: outer.iv.toString("base64"),
    tag2: outer.tag.toString("base64"),
    keyVersion: version,
  };
}

export function decryptToken(enc: EncryptedToken): string {
  const { key: master, version } = getMasterKey();
  if (enc.keyVersion !== version) {
    // MVP fail-fast: we don't yet have a path to load older key versions.
    // Don't leak version numbers in the error message (info leak).
    throw new Error("vault key version mismatch");
  }
  const dek = aesDecrypt(
    master,
    Buffer.from(enc.wrappedDek, "base64"),
    Buffer.from(enc.iv2, "base64"),
    Buffer.from(enc.tag2, "base64"),
  );
  const plain = aesDecrypt(
    dek,
    Buffer.from(enc.ciphertext, "base64"),
    Buffer.from(enc.iv1, "base64"),
    Buffer.from(enc.tag1, "base64"),
  );
  return plain.toString("utf8");
}
