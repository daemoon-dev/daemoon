/* Daemun token vault — envelope encryption.
 *
 * Threat model:
 *   - DB 가 통째로 유출되어도 토큰이 평문 노출되면 안 됨 (= env 의 master key 없으면 못 풀게).
 *   - master key 가 유출돼도 일부 토큰만 영향 받아야 함 (= per-token DEK).
 *
 * Envelope pattern:
 *   1. 매 토큰마다 *Data Encryption Key (DEK)* 32 byte 랜덤 생성.
 *   2. 토큰 본문을 *DEK + AES-256-GCM* 으로 암호화 → ciphertext.
 *   3. DEK 를 *master key + AES-256-GCM* 으로 한 번 더 암호화 → wrappedDek.
 *   4. DB 에 저장: { ciphertext, iv1, tag1, wrappedDek, iv2, tag2 }.
 *   5. 복호화: master → DEK → token.
 *
 * 회전 (key rotation):
 *   - master key 회전 시 wrappedDek 만 재암호화. ciphertext 는 그대로.
 *   - DEK 회전 시 그 토큰만 영향.
 *
 * Node `crypto` (built-in) 사용 — 외부 의존 X. Web Crypto 도 같은 알고리즘.
 */
import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

const ALGO = "aes-256-gcm";

export interface EncryptedToken {
  /** Base64 — DEK 로 암호화된 토큰 본문. */
  ciphertext: string;
  /** Base64 — ciphertext 의 GCM IV (12 byte). */
  iv1: string;
  /** Base64 — ciphertext 의 GCM auth tag (16 byte). */
  tag1: string;
  /** Base64 — master key 로 암호화된 DEK. */
  wrappedDek: string;
  /** Base64 — wrappedDek 의 GCM IV. */
  iv2: string;
  /** Base64 — wrappedDek 의 GCM auth tag. */
  tag2: string;
  /** master key 버전 (회전 대응). */
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
  const raw = process.env.DAEMUN_VAULT_MASTER_KEY;
  if (!raw) throw new Error("DAEMUN_VAULT_MASTER_KEY not configured");
  // 형식: "v1:<base64-32byte>" — version prefix.
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
    // 회전 미완료 — 다른 버전 키 로딩 path 필요. MVP 에선 fail-fast.
    throw new Error(`token key version mismatch (have v${version}, need v${enc.keyVersion})`);
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
