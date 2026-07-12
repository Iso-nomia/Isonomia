import { isAdmin, canManageWorkspace } from "../lib/auth/roles";

describe("roles helpers", () => {
  test("isAdmin returns true for ADMIN or OWNER", () => {
    expect(isAdmin({ role: "ADMIN" })).toBe(true);
    expect(isAdmin({ role: "OWNER" })).toBe(true);
    expect(isAdmin({ role: "USER" })).toBe(false);
  });

  test("canManageWorkspace allows admins or owners", () => {
    const admin = { id: 1n, role: "ADMIN" };
    const owner = { id: 2n, role: "USER" };
    const workspace = { ownerId: 2n };

    expect(canManageWorkspace(admin, workspace)).toBe(true);
    expect(canManageWorkspace(owner, workspace)).toBe(true);
    expect(canManageWorkspace({ id: 3n, role: "USER" }, workspace)).toBe(false);
  });
});
