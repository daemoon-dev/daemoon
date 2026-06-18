/* Daemoon — Google Cloud Platform connector.
 *
 * 인증: Service Account JSON 키 paste. 유저가 콘솔에서 만들어 붙여넣음.
 *   - JSON 안에 private_key + client_email → JWT 서명 → access_token 교환
 *   - token 은 1시간 짜리. 매 호출시 JWT 생성 (간단 MVP).
 *
 * MVP 도구:
 *   1) gcp.list_projects()
 *   2) gcp.list_services({ projectId })  — 활성화된 API 목록
 */
import { createSign } from "crypto";
import type { Connector, ToolContext, ToolDef } from "../types";

const SCOPE = "https://www.googleapis.com/auth/cloud-platform";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CRM = "https://cloudresourcemanager.googleapis.com/v1";
const SERVICE_USAGE = "https://serviceusage.googleapis.com/v1";

interface ServiceAccountKey {
  type: string;
  project_id: string;
  private_key: string;
  client_email: string;
}

function parseSAKey(raw: string): ServiceAccountKey {
  const obj = JSON.parse(raw) as ServiceAccountKey;
  if (obj.type !== "service_account") throw new Error("not a service_account key");
  if (!obj.private_key || !obj.client_email) throw new Error("missing private_key/client_email");
  return obj;
}

async function getAccessToken(sa: ServiceAccountKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: sa.client_email,
    scope: SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64(header)}.${b64(payload)}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsigned);
  const sig = signer.sign(sa.private_key).toString("base64url");
  const jwt = `${unsigned}.${sig}`;
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`GCP token exchange failed: ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { access_token: string };
  return data.access_token;
}

function reqTok(ctx: ToolContext): string {
  if (!ctx.token) throw new Error("GCP not connected — paste service account JSON.");
  return ctx.token;
}

const listProjects: ToolDef<Record<string, never>, { projects: Array<{ projectId: string; name: string; lifecycleState: string }> }> = {
  name: "gcp.list_projects",
  description: "내 GCP 프로젝트 목록.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
  async handler(_args, ctx) {
    const sa = parseSAKey(reqTok(ctx));
    const accessToken = await getAccessToken(sa);
    const res = await fetch(`${CRM}/projects`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) throw new Error(`GCP list_projects ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { projects?: Array<{ projectId: string; name: string; lifecycleState: string }> };
    return { projects: data.projects ?? [] };
  },
};

const listServices: ToolDef<{ projectId: string }, { services: Array<{ name: string; state: string }> }> = {
  name: "gcp.list_services",
  description: "특정 프로젝트의 활성화된 GCP API/서비스 목록.",
  inputSchema: {
    type: "object",
    properties: { projectId: { type: "string", minLength: 4 } },
    required: ["projectId"],
    additionalProperties: false,
  },
  async handler({ projectId }, ctx) {
    const sa = parseSAKey(reqTok(ctx));
    const accessToken = await getAccessToken(sa);
    const res = await fetch(
      `${SERVICE_USAGE}/projects/${projectId}/services?filter=state:ENABLED&pageSize=200`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    if (!res.ok) throw new Error(`GCP list_services ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { services?: Array<{ name: string; state: string }> };
    return { services: (data.services ?? []).map(s => ({ name: s.name, state: s.state })) };
  },
};

export const gcpConnector: Connector = {
  id: "gcp",
  label: "Google Cloud",
  oauthSupported: false,
  async validatePat(pat: string) {
    try {
      const sa = parseSAKey(pat);
      const accessToken = await getAccessToken(sa);
      const res = await fetch(`${CRM}/projects?pageSize=1`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) return { ok: false as const, reason: `GCP API ${res.status}` };
      return { ok: true as const, meta: { client_email: sa.client_email, project_id: sa.project_id } };
    } catch (e) {
      return { ok: false as const, reason: e instanceof Error ? e.message : "unknown" };
    }
  },
  tools: [listProjects, listServices],
};
