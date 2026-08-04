/**
 * Tests for GET /api/careerotter/export (M2c privacy): auth + full payload shape.
 */

import { GET } from "@/app/api/careerotter/export/route";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin-client", () => ({ createAdminClient: jest.fn() }));

const mockCreateClient = createClient as jest.Mock;
const mockAdmin = createAdminClient as jest.Mock;
const USER = { id: "user-1", email: "u@example.com" };

function setUser(user: unknown) {
  mockCreateClient.mockResolvedValue({
    auth: { getUser: jest.fn().mockResolvedValue({ data: { user }, error: null }) },
  });
}

// Table-aware mock: each from(table) returns a FRESH builder bound to that table
// (so concurrent chains under Promise.all don't share state), awaitable to that
// table's result.
function adminWithTables(results: Record<string, { data: unknown; error: unknown }>) {
  mockAdmin.mockReturnValue({
    from(table: string) {
      const builder: Record<string, unknown> = {};
      for (const m of ["select", "eq", "order", "maybeSingle", "single"]) {
        builder[m] = () => builder;
      }
      (builder as { then: unknown }).then = (resolve: (v: unknown) => void) =>
        resolve(results[table] ?? { data: null, error: null });
      return builder;
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  setUser(USER);
});

it("401 when unauthenticated", async () => {
  setUser(null);
  expect((await GET()).status).toBe(401);
});

it("returns a full export payload with an attachment header", async () => {
  adminWithTables({
    career_profiles: { data: { user_id: USER.id, mode: "promotion" }, error: null },
    wins: { data: [{ id: "w1", text: "shipped it" }], error: null },
    weekly_recaps: { data: [], error: null },
    comp_entries: { data: [{ id: "c1", base: 150000 }], error: null },
  });

  const res = await GET();
  expect(res.status).toBe(200);
  expect(res.headers.get("Content-Disposition")).toMatch(/careerotter-export\.json/);

  const body = JSON.parse(await res.text());
  expect(body.user.id).toBe(USER.id);
  expect(body.career_profile.mode).toBe("promotion");
  expect(body.wins).toHaveLength(1);
  expect(body.comp_entries).toHaveLength(1);
  expect(body.exported_at).toBeTruthy();
});
