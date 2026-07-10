"use client";

/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import type React from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Doc, Id } from "../../../../convex/_generated/dataModel";
import { useOpsAuth } from "../auth/OpsAuthProvider";
import type {
  Farmer,
  FeeRuleSnapshot,
  InventoryBatch,
  InventoryBatchStatus,
  ProduceGrade,
  StorageFeeLedger,
  StorageRateRule,
  Warehouse,
  WarehouseAgent,
} from "@kuapa-dwaso/types";

export type Dispute = {
  id: string;
  title: string;
  summary: string;
  entityType:
    | "farmer"
    | "warehouse"
    | "warehouse_agent"
    | "inventory_batch"
    | "storage_receipt"
    | "buyer_order"
    | "sale_record"
    | "dispatch"
    | "storage_fee_ledger"
    | "buyer"
    | "notification"
    | "app_setting";
  entityId: string;
  status: "open" | "under_review" | "resolved" | "cancelled";
  warehouseId?: string;
  createdAt: number;
  resolvedAt?: number;
  resolutionNotes?: string;
};

type FarmerCreateInput = Omit<
  Farmer,
  "id" | "farmerCode" | "createdAt" | "updatedAt" | "registrationSource" | "verificationStatus" | "status"
>;

type IntakeInput = {
  farmerId: string;
  warehouseId?: string;
  cropType: string;
  variety?: string;
  grade: ProduceGrade;
  quantityReceived: number;
  quantityAvailable?: number;
  unit: string;
  receivedAt?: number;
  expectedShelfLifeDays?: number;
  sellByDate?: number;
  storageRateRuleId?: string;
  manualStorageRatePerUnitPerDay?: number;
  storageRateCurrency?: string;
  askingPricePerUnit?: number;
  minimumPricePerUnit?: number;
  conditionNotes?: string;
};

type SyncAction = {
  id: string;
  action: "CREATE_FARMER" | "CREATE_INTAKE" | "UPDATE_QTY" | "UPDATE_STATUS" | "UPDATE_CONDITION" | "CREATE_DISPUTE";
  payload: unknown;
  timestamp: number;
};

type TimelineEvent = {
  status: string;
  timestamp: number;
  actor: string;
  reason?: string;
};

type WarehouseContextType = {
  isOffline: boolean;
  setIsOffline: (val: boolean) => void;
  isLoading: boolean;
  errorMessage: string | undefined;
  actorUserId: string | undefined;
  syncQueue: SyncAction[];
  farmers: Farmer[];
  inventory: InventoryBatch[];
  disputes: Dispute[];
  storageRateRules: StorageRateRule[];
  activeWarehouse: Warehouse;
  assignedWarehouses: Warehouse[];
  activeAgent: WarehouseAgent;
  setActiveWarehouseId: (id: string) => void;
  draftIntake: any;
  setDraftIntake: (draft: any) => void;
  draftRegistration: any;
  setDraftRegistration: (draft: any) => void;
  registerFarmer: (farmer: FarmerCreateInput) => Promise<Farmer>;
  addIntake: (intake: IntakeInput) => Promise<InventoryBatch>;
  createDispute: (dispute: {
    title?: string;
    summary: string;
    entityType: Dispute["entityType"];
    entityId: string;
    warehouseId?: string;
  }) => Promise<Dispute>;
  updateBatchQuantity: (batchId: string, newQty: number, reason: string) => Promise<void>;
  updateBatchStatus: (batchId: string, status: InventoryBatchStatus, reason: string) => Promise<void>;
  updateBatchCondition: (batchId: string, notes: string) => Promise<void>;
  getBatchTimeline: (batchId: string) => TimelineEvent[];
  getStorageFeeLedger: (batchId: string) => StorageFeeLedger[];
  triggerSync: () => void;
};

const fallbackWarehouse: Warehouse = {
  id: "unassigned",
  code: "UNASSIGNED",
  name: "No assigned warehouse",
  community: "Assignment required",
  servedCommunities: [],
  supportedCrops: [],
  assignedWarehouseAgentIds: [],
  destinationMarketsServed: [],
  operatingDays: [],
  status: "inactive",
  createdAt: 0,
  updatedAt: 0,
};

const fallbackAgent: WarehouseAgent = {
  id: "unassigned",
  userId: "unassigned",
  agentCode: "UNASSIGNED",
  fullName: "Warehouse Agent",
  phoneNumber: "",
  assignedWarehouseIds: [],
  status: "pending",
  createdAt: 0,
  updatedAt: 0,
};

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

