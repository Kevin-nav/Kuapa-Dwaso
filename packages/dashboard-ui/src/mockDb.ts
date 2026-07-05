// packages/dashboard-ui/src/mockDb.ts

export type Warehouse = {
  id: string;
  code: string;
  name: string;
  community: string;
  district?: string;
  region?: string;
  servedCommunities: string[];
  supportedCrops: string[];
  storageCapacity?: number;
  capacityUnit?: string;
  assignedWarehouseAgentIds: string[];
  destinationMarketsServed: string[];
  operatingDays: string[];
  dispatchDays?: string[];
  status: "active" | "inactive" | "maintenance" | "closed";
  createdAt: number;
  updatedAt: number;
};

export type WarehouseAgent = {
  id: string;
  userId: string;
  agentCode: string;
  fullName: string;
  phoneNumber: string;
  assignedWarehouseIds: string[];
  status: "pending" | "approved" | "rejected" | "suspended" | "deactivated";
  createdAt: number;
  updatedAt: number;
};

export type Farmer = {
  id: string;
  userId?: string;
  farmerCode: string;
  fullName: string;
  phoneNumber: string;
  community: string;
  region?: string;
  preferredWarehouseId?: string;
  registrationSource: "self_app" | "agent_assisted" | "admin";
  verificationStatus: "pending" | "verified" | "rejected";
  status: "active" | "suspended" | "deactivated";
  createdAt: number;
  updatedAt: number;
};

export type Buyer = {
  id: string;
  userId?: string;
  fullName: string;
  phoneNumber: string;
  buyerType: "market_trader" | "retailer" | "restaurant" | "hotel" | "school" | "processor" | "exporter" | "institution" | "other";
  organizationName?: string;
  destinationMarket?: string;
  verificationStatus: "pending" | "verified" | "rejected";
  status: "active" | "suspended" | "deactivated";
  createdAt: number;
  updatedAt: number;
};

export type FeeRule = {
  id: string;
  code: string;
  label: string;
  scope: {
    warehouseId?: string;
    cropType?: string;
    unit?: string;
    grade?: "A" | "B" | "C" | "mixed" | "ungraded";
    destinationMarket?: string;
  };
  calculationType: "fixed_amount" | "per_unit" | "per_unit_per_day" | "percentage_of_gross_sale" | "percentage_of_transport_cost";
  payer: "farmer" | "buyer" | "platform" | "shared" | "included_in_price";
  amount?: number;
  percentage?: number;
  ratePerUnit?: number;
  ratePerUnitPerDay?: number;
  currency: string;
  status: "draft" | "active" | "inactive" | "archived";
  effectiveFrom: number;
  effectiveTo?: number;
  version: number;
  createdAt: number;
  updatedAt: number;
};

export type InventoryBatch = {
  id: string;
  receiptCode: string;
  farmerId: string;
  warehouseId: string;
  receivedByWarehouseAgentId: string;
  cropType: string;
  variety?: string;
  quantityReceived: number;
  quantityAvailable: number;
  unit: string;
  grade: "A" | "B" | "C" | "mixed" | "ungraded";
  status: "received" | "verified" | "available" | "partially_reserved" | "reserved" | "partially_sold" | "sold" | "prepared_for_dispatch" | "dispatched" | "withdrawn" | "expired" | "spoiled" | "disputed";
  receivedAt: number;
  sellByDate?: number;
  askingPricePerUnit?: number;
  storageFeeAccrued: number;
};

export type Dispute = {
  id: string;
  title: string;
  summary: string;
  entityType: "farmer" | "buyer" | "warehouse_agent" | "inventory_batch" | "buyer_order";
  entityId: string;
  status: "open" | "under_review" | "resolved" | "cancelled";
  createdAt: number;
  resolvedAt?: number;
  resolutionNotes?: string;
};

export type AuditLog = {
  id: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
  notes?: string;
  createdAt: number;
};

