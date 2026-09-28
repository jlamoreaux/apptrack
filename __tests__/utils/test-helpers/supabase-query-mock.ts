/**
 * Chainable Supabase admin-client mock for service tests.
 *
 * Each `from()` call starts a new query builder that resolves to the next
 * queued result, so multi-query paths (count, then insert, then lookup) can be
 * scripted. Every builder method is a jest.fn returning the builder, and each
 * call is also recorded as an op so tests can assert on the chain.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface QueryResult {
  data?: unknown;
  error?: unknown;
  count?: number | null;
}

export type QueryOp = [method: string, args: unknown[]];

export const QUERY_BUILDER_METHODS = [
  "select", "insert", "update", "upsert", "delete", "eq", "is", "in", "gte", "lte",
  "order", "limit", "single", "maybeSingle",
] as const;
export type QueryBuilderMethod = (typeof QUERY_BUILDER_METHODS)[number];

export type QueryBuilder = Record<QueryBuilderMethod, jest.Mock> & PromiseLike<unknown>;

export interface RecordedQuery {
  table: string;
  ops: QueryOp[];
  builder: QueryBuilder;
}

export interface MockAdmin {
  client: SupabaseClient;
  from: jest.Mock;
  queries: RecordedQuery[];
}

function buildQuery(table: string, result: QueryResult): RecordedQuery {
  const resolved = { data: null, error: null, count: null, ...result };
  const ops: QueryOp[] = [];
  // Methods are attached below; they return the builder itself, so it must exist first.
  const builder = {
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(resolved).then(resolve, reject),
  } as unknown as QueryBuilder;
  for (const method of QUERY_BUILDER_METHODS) {
    builder[method] = jest.fn((...args: unknown[]) => {
      ops.push([method, args]);
      return builder;
    });
  }
  return { table, ops, builder };
}

/** An admin client whose queries resolve, in order, to `results`. */
export function mockSupabaseAdmin(results: QueryResult[]): MockAdmin {
  const queue = [...results];
  const queries: RecordedQuery[] = [];
  const from = jest.fn((table: string) => {
    const query = buildQuery(table, queue.shift() ?? {});
    queries.push(query);
    return query.builder;
  });
  return { client: { from } as unknown as SupabaseClient, from, queries };
}

/** An admin client whose `from()` throws, for never-throw assertions. */
export function throwingSupabaseAdmin(message = "network down"): MockAdmin {
  const from = jest.fn(() => {
    throw new Error(message);
  });
  return { client: { from } as unknown as SupabaseClient, from, queries: [] };
}

/** True when the query called `method` with arguments starting with `args`. */
export function hasOp(query: RecordedQuery, method: string, ...args: unknown[]): boolean {
  return query.ops.some(
    ([name, callArgs]) => name === method && args.every((arg, i) => Object.is(callArgs[i], arg))
  );
}

/** Arguments of the first call to `method` on the query. */
export function opArgs(query: RecordedQuery, method: string): unknown[] | undefined {
  return query.ops.find(([name]) => name === method)?.[1];
}

/** Asserts every query filtered (or, for an insert, wrote) the given user_id. */
export function expectScopedToUser(queries: RecordedQuery[], userId: string): void {
  for (const query of queries) {
    const inserted = opArgs(query, "insert")?.[0];
    const insertedForUser =
      typeof inserted === "object" && inserted !== null && "user_id" in inserted &&
      inserted.user_id === userId;
    expect(hasOp(query, "eq", "user_id", userId) || insertedForUser).toBe(true);
  }
}