function getConfiguredActorUserId(): string | undefined {
  if (process.env.NEXT_PUBLIC_ENABLE_DEV_ACTOR_FALLBACK !== "true") {
    return undefined;
  }
  const envActorUserId = process.env.NEXT_PUBLIC_OPS_ACTOR_USER_ID;
  if (envActorUserId !== undefined && envActorUserId.trim().length > 0) {
    return envActorUserId.trim();
  }
  if (typeof window === "undefined") {
    return undefined;
  }
  const localActorUserId = window.localStorage.getItem("kuapa_ops_actor_user_id");
  return localActorUserId === null || localActorUserId.trim().length === 0
    ? undefined
    : localActorUserId.trim();
}

function toWarehouse(doc: Doc<"warehouses">): Warehouse {
  return { ...doc, id: doc._id };
}

function toWarehouseAgent(doc: Doc<"warehouseAgents">): WarehouseAgent {
  return { ...doc, id: doc._id, userId: doc.userId };
}

function toFarmer(doc: Doc<"farmers">): Farmer {
  const farmer: Farmer = {
    id: doc._id,
    farmerCode: doc.farmerCode,
    fullName: doc.fullName,
    phoneNumber: doc.phoneNumber,
    community: doc.community,
    registrationSource: doc.registrationSource,
    verificationStatus: doc.verificationStatus,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.userId !== undefined) farmer.userId = doc.userId;
  if (doc.region !== undefined) farmer.region = doc.region;
  if (doc.householdPhoneOwnerName !== undefined) farmer.householdPhoneOwnerName = doc.householdPhoneOwnerName;
  if (doc.preferredWarehouseId !== undefined) farmer.preferredWarehouseId = doc.preferredWarehouseId;
  return farmer;
}

function toInventoryBatch(doc: Doc<"inventoryBatches">): InventoryBatch {
  return {
    ...doc,
    id: doc._id,
    farmerId: doc.farmerId,
    warehouseId: doc.warehouseId,
    receivedByWarehouseAgentId: doc.receivedByWarehouseAgentId,
    storageRateSnapshot: doc.storageRateSnapshot as FeeRuleSnapshot,
  };
}

