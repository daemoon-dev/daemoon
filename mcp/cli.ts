#!/usr/bin/env node
/* Daemoon MCP stdio entrypoint.
 *
 * Spawned by Claude Code / Cursor:
 *   daemoon-mcp  (env: DAEMOON_USER_ID + DAEMOON_VAULT_MASTER_KEY + SUPABASE_*)
 *
 * User id is read from env (MCP transport is per-process, so one user per spawn).
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