// Initial Seed Data
const defaultWarehouses: Warehouse[] = [
  {
    id: "wh-1",
    code: "WH-KUM-001",
    name: "Kumasi Central Hub",
    community: "Kumasi Central",
    district: "Kumasi Metropolitan",
    region: "Ashanti",
    servedCommunities: ["Adum", "Kejetia", "Bantama"],
    supportedCrops: ["Maize", "Cocoa", "Cassava", "Yam"],
    storageCapacity: 500,
    capacityUnit: "tonnes",
    assignedWarehouseAgentIds: ["agent-1"],
    destinationMarketsServed: ["Kumasi Central Market", "Techiman Market"],
    operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    dispatchDays: ["Tuesday", "Wednesday"],
    status: "active",
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
  },
  {
    id: "wh-2",
    code: "WH-SUN-002",
    name: "Sunyani Transit Depot",
    community: "Sunyani",
    district: "Sunyani Municipal",
    region: "Bono",
    servedCommunities: ["Fiapre", "Abesim", "Chiraa"],
    supportedCrops: ["Maize", "Yam", "Cashew"],
    storageCapacity: 250,
    capacityUnit: "tonnes",
    assignedWarehouseAgentIds: ["agent-2"],
    destinationMarketsServed: ["Sunyani Market"],
    operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
    dispatchDays: ["Wednesday"],
    status: "active",
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
  {
    id: "wh-3",
    code: "WH-TAM-003",
    name: "Tamale Silo Terminal",
    community: "Tamale Industrial",
    district: "Tamale Metropolitan",
    region: "Northern",
    servedCommunities: ["Savelugu", "Tolon", "Nyankpala"],
    supportedCrops: ["Maize", "Sorghum", "Millet", "Shea Nuts"],
    storageCapacity: 1000,
    capacityUnit: "tonnes",
    assignedWarehouseAgentIds: [],
    destinationMarketsServed: ["Tamale Central Market"],
    operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
    dispatchDays: ["Monday", "Wednesday", "Friday"],
    status: "maintenance",
    createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
  }
];

const defaultAgents: WarehouseAgent[] = [
  {
    id: "agent-1",
    userId: "user-agent-1",
    agentCode: "AGT-001",
    fullName: "Emmanuel Osei",
    phoneNumber: "+233 24 123 4567",
    assignedWarehouseIds: ["wh-1"],
    status: "approved",
    createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
  },
  {
    id: "agent-2",
    userId: "user-agent-2",
    agentCode: "AGT-002",
    fullName: "Abena Mensah",
    phoneNumber: "+233 27 987 6543",
    assignedWarehouseIds: ["wh-2"],
    status: "approved",
    createdAt: Date.now() - 50 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 50 * 24 * 60 * 60 * 1000,
  },
  {
    id: "agent-3",
    userId: "user-agent-3",
    agentCode: "AGT-003",
    fullName: "Kwame Boateng",
    phoneNumber: "+233 55 456 7890",
    assignedWarehouseIds: [],
    status: "pending",
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  }
];

const defaultFarmers: Farmer[] = [
  {
    id: "farmer-1",
    farmerCode: "FRM-KUM-001",
    fullName: "Kofi Mensah",
    phoneNumber: "+233 20 111 2222",
    community: "Bantama Farm Gate",
    region: "Ashanti",
    preferredWarehouseId: "wh-1",
    registrationSource: "agent_assisted",
    verificationStatus: "verified",
    status: "active",
    createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
  },
  {
    id: "farmer-2",
    farmerCode: "FRM-SUN-002",
    fullName: "Yaa Konadu",
    phoneNumber: "+233 50 333 4444",
    community: "Abesim South",
    region: "Bono",
    preferredWarehouseId: "wh-2",
    registrationSource: "self_app",
    verificationStatus: "pending",
    status: "active",
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: "farmer-3",
    farmerCode: "FRM-TAM-003",
    fullName: "Baba Sule",
    phoneNumber: "+233 24 555 6666",
    community: "Nyankpala West",
    region: "Northern",
    preferredWarehouseId: "wh-3",
    registrationSource: "admin",
    verificationStatus: "rejected",
    status: "suspended",
    createdAt: Date.now() - 40 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  }
];

const defaultBuyers: Buyer[] = [
  {
    id: "buyer-1",
    fullName: "Serwah Foods Ltd",
    phoneNumber: "+233 24 888 9999",
    buyerType: "processor",
    organizationName: "Serwah Agro-Processing",
    destinationMarket: "Accra Market",
    verificationStatus: "verified",
    status: "active",
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  },
  {
    id: "buyer-2",
    fullName: "John Doe",
    phoneNumber: "+233 54 222 3333",
    buyerType: "market_trader",
    destinationMarket: "Kumasi Central Market",
    verificationStatus: "pending",
    status: "active",
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  }
];

const defaultFeeRules: FeeRule[] = [
  {
    id: "rule-1",
    code: "FEE-MAI-001",
    label: "Standard Maize Storage Rate",
    scope: { cropType: "Maize", unit: "bag" },
    calculationType: "per_unit_per_day",
    payer: "farmer",
    ratePerUnitPerDay: 0.15,
    currency: "GHS",
    status: "active",
    effectiveFrom: Date.now() - 180 * 24 * 60 * 60 * 1000,
    version: 1,
    createdAt: Date.now() - 180 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 180 * 24 * 60 * 60 * 1000,
  },
  {
    id: "rule-2",
    code: "FEE-COCOA-001",
    label: "Premium Cocoa Storage Rate",
    scope: { cropType: "Cocoa", unit: "bag", grade: "A" },
    calculationType: "per_unit_per_day",
    payer: "farmer",
    ratePerUnitPerDay: 0.50,
    currency: "GHS",
    status: "active",
    effectiveFrom: Date.now() - 90 * 24 * 60 * 60 * 1000,
    version: 1,
    createdAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 90 * 24 * 60 * 60 * 1000,
  },
  {
    id: "rule-3",
    code: "FEE-PROC-001",
    label: "Platform Flat Processing Fee",
    scope: {},
    calculationType: "percentage_of_gross_sale",
    payer: "shared",
    percentage: 2.5,
    currency: "GHS",
    status: "active",
    effectiveFrom: Date.now() - 365 * 24 * 60 * 60 * 1000,
    version: 1,
    createdAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 365 * 24 * 60 * 60 * 1000,
  }
];

const defaultInventory: InventoryBatch[] = [
  {
    id: "batch-1",
    receiptCode: "RCP-KUM-802",
    farmerId: "farmer-1",
    warehouseId: "wh-1",
    receivedByWarehouseAgentId: "agent-1",
    cropType: "Maize",
    variety: "Obatanpa Quality Protein Maize",
    quantityReceived: 100,
    quantityAvailable: 85,
    unit: "bag",
    grade: "A",
    status: "available",
    receivedAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
    sellByDate: Date.now() + 180 * 24 * 60 * 60 * 1000,
    askingPricePerUnit: 250,
    storageFeeAccrued: 153.00,
  },
  {
    id: "batch-2",
    receiptCode: "RCP-KUM-803",
    farmerId: "farmer-1",
    warehouseId: "wh-1",
    receivedByWarehouseAgentId: "agent-1",
    cropType: "Cocoa",
    variety: "West African Amelonado",
    quantityReceived: 50,
    quantityAvailable: 50,
    unit: "bag",
    grade: "A",
    status: "available",
    receivedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    sellByDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
    askingPricePerUnit: 400,
    storageFeeAccrued: 100.00,
  },
  {
    id: "batch-3",
    receiptCode: "RCP-SUN-011",
    farmerId: "farmer-2",
    warehouseId: "wh-2",
    receivedByWarehouseAgentId: "agent-2",
    cropType: "Maize",
    variety: "Standard Yellow Maize",
    quantityReceived: 60,
    quantityAvailable: 30,
    unit: "bag",
    grade: "B",
    status: "partially_reserved",
    receivedAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    sellByDate: Date.now() + 5 * 24 * 60 * 60 * 1000,
    askingPricePerUnit: 220,
    storageFeeAccrued: 225.00,
  },
  {
    id: "batch-4",
    receiptCode: "RCP-TAM-909",
    farmerId: "farmer-3",
    warehouseId: "wh-3",
    receivedByWarehouseAgentId: "agent-2",
    cropType: "Yam",
    variety: "Pona",
    quantityReceived: 300,
    quantityAvailable: 0,
    unit: "tubers",
    grade: "C",
    status: "spoiled",
    receivedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    sellByDate: Date.now() - 5 * 24 * 60 * 60 * 1000,
    askingPricePerUnit: 15,
    storageFeeAccrued: 0,
  }
];

const defaultDisputes: Dispute[] = [
  {
    id: "disp-1",
    title: "Spoiled Yam Batch at Tamale",
    summary: "Farmer Baba Sule claims that the warehouse ventilation failure caused the spoilage of 300 tubers of Pona Yam, which was marked as grade C.",
    entityType: "inventory_batch",
    entityId: "batch-4",
    status: "open",
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: "disp-2",
    title: "Incorrect Storage Rate Application",
    summary: "Farmer Kofi Mensah claims that Cocoa Batch RCP-KUM-803 was charged GHS 0.50/day instead of flat GHS 0.15/day because it was mistakenly tagged as Grade A Cocoa instead of Standard Mixed.",
    entityType: "farmer",
    entityId: "farmer-1",
    status: "under_review",
    createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
  }
];

const defaultAuditLogs: AuditLog[] = [
  {
    id: "log-1",
    actorId: "admin-dev",
    actorName: "Dev Admin",
    actorRole: "admin",
    action: "fee_rule.created",
    entityType: "fee_rule",
    entityId: "rule-2",
    after: { code: "FEE-MAI-001", rate: 0.15, status: "active" },
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
  },
  {
    id: "log-2",
    actorId: "admin-dev",
    actorName: "Dev Admin",
    actorRole: "admin",
    action: "agent.approved",
    entityType: "warehouse_agent",
    entityId: "agent-1",
    before: { status: "pending" },
    after: { status: "approved" },
    createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
  }
];

export class MockDatabase {
  private static getStored<T>(key: string, defaultValue: T): T {
    if (typeof window === "undefined") return defaultValue;
    const item = localStorage.getItem(`kuapa_dwaso_admin_${key}`);
    return item ? JSON.parse(item) : defaultValue;
  }

  private static setStored<T>(key: string, value: T): void {
    if (typeof window !== "undefined") {
      localStorage.setItem(`kuapa_dwaso_admin_${key}`, JSON.stringify(value));
    }
  }

  // Getters
  public static getWarehouses(): Warehouse[] {
    return this.getStored("warehouses", defaultWarehouses);
  }

  public static getAgents(): WarehouseAgent[] {
    return this.getStored("agents", defaultAgents);
  }

  public static getFarmers(): Farmer[] {
    return this.getStored("farmers", defaultFarmers);
  }

  public static getBuyers(): Buyer[] {
    return this.getStored("buyers", defaultBuyers);
  }

  public static getFeeRules(): FeeRule[] {
    return this.getStored("feeRules", defaultFeeRules);
  }

  public static getInventory(): InventoryBatch[] {
    return this.getStored("inventory", defaultInventory);
  }

  public static getDisputes(): Dispute[] {
    return this.getStored("disputes", defaultDisputes);
  }

  public static getAuditLogs(): AuditLog[] {
    return this.getStored("auditLogs", defaultAuditLogs);
  }

  // Mutators
  public static updateAgentStatus(agentId: string, status: WarehouseAgent["status"], reason?: string): void {
    const agents = this.getAgents();
    const agentIndex = agents.findIndex((a) => a.id === agentId);
    if (agentIndex === -1) return;

    const agent = agents[agentIndex];
    if (!agent) return;
    const before = { ...agent };
    agent.status = status;
    agent.updatedAt = Date.now();
    this.setStored("agents", agents);

    this.addAuditLog("agent.status_updated", "warehouse_agent", agentId, before, { status }, `Status changed to ${status}. Reason: ${reason || "none"}`);
  }

  public static assignWarehouses(agentId: string, warehouseIds: string[]): void {
    const agents = this.getAgents();
    const agentIndex = agents.findIndex((a) => a.id === agentId);
    if (agentIndex === -1) return;

    const agent = agents[agentIndex];
    if (!agent) return;
    const before = { ...agent };
    agent.assignedWarehouseIds = warehouseIds;
    agent.updatedAt = Date.now();
    this.setStored("agents", agents);

    // Also update warehouses table
    const warehouses = this.getWarehouses();
    warehouses.forEach((wh) => {
      const isAssigned = warehouseIds.includes(wh.id);
      const agentIds = wh.assignedWarehouseAgentIds || [];
      const hasAgent = agentIds.includes(agentId);

      if (isAssigned && !hasAgent) {
        wh.assignedWarehouseAgentIds = [...agentIds, agentId];
      } else if (!isAssigned && hasAgent) {
        wh.assignedWarehouseAgentIds = agentIds.filter((id) => id !== agentId);
      }
    });
    this.setStored("warehouses", warehouses);

    this.addAuditLog("agent.warehouses_assigned", "warehouse_agent", agentId, before, { assignedWarehouseIds: warehouseIds }, `Assigned warehouses updated to: ${warehouseIds.join(", ")}`);
  }

  public static updateFarmerVerification(farmerId: string, status: Farmer["verificationStatus"], reason?: string): void {
    const farmers = this.getFarmers();
    const farmerIndex = farmers.findIndex((f) => f.id === farmerId);
    if (farmerIndex === -1) return;

    const farmer = farmers[farmerIndex];
    if (!farmer) return;
    const before = { ...farmer };
    farmer.verificationStatus = status;
    if (status === "verified") {
      farmer.status = "active";
    } else if (status === "rejected") {
      farmer.status = "deactivated";
    }
    farmer.updatedAt = Date.now();
    this.setStored("farmers", farmers);

    this.addAuditLog("farmer.verification_updated", "farmer", farmerId, before, { verificationStatus: status, status: farmer.status }, `Verification status changed to ${status}. Reason: ${reason || "none"}`);
  }

  public static createFeeRule(rule: Omit<FeeRule, "id" | "version" | "createdAt" | "updatedAt">): FeeRule {
    const rules = this.getFeeRules();
    const newRule: FeeRule = {
      ...rule,
      id: `rule-${Date.now()}`,
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    rules.push(newRule);
    this.setStored("feeRules", rules);

    this.addAuditLog("fee_rule.created", "fee_rule", newRule.id, undefined, newRule, `Fee rule ${newRule.code} created.`);
    return newRule;
  }

  public static updateFeeRuleVersion(ruleId: string, newRate: number, reason: string): void {
    const rules = this.getFeeRules();
    const ruleIndex = rules.findIndex((r) => r.id === ruleId);
    if (ruleIndex === -1) return;

    const oldRule = rules[ruleIndex];
    if (!oldRule) return;
    
    // Archive old rule
    const before = { ...oldRule };
    oldRule.status = "archived";
    oldRule.effectiveTo = Date.now();
    oldRule.updatedAt = Date.now();

    // Create new version without assigning explicit undefined to optional fields
    const newRule: FeeRule = {
      id: `rule-${Date.now()}`,
      code: before.code,
      label: before.label,
      scope: before.scope,
      calculationType: before.calculationType,
      payer: before.payer,
      currency: before.currency,
      status: "active",
      version: before.version + 1,
      effectiveFrom: Date.now(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (before.calculationType === "per_unit_per_day") {
      newRule.ratePerUnitPerDay = newRate;
    } else if (before.calculationType === "percentage_of_gross_sale") {
      newRule.percentage = newRate;
    } else if (before.calculationType === "fixed_amount") {
      newRule.amount = newRate;
    } else if (before.calculationType === "per_unit") {
      newRule.ratePerUnit = newRate;
    }

    rules.push(newRule);
    this.setStored("feeRules", rules);

    this.addAuditLog("fee_rule.versioned", "fee_rule", newRule.id, before, newRule, `Versioned ${oldRule.code} from v${oldRule.version} to v${newRule.version}. Reason: ${reason}`);
  }

  public static resolveDispute(disputeId: string, notes: string): void {
    const disputes = this.getDisputes();
    const disputeIndex = disputes.findIndex((d) => d.id === disputeId);
    if (disputeIndex === -1) return;

    const dispute = disputes[disputeIndex];
    if (!dispute) return;
    const before = { ...dispute };
    dispute.status = "resolved";
    dispute.resolvedAt = Date.now();
    dispute.resolutionNotes = notes;
    this.setStored("disputes", disputes);

    this.addAuditLog("dispute.resolved", "dispute", disputeId, before, { status: "resolved", notes }, `Dispute resolved: ${notes}`);
  }

  public static updateWarehouseStatus(warehouseId: string, status: Warehouse["status"], reason?: string): void {
    const warehouses = this.getWarehouses();
    const warehouseIndex = warehouses.findIndex((w) => w.id === warehouseId);
    if (warehouseIndex === -1) return;

    const warehouse = warehouses[warehouseIndex];
    if (!warehouse) return;
    const before = { ...warehouse };
    warehouse.status = status;
    warehouse.updatedAt = Date.now();
    this.setStored("warehouses", warehouses);

    this.addAuditLog("warehouse.status_updated", "warehouse", warehouseId, before, { status }, `Warehouse status updated to ${status}. Reason: ${reason || "none"}`);
  }

  private static addAuditLog(
    action: string,
    entityType: string,
    entityId: string,
    before?: Record<string, unknown>,
    after?: Record<string, unknown>,
    notes?: string,
  ): void {
    const logs = this.getAuditLogs();
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      actorId: "admin-dev",
      actorName: "Dev Admin",
      actorRole: "admin",
      action,
      entityType,
      entityId,
      createdAt: Date.now(),
    };
    if (before !== undefined) {
      newLog.before = before;
    }
    if (after !== undefined) {
      newLog.after = after;
    }
    if (notes !== undefined) {
      newLog.notes = notes;
    }
    logs.unshift(newLog);
    this.setStored("auditLogs", logs);
  }
}
