import { describe, expect, it } from "vitest";
import { readAuthLink } from "@/lib/client/auth-link";

describe("readAuthLink", () => {
  it("reads access_token from the hash", () => {
    expect(readAuthLink("", "#access_token=abc&type=invite")).toEqual({
      kind: "session",
      accessToken: "abc",
      type: "invite",
    });
  });

  it("explains expired invite links", () => {
    const result = readAuthLink(
      "",
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    );
    expect(result.kind).toBe("error");
    if (result.kind === "error") expect(result.message).toMatch(/expired|fresh link/i);
  });
});
