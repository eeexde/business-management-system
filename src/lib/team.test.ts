import { describe, expect, it } from "vitest";
import { checkRemoveUser, checkRoleChange } from "./team";

describe("team guard rails", () => {
  it("blocks removing yourself", () => {
    expect(checkRemoveUser({ actorId: 1, target: { id: 1, role: "admin" }, adminCount: 3 })).toMatch(/your own/);
  });
  it("blocks removing the last admin", () => {
    expect(checkRemoveUser({ actorId: 2, target: { id: 1, role: "admin" }, adminCount: 1 })).toMatch(/last admin/);
  });
  it("allows removing other users", () => {
    expect(checkRemoveUser({ actorId: 1, target: { id: 2, role: "staff" }, adminCount: 1 })).toBeNull();
    expect(checkRemoveUser({ actorId: 1, target: { id: 2, role: "admin" }, adminCount: 2 })).toBeNull();
  });
  it("blocks demoting the last admin", () => {
    expect(checkRoleChange({ target: { id: 1, role: "admin" }, newRole: "manager", adminCount: 1 })).not.toBeNull();
  });
  it("allows other role changes", () => {
    expect(checkRoleChange({ target: { id: 1, role: "admin" }, newRole: "admin", adminCount: 1 })).toBeNull();
    expect(checkRoleChange({ target: { id: 1, role: "admin" }, newRole: "staff", adminCount: 2 })).toBeNull();
    expect(checkRoleChange({ target: { id: 2, role: "staff" }, newRole: "admin", adminCount: 1 })).toBeNull();
  });
});
