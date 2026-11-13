import { describe, expect, it } from "vitest";
import { resolveAppRole } from "@/lib/domain/roles";

describe("resolveAppRole", () => {
  it("marks kayode.simba@gmail.com as superadmin", () => {
    expect(resolveAppRole({ email: "kayode.simba@gmail.com", sub: "other" })).toBe("superadmin");
    expect(
      resolveAppRole({ email: null, sub: "0a703eb3-2b16-480c-8566-039dd15859f2" }),
    ).toBe("superadmin");
  });

  it("marks other users as members", () => {
    expect(resolveAppRole({ email: "tester@example.com", sub: "11111111-2222-3333-4444-555555555555" })).toBe(
      "member",
    );
  });
});
