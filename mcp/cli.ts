#!/usr/bin/env node
/* Daemoon MCP stdio entrypoint.
 *
 * Claude Code / Cursor 가 spawn:
 *   daemoon-mcp  (env: DAEMOON_USER_ID + DAEMOON_VAULT_MASTER_KEY + SUPABASE_*)
 *
 * 사용자 id 는 env 또는 처음 1줄 argv 에서 받는다 (MCP transport 가 process 단위).
 */
import { runStdio } from "../lib/mcp/server";

const userId = process.env.DAEMOON_USER_ID;
if (!userId) {
  console.error("DAEMOON_USER_ID env required");
  process.exit(1);
}

runStdio(userId).catch(err => {
  console.error("MCP server crashed:", err);
  process.exit(1);
});
