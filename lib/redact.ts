/* Redact provider credentials and Daemoon PATs from arbitrary strings. */
const PATTERNS: RegExp[] = [
  /dmn_[A-Za-z0-9_-]{8,}/g,                  // Daemoon PAT
  /sk_(?:test|live)_[A-Za-z0-9]{16,}/g,      // Stripe secret key
  /sk-ant-[A-Za-z0-9-]{16,}/g,               // Anthropic key
  /sk-[A-Za-z0-9]{16,}/g,                    // OpenAI key
  /re_[A-Za-z0-9_-]{16,}/g,                  // Resend key
  /gh[pousr]_[A-Za-z0-9]{16,}/g,             // GitHub tokens (ghp_/gho_/ghs_/ghu_/ghr_)
  /sbp_[A-Za-z0-9]{16,}/g,                   // Supabase PAT
  /Bearer\s+[A-Za-z0-9._-]{16,}/g,           // Generic bearer
];

export function redactSecrets(text: string): string {
  let out = text;
  for (const re of PATTERNS) out = out.replace(re, "[REDACTED]");
  return out;
}
