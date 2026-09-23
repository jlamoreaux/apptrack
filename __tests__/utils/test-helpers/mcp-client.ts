/**
 * Drives MCP tools through a real McpServer and SDK client over an in-memory
 * transport, the way an agent would. `call` lists tools first, which makes the
 * SDK client validate every structuredContent against the advertised output
 * schema (and throw on a mismatch).
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { registerDefinedTools, type DefinedTool } from "@/lib/mcp/define-tool";
import type { McpToolContext } from "@/lib/mcp/context";
import type { AgentTokenScope } from "@/types";

export { loggerServiceMock, posthogServerMock } from "./mcp-mocks";

export const TEST_USER_ID = "8d0e7c1a-2b3c-4d5e-8f90-a1b2c3d4e5f6";
export const TEST_OTHER_USER_ID = "11111111-2222-4333-8444-555555555555";
export const TEST_TOKEN_ID = "token-1";
export const TEST_NOW = new Date("2026-09-01T12:00:00Z");

// Services are mocked in the tool tests, so this client is only passed through
// and compared by identity; nothing is listening at its URL.
export const TEST_ADMIN: SupabaseClient = createClient("http://127.0.0.1:1", "test-service-key", {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Arguments outside the input schema are refused by the SDK before the
// handler runs.
export const INVALID_ARGUMENTS = /Input validation error|Invalid tool arguments/;

export type CallResult = Awaited<ReturnType<Client["callTool"]>>;

export interface McpHarness {
  tools: readonly DefinedTool[];
  scopes?: AgentTokenScope[];
  now?: Date;
}

export function context(scopes: AgentTokenScope[], now: Date = TEST_NOW): McpToolContext {
  return { admin: TEST_ADMIN, userId: TEST_USER_ID, tokenId: TEST_TOKEN_ID, scopes, now };
}

export async function connect(harness: McpHarness, scopes: AgentTokenScope[]): Promise<Client> {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  registerDefinedTools(server, context(scopes, harness.now), harness.tools);
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "0.0.0" });
  await client.connect(clientTransport);
  return client;
}

export async function call(
  harness: McpHarness,
  name: string,
  args: Record<string, unknown> = {},
  scopes: AgentTokenScope[] = harness.scopes ?? []
): Promise<CallResult> {
  const client = await connect(harness, scopes);
  try {
    await client.listTools();
    return await client.callTool({ name, arguments: args });
  } finally {
    await client.close();
  }
}

export async function listTools(
  harness: McpHarness,
  scopes: AgentTokenScope[]
): Promise<Awaited<ReturnType<Client["listTools"]>>["tools"]> {
  const client = await connect(harness, scopes);
  try {
    return (await client.listTools()).tools;
  } finally {
    await client.close();
  }
}

export async function toolNames(harness: McpHarness, scopes: AgentTokenScope[]): Promise<string[]> {
  return (await listTools(harness, scopes)).map((tool) => tool.name).sort();
}

// With no tools registered the SDK serves no tools/list, so count registrations.
export function registeredCount(tools: readonly DefinedTool[], scopes: AgentTokenScope[]): number {
  const server = new McpServer({ name: "test", version: "0.0.0" });
  const register = jest.spyOn(server, "registerTool");
  registerDefinedTools(server, context(scopes), tools);
  return register.mock.calls.length;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTextBlock(value: unknown): value is { type: "text"; text: string } {
  return isRecord(value) && value.type === "text" && typeof value.text === "string";
}

/** The structured result of a successful call; fails the test otherwise. */
export function structuredOf(result: CallResult): Record<string, unknown> {
  expect(result.isError).toBeFalsy();
  const structured = result.structuredContent;
  if (!isRecord(structured)) throw new Error("Expected structuredContent");
  return structured;
}

/** The text of the single content block. */
export function textOf(result: CallResult): string {
  const blocks = Array.isArray(result.content) ? result.content : [];
  const [block] = blocks;
  if (blocks.length !== 1 || !isTextBlock(block)) throw new Error("Expected one text block");
  return block.text;
}

/** The message of a failed call; fails the test when the call succeeded. */
export function errorTextOf(result: CallResult): string {
  expect(result.isError).toBe(true);
  expect(result.structuredContent).toBeUndefined();
  return textOf(result);
}

/** A nested object field of a structured result. */
export function recordField(record: Record<string, unknown>, key: string): Record<string, unknown> {
  const value = record[key];
  if (!isRecord(value)) throw new Error(`Expected ${key} to be an object`);
  return value;
}

/** A nested array-of-objects field of a structured result. */
export function recordsField(record: Record<string, unknown>, key: string): Record<string, unknown>[] {
  const value = record[key];
  if (!Array.isArray(value) || !value.every(isRecord)) {
    throw new Error(`Expected ${key} to be an array of objects`);
  }
  return value;
}
