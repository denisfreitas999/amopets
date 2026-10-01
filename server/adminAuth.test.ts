import { describe, expect, it } from "vitest";
import { hashAdminPassword, verifyAdminPassword } from "./adminAuth";

describe("admin password authentication", () => {
  it("hashes and verifies the original password without storing plaintext", () => {
    const encoded = hashAdminPassword("AmoPets#2026");

    expect(encoded).toMatch(/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/);
    expect(encoded).not.toContain("AmoPets#2026");
    expect(verifyAdminPassword("AmoPets#2026", encoded)).toBe(true);
    expect(verifyAdminPassword("senha-incorreta", encoded)).toBe(false);
  });

  it("rejects malformed or unsupported encoded hashes", () => {
    expect(verifyAdminPassword("qualquer", "")).toBe(false);
    expect(verifyAdminPassword("qualquer", "bcrypt$salt$hash")).toBe(false);
    expect(verifyAdminPassword("qualquer", "scrypt$short$not-hex")).toBe(false);
  });
});
