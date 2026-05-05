import { describe, expect, it } from "vitest";
import { hasPermission, PERMISSIONS } from "./access";

describe("hasPermission", () => {
  it("grants client.write to owner, admin, intake, scheduler", () => {
    expect(hasPermission("owner", "client.write")).toBe(true);
    expect(hasPermission("admin", "client.write")).toBe(true);
    expect(hasPermission("intake", "client.write")).toBe(true);
    expect(hasPermission("scheduler", "client.write")).toBe(true);
  });

  it("denies client.write to biller, viewer, caregiver", () => {
    expect(hasPermission("biller", "client.write")).toBe(false);
    expect(hasPermission("viewer", "client.write")).toBe(false);
    expect(hasPermission("caregiver", "client.write")).toBe(false);
  });

  it("only owner can delete clients", () => {
    expect(hasPermission("owner", "client.delete")).toBe(true);
    expect(hasPermission("admin", "client.delete")).toBe(false);
  });

  it("only owner, admin, biller, compliance can read SSN", () => {
    expect(hasPermission("owner", "phi.ssn.read")).toBe(true);
    expect(hasPermission("admin", "phi.ssn.read")).toBe(true);
    expect(hasPermission("biller", "phi.ssn.read")).toBe(true);
    expect(hasPermission("compliance", "phi.ssn.read")).toBe(true);
    expect(hasPermission("scheduler", "phi.ssn.read")).toBe(false);
    expect(hasPermission("intake", "phi.ssn.read")).toBe(false);
    expect(hasPermission("caregiver", "phi.ssn.read")).toBe(false);
  });

  it("audit log is restricted to owner, compliance, admin", () => {
    expect(hasPermission("owner", "audit.read")).toBe(true);
    expect(hasPermission("compliance", "audit.read")).toBe(true);
    expect(hasPermission("admin", "audit.read")).toBe(true);
    expect(hasPermission("scheduler", "audit.read")).toBe(false);
    expect(hasPermission("biller", "audit.read")).toBe(false);
  });

  it("permission table covers every advertised permission", () => {
    // Smoke test: each value in PERMISSIONS is a non-empty string array of roles.
    for (const [perm, roles] of Object.entries(PERMISSIONS)) {
      expect(Array.isArray(roles), perm).toBe(true);
      expect(roles.length, perm).toBeGreaterThan(0);
    }
  });
});
