import test from "node:test";
import assert from "node:assert/strict";
import {
  adminScopeMatchesTarget,
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
  assert.equal(
    adminRoleHasPermission("platform_owner", "adminAccess:manage"),
    true,
  );
  assert.equal(
    adminRoleHasPermission("platform_owner", "invitations:manage"),
    true,
  );
  assert.equal(
    adminRoleHasPermission("platform_owner", "uploads:manage"),
    true,
  );
});

test("blog publishing is reserved for the platform owner at launch", () => {
  assert.equal(adminRoleHasPermission("platform_owner", "blog:read"), true);
  assert.equal(adminRoleHasPermission("platform_owner", "blog:write"), true);
  assert.equal(adminRoleHasPermission("platform_owner", "blog:publish"), true);
  for (const role of [
    "operations_manager",
    "warehouse_manager",
    "finance_manager",
    "support_officer",
    "auditor",
    "analyst",
    "admin_viewer",
  ] as const) {
    assert.equal(adminRoleHasPermission(role, "blog:read"), false);
    assert.equal(adminRoleHasPermission(role, "blog:publish"), false);
  }
});

test("operations manager can run operations without finance-only mutation rights", () => {
  assert.equal(
    adminRoleHasPermission("operations_manager", "warehouses:manage"),
    true,
  );
  assert.equal(
    adminRoleHasPermission("operations_manager", "inventory:adjust"),
    true,
  );
  assert.equal(
    adminRoleHasPermission("operations_manager", "dispatches:manage"),
    true,
  );
  assert.equal(
    adminRoleHasPermission("operations_manager", "sales:managePaymentStatus"),
    false,
  );
  assert.equal(
    adminRoleHasPermission("operations_manager", "fees:manage"),
    false,
  );
  assert.equal(
    adminRoleHasPermission("operations_manager", "adminAccess:manage"),
    false,
  );
  assert.equal(
    adminRoleHasPermission("operations_manager", "invitations:manage"),
    true,
  );
});

test("finance manager owns fee and payment capabilities without admin access management", () => {
  assert.equal(adminRoleHasPermission("finance_manager", "fees:manage"), true);
  assert.equal(
    adminRoleHasPermission("finance_manager", "sales:managePaymentStatus"),
    true,
  );
  assert.equal(
    adminRoleHasPermission("finance_manager", "payments:manage"),
    true,
  );
  assert.equal(
    adminRoleHasPermission("finance_manager", "payouts:manage"),
    true,
  );
  assert.equal(
    adminRoleHasPermission("finance_manager", "warehouses:manage"),
    false,
  );
  assert.equal(
    adminRoleHasPermission("finance_manager", "adminAccess:manage"),
    false,
  );
});

test("viewer and analyst roles are read-only", () => {
  assert.equal(adminRoleHasPermission("admin_viewer", "reports:read"), true);
  assert.equal(adminRoleHasPermission("admin_viewer", "payments:read"), true);
  assert.equal(adminRoleHasPermission("admin_viewer", "payouts:read"), true);
  assert.equal(adminRoleHasPermission("admin_viewer", "orders:manage"), false);
  assert.equal(adminRoleHasPermission("admin_viewer", "invitations:manage"), false);
  assert.equal(adminRoleHasPermission("analyst", "reports:read"), true);
  assert.equal(adminRoleHasPermission("analyst", "payments:read"), true);
  assert.equal(adminRoleHasPermission("analyst", "payouts:read"), true);
  assert.equal(adminRoleHasPermission("analyst", "disputes:manage"), false);
});

test("permission reverse lookup exposes eligible admin roles", () => {
  const accessManagers = getAdminRolesForPermission("adminAccess:manage");
  assert.deepEqual(accessManagers, ["platform_owner"]);
  assert.ok(getAdminRolesForPermission("disputes:manage").includes("support_officer"));
});

test("warehouse managers can supervise schedules and runs but remain warehouse scoped", () => {
  assert.equal(adminRoleHasPermission("warehouse_manager", "marketSchedules:read"), true);
  assert.equal(adminRoleHasPermission("warehouse_manager", "marketSchedules:manage"), true);
  assert.equal(adminRoleHasPermission("warehouse_manager", "marketRuns:read"), true);
  assert.equal(adminRoleHasPermission("warehouse_manager", "marketRuns:manage"), true);
  assert.equal(adminRoleHasPermission("warehouse_manager", "adminAccess:manage"), false);
});

test("warehouse scope grants never match another warehouse", () => {
  const managerGrant = { scopeType: "warehouse" as const, scopeId: "warehouse-a" };
  assert.equal(adminScopeMatchesTarget(managerGrant, { warehouseId: "warehouse-a" }), true);
  assert.equal(adminScopeMatchesTarget(managerGrant, { warehouseId: "warehouse-b" }), false);
  assert.equal(adminScopeMatchesTarget(managerGrant, { destinationMarket: "Tarkwa" }), false);
});

test("incomplete scoped grants and targets never authorize a match", () => {
  for (const scopeType of ["region", "district", "destination_market"] as const) {
    assert.equal(adminScopeMatchesTarget({ scopeType }, {}), false);
    assert.equal(adminScopeMatchesTarget({ scopeType, scopeValue: "  " }, { region: "ashanti", district: "kumasi", destinationMarket: "makola" }), false);
  }
});
