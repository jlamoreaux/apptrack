/**
 * Tests for the branded UserScope type.
 *
 * The type's value is mostly compile-time — it cannot be built from a bare string, so a
 * repository method taking a UserScope cannot be called without a verified identity. What
 * is testable at runtime is the empty-id guard, and that matters more than it looks: an
 * empty scope would match no rows, so a broken auth path would present as "no results"
 * rather than as an error.
 */

import { userScope, scopedUserId, type UserScope } from "@/lib/db/scope";

describe("userScope", () => {
  it("carries the verified user id through", () => {
    const scope = userScope("11111111-2222-3333-4444-555555555555");
    expect(scopedUserId(scope)).toBe("11111111-2222-3333-4444-555555555555");
  });

  it.each(["", null, undefined])(
    "rejects %p rather than producing a scope that matches nothing",
    (value) => {
      expect(() => userScope(value as unknown as string)).toThrow(
        /non-empty verified user id/
      );
    }
  );

  it("explains why an empty scope is rejected, so the guard is not casually removed", () => {
    // The message is the only place a future reader learns that an empty scope fails
    // silently rather than loudly.
    expect(() => userScope("")).toThrow(/silently matches no rows/);
  });

  it("is not constructible from a plain object at the type level", () => {
    // Compile-time behaviour, asserted here so the intent is recorded next to the runtime
    // tests. Removing the brand from UserScope would make this line compile.
    // @ts-expect-error a bare object is not a UserScope
    const notAScope: UserScope = { userId: "abc" };
    expect(notAScope.userId).toBe("abc");
  });
});