function toStorageRateRule(doc: Doc<"storageRateRules">): StorageRateRule {
  const rule: StorageRateRule = {
    id: doc._id,
    unit: doc.unit,
    ratePerUnitPerDay: doc.ratePerUnitPerDay,
    currency: doc.currency,
    status: doc.status,
    effectiveFrom: doc.effectiveFrom,
    version: doc.version,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
  if (doc.warehouseId !== undefined) rule.warehouseId = doc.warehouseId;
  if (doc.cropType !== undefined) rule.cropType = doc.cropType;
  if (doc.grade !== undefined) rule.grade = doc.grade;
  if (doc.effectiveTo !== undefined) rule.effectiveTo = doc.effectiveTo;
  return rule;
}

function toStorageFeeLedger(doc: Doc<"storageFeeLedger">): StorageFeeLedger {
  const ledger: StorageFeeLedger = {
    id: doc._id,
    inventoryBatchId: doc.inventoryBatchId,
    farmerId: doc.farmerId,
    warehouseId: doc.warehouseId,
    feeDate: doc.feeDate,
    quantityCharged: doc.quantityCharged,
    unit: doc.unit,
    appliedRuleSnapshot: doc.appliedRuleSnapshot as FeeRuleSnapshot,
    amount: doc.amount,
    status: doc.status,
    createdAt: doc.createdAt,
  };
  if (doc.amountDeducted !== undefined) ledger.amountDeducted = doc.amountDeducted;
  if (doc.deductedSaleRecordIds !== undefined) ledger.deductedSaleRecordIds = doc.deductedSaleRecordIds;
  return ledger;
}

function createLocalTimeline(batch: InventoryBatch): TimelineEvent[] {
  return [
    {
      status: batch.status,
      timestamp: batch.createdAt,
      actor: "Warehouse operations",
    },
  ];
}

export function WarehouseProvider({ children }: { children: React.ReactNode }) {
  const { principal, isLoading: isAuthLoading } = useOpsAuth();
  const [devActorUserId, setDevActorUserId] = useState<string | undefined>(() => getConfiguredActorUserId());
  const actorUserId = principal?.role === "warehouse_agent" ? principal.userId : devActorUserId;
  const [activeWarehouseId, setActiveWarehouseId] = useState<string | undefined>();
  const [isOffline, setIsOffline] = useState(false);
  const [syncQueue] = useState<SyncAction[]>([]);
  const [draftIntake, setDraftIntakeState] = useState<any>(null);
  const [draftRegistration, setDraftRegistrationState] = useState<any>(null);
  const [localDisputes, setLocalDisputes] = useState<Dispute[]>([]);
  const [localTimelines, setLocalTimelines] = useState<Record<string, TimelineEvent[]>>({});
  const [ledgerByBatchId, setLedgerByBatchId] = useState<Record<string, StorageFeeLedger[]>>({});
  const [actionError, setActionError] = useState<string | undefined>();

  useEffect(() => {
    setDevActorUserId(getConfiguredActorUserId());
    if (typeof window === "undefined") {
      return;
    }
    const getLocal = <T,>(key: string, fallback: T): T => {
      const value = window.localStorage.getItem(`kuapa_ops_${key}`);
      return value === null ? fallback : (JSON.parse(value) as T);
    };
    setDraftIntakeState(getLocal("draftIntake", null));
    setDraftRegistrationState(getLocal("draftRegistration", null));
    setIsOffline(getLocal("isOffline", false));
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kuapa_ops_isOffline", JSON.stringify(isOffline));
    }
  }, [isOffline]);

  const typedActorUserId = actorUserId as Id<"users"> | undefined;
  const agent = useQuery(
    api.warehouseAgents.getByUser,
    typedActorUserId === undefined
      ? "skip"
      : {
          actorUserId: typedActorUserId,
          userId: typedActorUserId,
        },
  ) as Doc<"warehouseAgents"> | null | undefined;

  const warehouseDocs = useQuery(api.warehouses.list, { status: "active", limit: 100 }) as
    | Doc<"warehouses">[]
    | undefined;

  const assignedWarehouses = useMemo(() => {
    if (agent === undefined || agent === null || warehouseDocs === undefined) {
      return [];
    }
    const assignedIds = new Set(agent.assignedWarehouseIds);
    return warehouseDocs.filter((warehouse) => assignedIds.has(warehouse._id)).map(toWarehouse);
  }, [agent, warehouseDocs]);

  useEffect(() => {
    if (assignedWarehouses.length === 0) {
      setActiveWarehouseId(undefined);
      return;
    }
    setActiveWarehouseId((current) =>
      current !== undefined && assignedWarehouses.some((warehouse) => warehouse.id === current)
        ? current
        : assignedWarehouses[0]?.id,
    );
  }, [assignedWarehouses]);

  const activeWarehouse = assignedWarehouses.find((warehouse) => warehouse.id === activeWarehouseId) ?? assignedWarehouses[0] ?? fallbackWarehouse;
  const typedActiveWarehouseId =
    activeWarehouse.id === fallbackWarehouse.id ? undefined : (activeWarehouse.id as Id<"warehouses">);

  const farmerDocs = useQuery(
    api.farmers.listByWarehouses,
    typedActorUserId === undefined || agent === undefined || agent === null
      ? "skip"
      : {
          actorUserId: typedActorUserId,
          warehouseIds: agent.assignedWarehouseIds,
          limit: 100,
        },
  ) as Doc<"farmers">[] | undefined;

  const inventoryDocs = useQuery(
    api.inventoryBatches.listWarehouseInventory,
    typedActorUserId === undefined || typedActiveWarehouseId === undefined
      ? "skip"
      : {
          actorUserId: typedActorUserId,
          warehouseId: typedActiveWarehouseId,
          limit: 100,
        },
  ) as Doc<"inventoryBatches">[] | undefined;

  const storageRateRuleDocs = useQuery(
    api.feeRules.listStorageRateRules,
    typedActiveWarehouseId === undefined
      ? "skip"
      : {
          status: "active",
          warehouseId: typedActiveWarehouseId,
          limit: 100,
        },
  ) as Doc<"storageRateRules">[] | undefined;

  const createFarmer = useMutation(api.farmers.createProfile);
  const createIntake = useMutation(api.inventoryBatches.createIntake);
  const updateInventoryDetails = useMutation(api.inventoryBatches.updateDetails);
  const updateInventoryStatus = useMutation(api.inventoryBatches.updateStatus);
  const createDisputeMutation = useMutation(api.disputes.create);

  const farmers = useMemo(() => (farmerDocs ?? []).map(toFarmer), [farmerDocs]);
  const inventory = useMemo(() => (inventoryDocs ?? []).map(toInventoryBatch), [inventoryDocs]);
  const storageRateRules = useMemo(
    () => (storageRateRuleDocs ?? []).map(toStorageRateRule),
    [storageRateRuleDocs],
  );
  const activeAgent = useMemo(
    () => (agent === undefined || agent === null ? fallbackAgent : toWarehouseAgent(agent)),
    [agent],
  );

  useEffect(() => {
    setLocalTimelines((current) => {
      const next = { ...current };
      for (const batch of inventory) {
        if (next[batch.id] === undefined) {
          next[batch.id] = createLocalTimeline(batch);
        }
      }
      return next;
    });
  }, [inventory]);

  const setDraftIntake = useCallback((draft: any) => {
    setDraftIntakeState(draft);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kuapa_ops_draftIntake", JSON.stringify(draft));
    }
  }, []);

  const setDraftRegistration = useCallback((draft: any) => {
    setDraftRegistrationState(draft);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("kuapa_ops_draftRegistration", JSON.stringify(draft));
    }
  }, []);

  const requireActor = useCallback((): Id<"users"> => {
    if (typedActorUserId === undefined) {
      throw new Error("Set NEXT_PUBLIC_OPS_ACTOR_USER_ID or localStorage kuapa_ops_actor_user_id to a warehouse-agent user id.");
    }
    return typedActorUserId;
  }, [typedActorUserId]);

  const registerFarmer = useCallback(
    async (farmerData: FarmerCreateInput) => {
      setActionError(undefined);
      const actorId = requireActor();
      const preferredWarehouseId = farmerData.preferredWarehouseId ?? activeWarehouse.id;
      const createArgs: Parameters<typeof createFarmer>[0] = {
        actorUserId: actorId,
        fullName: farmerData.fullName,
        phoneNumber: farmerData.phoneNumber,
        community: farmerData.community,
        preferredWarehouseId: preferredWarehouseId as Id<"warehouses">,
        registrationSource: "agent_assisted",
      };
      if (farmerData.region !== undefined) createArgs.region = farmerData.region;
      if (farmerData.householdPhoneOwnerName !== undefined) {
        createArgs.householdPhoneOwnerName = farmerData.householdPhoneOwnerName;
      }
      const farmerId = await createFarmer(createArgs);
      const farmer: Farmer = {
        id: farmerId,
        farmerCode: "Pending refresh",
        fullName: farmerData.fullName,
        phoneNumber: farmerData.phoneNumber,
        community: farmerData.community,
        preferredWarehouseId,
        registrationSource: "agent_assisted",
        verificationStatus: "pending",
        status: "active",
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      if (farmerData.userId !== undefined) farmer.userId = farmerData.userId;
      if (farmerData.region !== undefined) farmer.region = farmerData.region;
      if (farmerData.householdPhoneOwnerName !== undefined) {
        farmer.householdPhoneOwnerName = farmerData.householdPhoneOwnerName;
      }
      setDraftRegistration(null);
      return farmer;
    },
    [activeWarehouse.id, createFarmer, requireActor, setDraftRegistration],
  );

  const addIntake = useCallback(
    async (intakeData: IntakeInput) => {
      setActionError(undefined);
      const actorId = requireActor();
      const warehouseId = (intakeData.warehouseId ?? activeWarehouse.id) as Id<"warehouses">;
      const createArgs: Parameters<typeof createIntake>[0] = {
        actorUserId: actorId,
        farmerId: intakeData.farmerId as Id<"farmers">,
        warehouseId,
        cropType: intakeData.cropType,
        quantityReceived: intakeData.quantityReceived,
        unit: intakeData.unit,
        grade: intakeData.grade,
      };
      if (intakeData.variety !== undefined) createArgs.variety = intakeData.variety;
      if (intakeData.conditionNotes !== undefined) createArgs.conditionNotes = intakeData.conditionNotes;
      if (intakeData.receivedAt !== undefined) createArgs.receivedAt = intakeData.receivedAt;
      if (intakeData.expectedShelfLifeDays !== undefined) {
        createArgs.expectedShelfLifeDays = intakeData.expectedShelfLifeDays;
      }
      if (intakeData.sellByDate !== undefined) createArgs.sellByDate = intakeData.sellByDate;
      if (intakeData.storageRateRuleId !== undefined) {
        createArgs.storageRateRuleId = intakeData.storageRateRuleId as Id<"storageRateRules">;
      }
      if (intakeData.manualStorageRatePerUnitPerDay !== undefined) {
        createArgs.manualStorageRatePerUnitPerDay = intakeData.manualStorageRatePerUnitPerDay;
      }
      if (intakeData.storageRateCurrency !== undefined) createArgs.storageRateCurrency = intakeData.storageRateCurrency;
      if (intakeData.askingPricePerUnit !== undefined) createArgs.askingPricePerUnit = intakeData.askingPricePerUnit;
      if (intakeData.minimumPricePerUnit !== undefined) {
        createArgs.minimumPricePerUnit = intakeData.minimumPricePerUnit;
      }
      const inventoryBatchId = await createIntake(createArgs);
      const now = Date.now();
      const batch: InventoryBatch = {
        id: inventoryBatchId,
        receiptCode: "Pending refresh",
        farmerId: intakeData.farmerId,
        warehouseId,
        receivedByWarehouseAgentId: activeAgent.id,
        cropType: intakeData.cropType,
        quantityReceived: intakeData.quantityReceived,
        quantityAvailable: intakeData.quantityReceived,
        unit: intakeData.unit,
        grade: intakeData.grade,
        photos: [],
        receivedAt: intakeData.receivedAt ?? now,
        storageRateSnapshot: {
          label: "Storage fee",
          calculationType: "per_unit_per_day",
          payer: "farmer",
          ratePerUnitPerDay: intakeData.manualStorageRatePerUnitPerDay ?? 0,
          currency: intakeData.storageRateCurrency ?? "GHS",
          snapshottedAt: now,
        },
        storageFeeAccrued: 0,
        lastFeeCalculatedAt: intakeData.receivedAt ?? now,
        status: "received",
        createdAt: now,
        updatedAt: now,
      };
      if (intakeData.variety !== undefined) batch.variety = intakeData.variety;
      if (intakeData.conditionNotes !== undefined) batch.conditionNotes = intakeData.conditionNotes;
      if (intakeData.expectedShelfLifeDays !== undefined) {
        batch.expectedShelfLifeDays = intakeData.expectedShelfLifeDays;
      }
      if (intakeData.sellByDate !== undefined) batch.sellByDate = intakeData.sellByDate;
      if (intakeData.askingPricePerUnit !== undefined) batch.askingPricePerUnit = intakeData.askingPricePerUnit;
      if (intakeData.minimumPricePerUnit !== undefined) batch.minimumPricePerUnit = intakeData.minimumPricePerUnit;
      setLocalTimelines((current) => ({
        ...current,
        [inventoryBatchId]: createLocalTimeline(batch),
      }));
      setDraftIntake(null);
      return batch;
    },
    [activeAgent.id, activeWarehouse.id, createIntake, requireActor, setDraftIntake],
  );

  const createDispute = useCallback(
    async (disputeData: {
      title?: string;
      summary: string;
      entityType: Dispute["entityType"];
      entityId: string;
      warehouseId?: string;
    }) => {
      setActionError(undefined);
      const actorId = requireActor();
      const summary = disputeData.title === undefined || disputeData.title.trim().length === 0
        ? disputeData.summary
        : `${disputeData.title}: ${disputeData.summary}`;
      const disputeId = await createDisputeMutation({
        actorId,
        actorUserId: actorId,
        actorRole: "warehouse_agent",
        entityType: disputeData.entityType,
        entityId: disputeData.entityId,
        openedByUserId: actorId,
        warehouseId: (disputeData.warehouseId ?? activeWarehouse.id) as Id<"warehouses">,
        summary,
      });
      const dispute: Dispute = {
        id: disputeId,
        title: disputeData.title ?? "Operational issue",
        summary,
        entityType: disputeData.entityType,
        entityId: disputeData.entityId,
        warehouseId: disputeData.warehouseId ?? activeWarehouse.id,
        status: "open",
        createdAt: Date.now(),
      };
      setLocalDisputes((current) => [dispute, ...current]);
      return dispute;
    },
    [activeWarehouse.id, createDisputeMutation, requireActor],
  );

  const updateBatchQuantity = useCallback(
    async (batchId: string, newQty: number, reason: string) => {
      setActionError(undefined);
      const actorId = requireActor();
      await updateInventoryDetails({
        actorUserId: actorId,
        inventoryBatchId: batchId as Id<"inventoryBatches">,
        quantityAvailable: newQty,
        reason,
      });
      setLocalTimelines((current) => ({
        ...current,
        [batchId]: [
          ...(current[batchId] ?? []),
          {
            status: "details_updated",
            timestamp: Date.now(),
            actor: activeAgent.fullName,
            reason: `Adjusted quantity: ${reason}`,
          },
        ],
      }));
    },
    [activeAgent.fullName, requireActor, updateInventoryDetails],
  );

  const updateBatchStatus = useCallback(
    async (batchId: string, status: InventoryBatchStatus, reason: string) => {
      setActionError(undefined);
      const actorId = requireActor();
      await updateInventoryStatus({
        actorUserId: actorId,
        inventoryBatchId: batchId as Id<"inventoryBatches">,
        status,
        reason,
      });
      setLocalTimelines((current) => ({
        ...current,
        [batchId]: [
          ...(current[batchId] ?? []),
          {
            status,
            timestamp: Date.now(),
            actor: activeAgent.fullName,
            reason,
          },
        ],
      }));
    },
    [activeAgent.fullName, requireActor, updateInventoryStatus],
  );

  const updateBatchCondition = useCallback(
    async (batchId: string, notes: string) => {
      setActionError(undefined);
      const actorId = requireActor();
      await updateInventoryDetails({
        actorUserId: actorId,
        inventoryBatchId: batchId as Id<"inventoryBatches">,
        conditionNotes: notes,
        reason: "Condition notes updated by warehouse agent.",
      });
    },
    [requireActor, updateInventoryDetails],
  );

  const getBatchTimeline = useCallback(
    (batchId: string) => localTimelines[batchId] ?? [],
    [localTimelines],
  );

  const getStorageFeeLedger = useCallback(
    (batchId: string) => ledgerByBatchId[batchId] ?? [],
    [ledgerByBatchId],
  );

  const isLoading =
    isAuthLoading ||
    (actorUserId !== undefined &&
    (agent === undefined ||
      warehouseDocs === undefined ||
      (typedActiveWarehouseId !== undefined && (farmerDocs === undefined || inventoryDocs === undefined))));

  const errorMessage =
    actionError ??
    (actorUserId === undefined
      ? "Sign in with a warehouse-agent Firebase account. Dev actor fallback requires NEXT_PUBLIC_ENABLE_DEV_ACTOR_FALLBACK=true."
      : principal !== null && principal !== undefined && principal.role !== "warehouse_agent"
        ? "The signed-in platform principal is not a warehouse agent."
      : agent === null
        ? "No warehouse-agent profile was found for this actor user."
        : agent !== undefined && assignedWarehouses.length === 0
          ? "This warehouse agent has no active assigned warehouses."
          : undefined);

  const value = useMemo<WarehouseContextType>(
    () => ({
      isOffline,
      setIsOffline,
      isLoading,
      errorMessage,
      actorUserId,
      syncQueue,
      farmers,
      inventory,
      disputes: localDisputes,
      storageRateRules,
      activeWarehouse,
      assignedWarehouses,
      activeAgent,
      setActiveWarehouseId: (id: string) => {
        setActiveWarehouseId(id);
      },
      draftIntake,
      setDraftIntake,
      draftRegistration,
      setDraftRegistration,
      registerFarmer,
      addIntake,
      createDispute,
      updateBatchQuantity,
      updateBatchStatus,
      updateBatchCondition,
      getBatchTimeline,
      getStorageFeeLedger,
      triggerSync: () => undefined,
    }),
    [
      addIntake,
      actorUserId,
      activeAgent,
      activeWarehouse,
      assignedWarehouses,
      createDispute,
      draftIntake,
      draftRegistration,
      errorMessage,
      farmers,
      getBatchTimeline,
      getStorageFeeLedger,
      inventory,
      isLoading,
      isOffline,
      localDisputes,
      registerFarmer,
      setDraftIntake,
      setDraftRegistration,
      storageRateRules,
      syncQueue,
      updateBatchCondition,
      updateBatchQuantity,
      updateBatchStatus,
    ],
  );

  void setActionError;
  void setLedgerByBatchId;
  void toStorageFeeLedger;

  return <WarehouseContext.Provider value={value}>{children}</WarehouseContext.Provider>;
}

export function useWarehouse() {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error("useWarehouse must be used within a WarehouseProvider");
  }
  return context;
}
