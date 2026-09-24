// @jest-environment node
/**
 * isProUser: the admin-client plan lookup for token callers. Pro only for an
 * entitled (active/trialing) Pro-or-higher subscription; DB errors are `db`.
 */

import { isProUser } from "@/lib/careerotter/plan";
import { PLAN_NAMES } from "@/lib/constants/plans";

jest.mock("@/lib/services/logger.service", () => ({
  loggerService: { error: jest.fn(), warn: jest.fn(), info: jest.fn(), debug: jest.fn() },
}));

const USER_ID = "user-1";

/** Fake admin client resolving the subscription query to `result`, recording filters. */
function fakeAdmin(result: { data: unknown; error: unknown }) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "in", "order", "limit", "maybeSingle"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, args]);
      return builder;
    };
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  const from = jest.fn(() => builder);
  return { client: { from } as never, calls, from };
}

function subscription(status: string, planName: string | null) {
  return { status, subscription_plans: planName === null ? null : { name: planName } };
}

it("is Pro for an active Pro subscription, querying the user's latest entitled row", async () => {
  const { client, calls, from } = fakeAdmin({ data: subscription("active", PLAN_NAMES.PRO), error: null });
  expect(await isProUser(client, USER_ID)).toEqual({ ok: true, value: true });
  expect(from).toHaveBeenCalledWith("user_subscriptions");
  expect(calls).toEqual(
    expect.arrayContaining([
      ["eq", ["user_id", USER_ID]],
      ["in", ["status", ["active", "trialing"]]],
      ["order", ["created_at", { ascending: false }]],
      ["limit", [1]],
    ])
  );
});

it("is Pro for a trialing AI Coach subscription", async () => {
  const { client } = fakeAdmin({ data: subscription("trialing", PLAN_NAMES.AI_COACH), error: null });
  expect(await isProUser(client, USER_ID)).toEqual({ ok: true, value: true });
});

it("is not Pro on the Free plan or with no subscription", async () => {
  const free = fakeAdmin({ data: subscription("active", PLAN_NAMES.FREE), error: null });
  expect(await isProUser(free.client, USER_ID)).toEqual({ ok: true, value: false });
  const none = fakeAdmin({ data: null, error: null });
  expect(await isProUser(none.client, USER_ID)).toEqual({ ok: true, value: false });
  const noPlan = fakeAdmin({ data: subscription("active", null), error: null });
  expect(await isProUser(noPlan.client, USER_ID)).toEqual({ ok: true, value: false });
});

it("is not Pro for a lapsed status even on a Pro plan", async () => {
  const { client } = fakeAdmin({ data: subscription("past_due", PLAN_NAMES.PRO), error: null });
  expect(await isProUser(client, USER_ID)).toEqual({ ok: true, value: false });
});

it("returns db on a query error or a thrown client", async () => {
  const failing = fakeAdmin({ data: null, error: { message: "boom" } });
  expect(await isProUser(failing.client, USER_ID)).toMatchObject({ ok: false, kind: "db" });
  const throwing = {
    from: () => {
      throw new Error("network down");
    },
  } as never;
  expect(await isProUser(throwing, USER_ID)).toMatchObject({ ok: false, kind: "db" });
});
