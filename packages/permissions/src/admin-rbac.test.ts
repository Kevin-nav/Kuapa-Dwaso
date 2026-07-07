import test from "node:test";
import assert from "node:assert/strict";
import {
  adminPermissionKeys,
  adminRoleHasPermission,
  getAdminRolePermissions,
  getAdminRolesForPermission,
} from "./index.ts";

test("platform owner receives every admin permission including access management", () => {
  assert.deepEqual(
    new Set(getAdminRolePermissions("platform_owner")),
    new Set(adminPermissionKeys),
  );
  assert.equal(adminRoleHasPermission("platform_owner", "adminAccess:manage"), true);
});

test("operations manager can run operations without finance-only mutation rights", () => {
  assert.equal(adminRoleHasPermission("operations_manager", "warehouses:manage"), true);
  assert.equal(adminRoleHasPermission("operations_manager", "inventory:adjust"), true);
  assert.equal(adminRoleHasPermission("operations_manager", "dispatches:manage"), true);
  assert.equal(
    adminRoleHasPermission("operations_manager", "sales:managePaymentStatus"),
    false,
  );
  assert.equal(adminRoleHasPermission("operations_manager", "fees:manage"), false);
  assert.equal(adminRoleHasPermission("operations_manager", "adminAccess:manage"), false);
});

test("finance manager owns fee and payment capabilities without admin access management", () => {
  assert.equal(adminRoleHasPermission("finance_manager", "fees:manage"), true);
  assert.equal(adminRoleHasPermission("finance_manager", "sales:managePaymentStatus"), true);
  assert.equal(adminRoleHasPermission("finance_manager", "warehouses:manage"), false);
  assert.equal(adminRoleHasPermission("finance_manager", "adminAccess:manage"), false);
});

test("viewer and analyst roles are read-only", () => {
  assert.equal(adminRoleHasPermission("admin_viewer", "reports:read"), true);
  assert.equal(adminRoleHasPermission("admin_viewer", "orders:manage"), false);
  assert.equal(adminRoleHasPermission("analyst", "reports:read"), true);
  assert.equal(adminRoleHasPermission("analyst", "disputes:manage"), false);
});

test("permission reverse lookup exposes eligible admin roles", () => {
  const accessManagers = getAdminRolesForPermission("adminAccess:manage");
  assert.deepEqual(accessManagers, ["platform_owner"]);
  assert.ok(getAdminRolesForPermission("disputes:manage").includes("support_officer"));
});
