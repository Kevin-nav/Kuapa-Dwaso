// packages/dashboard-ui/src/hooks/useAdminData.ts
"use client";

import { useState, useEffect } from "react";
import { MockDatabase } from "../mockDb.js";
import type { Warehouse, WarehouseAgent, Farmer, FeeRule } from "../mockDb.js";

// Callbacks list to sync state across different components/hooks
const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((l) => l());
}

export function useAdminData() {
  const [, setVersion] = useState(0);

  useEffect(() => {
    const handleUpdate = () => {
      setVersion((v) => v + 1);
    };
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, []);

  const triggerUpdate = () => {
    notifyListeners();
  };

  const warehouses = MockDatabase.getWarehouses();
  const agents = MockDatabase.getAgents();
  const farmers = MockDatabase.getFarmers();
  const buyers = MockDatabase.getBuyers();
  const feeRules = MockDatabase.getFeeRules();
  const inventory = MockDatabase.getInventory();
  const disputes = MockDatabase.getDisputes();
  const auditLogs = MockDatabase.getAuditLogs();

  // Mutations
  const updateWarehouseStatus = (id: string, status: Warehouse["status"], reason?: string) => {
    MockDatabase.updateWarehouseStatus(id, status, reason);
    triggerUpdate();
  };

  const updateAgentStatus = (id: string, status: WarehouseAgent["status"], reason?: string) => {
    MockDatabase.updateAgentStatus(id, status, reason);
    triggerUpdate();
  };

  const assignWarehousesToAgent = (id: string, warehouseIds: string[]) => {
    MockDatabase.assignWarehouses(id, warehouseIds);
    triggerUpdate();
  };

  const updateFarmerVerification = (id: string, status: Farmer["verificationStatus"], reason?: string) => {
    MockDatabase.updateFarmerVerification(id, status, reason);
    triggerUpdate();
  };

  const resolveDispute = (id: string, notes: string) => {
    MockDatabase.resolveDispute(id, notes);
    triggerUpdate();
  };

  const createFeeRule = (rule: Omit<FeeRule, "id" | "version" | "createdAt" | "updatedAt">) => {
    const newRule = MockDatabase.createFeeRule(rule);
    triggerUpdate();
    return newRule;
  };

  const updateFeeRuleVersion = (id: string, newRate: number, reason: string) => {
    MockDatabase.updateFeeRuleVersion(id, newRate, reason);
    triggerUpdate();
  };

  // Derived Stats for Dashboard
  const summaryStats = {
    farmersCount: farmers.length,
    verifiedFarmersCount: farmers.filter(f => f.verificationStatus === "verified").length,
    pendingFarmersCount: farmers.filter(f => f.verificationStatus === "pending").length,
    agentsCount: agents.length,
    pendingAgentsCount: agents.filter(a => a.status === "pending").length,
    warehousesCount: warehouses.length,
    activeWarehousesCount: warehouses.filter(w => w.status === "active").length,
    buyersCount: buyers.length,
    inventoryBatchesCount: inventory.length,
    availableInventoryCount: inventory.filter(i => i.status === "available").length,
    disputesCount: disputes.length,
    openDisputesCount: disputes.filter(d => d.status === "open").length,
    recentActivity: auditLogs.slice(0, 10),
  };

  return {
    warehouses,
    agents,
    farmers,
    buyers,
    feeRules,
    inventory,
    disputes,
    auditLogs,
    summaryStats,
    actions: {
      updateWarehouseStatus,
      updateAgentStatus,
      assignWarehousesToAgent,
      updateFarmerVerification,
      resolveDispute,
      createFeeRule,
      updateFeeRuleVersion
    }
  };
}
