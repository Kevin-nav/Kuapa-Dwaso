"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type { 
  Farmer, 
  InventoryBatch, 
  Warehouse, 
  WarehouseAgent,
  InventoryBatchStatus,
  FeeRuleSnapshot
} from "@kuapa-dwaso/types";

// Declare Dispute locally since it is not in the shared @kuapa-dwaso/types
export type Dispute = {
  id: string;
  title: string;
  summary: string;
  entityType: "farmer" | "buyer" | "warehouse_agent" | "inventory_batch" | "buyer_order" | "storage_receipt";
  entityId: string;
  status: "open" | "under_review" | "resolved" | "cancelled";
  createdAt: number;
  resolvedAt?: number;
  resolutionNotes?: string;
};

// Seed Data matching packages/dashboard-ui/src/mockDb.ts
const defaultWarehouse: Warehouse = {
  id: "wh-1",
  code: "WH-KUM-001",
  name: "Kumasi Central Warehouse",
  community: "Kumasi Central",
  district: "Kumasi Metropolitan",
  region: "Ashanti",
  servedCommunities: ["Adum", "Kejetia", "Bantama", "Bantama Farm Gate"],
  supportedCrops: ["Maize", "Cocoa", "Cassava", "Yam", "Tomato"],
  storageCapacity: 500,
  capacityUnit: "tonnes",
  assignedWarehouseAgentIds: ["agent-1"],
  destinationMarketsServed: ["Kumasi Central Market", "Techiman Market"],
  operatingDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  dispatchDays: ["Tuesday", "Wednesday"],
  status: "active",
  createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
  updatedAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
};

const defaultAgent: WarehouseAgent = {
  id: "agent-1",
  userId: "user-agent-1",
  agentCode: "AGT-001",
  fullName: "Emmanuel Osei",
  phoneNumber: "+233 24 123 4567",
  assignedWarehouseIds: ["wh-1"],
  status: "approved",
  createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
  updatedAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
};

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
    photos: [],
    receivedAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
    sellByDate: Date.now() + 180 * 24 * 60 * 60 * 1000,
    askingPricePerUnit: 250,
    storageFeeAccrued: 18.00,
    lastFeeCalculatedAt: Date.now(),
    storageRateSnapshot: {
      label: "Standard Maize Storage Rate",
      calculationType: "per_unit_per_day",
      payer: "farmer",
      ratePerUnitPerDay: 0.15,
      currency: "GHS",
      snapshottedAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
    },
    createdAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 12 * 24 * 60 * 60 * 1000,
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
    photos: [],
    receivedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    sellByDate: Date.now() + 365 * 24 * 60 * 60 * 1000,
    askingPricePerUnit: 400,
    storageFeeAccrued: 100.00,
    lastFeeCalculatedAt: Date.now(),
    storageRateSnapshot: {
      label: "Premium Cocoa Storage Rate",
      calculationType: "per_unit_per_day",
      payer: "farmer",
      ratePerUnitPerDay: 0.50,
      currency: "GHS",
      snapshottedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    },
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
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
    photos: [],
    receivedAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    sellByDate: Date.now() + 5 * 24 * 60 * 60 * 1000,
    askingPricePerUnit: 220,
    storageFeeAccrued: 225.00,
    lastFeeCalculatedAt: Date.now(),
    storageRateSnapshot: {
      label: "Standard Maize Storage Rate",
      calculationType: "per_unit_per_day",
      payer: "farmer",
      ratePerUnitPerDay: 0.15,
      currency: "GHS",
      snapshottedAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    },
    createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
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
    photos: [],
    receivedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    sellByDate: Date.now() - 5 * 24 * 60 * 60 * 1000,
    askingPricePerUnit: 15,
    storageFeeAccrued: 0,
    lastFeeCalculatedAt: Date.now(),
    storageRateSnapshot: {
      label: "Flat Yam Storage Rate",
      calculationType: "per_unit_per_day",
      payer: "farmer",
      ratePerUnitPerDay: 0.05,
      currency: "GHS",
      snapshottedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    },
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
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

type SyncAction = {
  id: string;
  action: "CREATE_FARMER" | "CREATE_INTAKE" | "UPDATE_QTY" | "UPDATE_STATUS" | "UPDATE_CONDITION" | "CREATE_DISPUTE";
  payload: any;
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
  syncQueue: SyncAction[];
  farmers: Farmer[];
  inventory: InventoryBatch[];
  disputes: Dispute[];
  activeWarehouse: Warehouse;
  activeAgent: WarehouseAgent;
  draftIntake: any;
  setDraftIntake: (draft: any) => void;
  draftRegistration: any;
  setDraftRegistration: (draft: any) => void;
  registerFarmer: (farmer: Omit<Farmer, "id" | "farmerCode" | "createdAt" | "updatedAt" | "registrationSource" | "verificationStatus" | "status">) => Farmer;
  addIntake: (intake: Omit<InventoryBatch, "id" | "receiptCode" | "createdAt" | "updatedAt" | "receivedByWarehouseAgentId" | "warehouseId" | "lastFeeCalculatedAt" | "storageRateSnapshot" | "storageFeeAccrued" | "photos" | "status">) => InventoryBatch;
  createDispute: (dispute: Omit<Dispute, "id" | "createdAt" | "status">) => Dispute;
  updateBatchQuantity: (batchId: string, newQty: number, reason: string) => void;
  updateBatchStatus: (batchId: string, status: InventoryBatchStatus, reason: string) => void;
  updateBatchCondition: (batchId: string, notes: string) => void;
  getBatchTimeline: (batchId: string) => TimelineEvent[];
  triggerSync: () => void;
};

const WarehouseContext = createContext<WarehouseContextType | undefined>(undefined);

export function WarehouseProvider({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [syncQueue, setSyncQueue] = useState<SyncAction[]>([]);
  const [farmers, setFarmers] = useState<Farmer[]>([]);
  const [inventory, setInventory] = useState<InventoryBatch[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  
  const [draftIntake, setDraftIntakeState] = useState<any>(null);
  const [draftRegistration, setDraftRegistrationState] = useState<any>(null);

  const [timelines, setTimelines] = useState<Record<string, TimelineEvent[]>>({});

  useEffect(() => {
    if (typeof window !== "undefined") {
      const getLocal = <T,>(key: string, def: T): T => {
        const val = localStorage.getItem(`kuapa_ops_${key}`);
        return val ? JSON.parse(val) : def;
      };

      setFarmers(getLocal("farmers", defaultFarmers));
      setInventory(getLocal("inventory", defaultInventory));
      setDisputes(getLocal("disputes", defaultDisputes));
      setSyncQueue(getLocal("syncQueue", []));
      setDraftIntakeState(getLocal("draftIntake", null));
      setDraftRegistrationState(getLocal("draftRegistration", null));
      setIsOffline(getLocal("isOffline", false));
      setTimelines(getLocal("timelines", {
        "batch-1": [
          { status: "received", timestamp: Date.now() - 12 * 24 * 60 * 60 * 1000, actor: "Emmanuel Osei" },
          { status: "verified", timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, actor: "Emmanuel Osei" },
          { status: "available", timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, actor: "Emmanuel Osei" },
        ],
        "batch-2": [
          { status: "received", timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, actor: "Emmanuel Osei" },
          { status: "available", timestamp: Date.now() - 4 * 24 * 60 * 60 * 1000, actor: "Emmanuel Osei" },
        ],
        "batch-3": [
          { status: "received", timestamp: Date.now() - 25 * 24 * 60 * 60 * 1000, actor: "Abena Mensah" },
          { status: "partially_reserved", timestamp: Date.now() - 15 * 24 * 60 * 60 * 1000, actor: "Abena Mensah" },
        ],
        "batch-4": [
          { status: "received", timestamp: Date.now() - 45 * 24 * 60 * 60 * 1000, actor: "Abena Mensah" },
          { status: "spoiled", timestamp: Date.now() - 5 * 24 * 60 * 60 * 1000, actor: "Emmanuel Osei", reason: "Ventilation breakdown" },
        ]
      }));

      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("kuapa_ops_farmers", JSON.stringify(farmers));
      localStorage.setItem("kuapa_ops_inventory", JSON.stringify(inventory));
      localStorage.setItem("kuapa_ops_disputes", JSON.stringify(disputes));
      localStorage.setItem("kuapa_ops_syncQueue", JSON.stringify(syncQueue));
      localStorage.setItem("kuapa_ops_isOffline", JSON.stringify(isOffline));
      localStorage.setItem("kuapa_ops_timelines", JSON.stringify(timelines));
    }
  }, [farmers, inventory, disputes, syncQueue, isOffline, timelines, isHydrated]);

  const setDraftIntake = (draft: any) => {
    setDraftIntakeState(draft);
    if (typeof window !== "undefined") {
      localStorage.setItem("kuapa_ops_draftIntake", JSON.stringify(draft));
    }
  };

  const setDraftRegistration = (draft: any) => {
    setDraftRegistrationState(draft);
    if (typeof window !== "undefined") {
      localStorage.setItem("kuapa_ops_draftRegistration", JSON.stringify(draft));
    }
  };

  const executeAction = (actionType: string, payload: any) => {
    switch (actionType) {
      case "CREATE_FARMER": {
        setFarmers(prev => {
          if (prev.some(f => f.id === payload.id)) return prev;
          return [...prev, payload];
        });
        break;
      }
      case "CREATE_INTAKE": {
        setInventory(prev => {
          if (prev.some(b => b.id === payload.id)) return prev;
          return [payload, ...prev];
        });
        setTimelines(prev => ({
          ...prev,
          [payload.id]: [
            { status: payload.status, timestamp: payload.receivedAt, actor: "Emmanuel Osei" }
          ]
        }));
        break;
      }
      case "UPDATE_QTY": {
        setInventory(prev => prev.map(b => b.id === payload.batchId ? { 
          ...b, 
          quantityAvailable: payload.newQty,
          status: payload.newQty === 0 ? "spoiled" as const : b.status,
          updatedAt: Date.now() 
        } : b));
        setTimelines(prev => ({
          ...prev,
          [payload.batchId]: [
            ...(prev[payload.batchId] || []),
            { 
              status: payload.newQty === 0 ? "spoiled" : "adjusted", 
              timestamp: Date.now(), 
              actor: "Emmanuel Osei", 
              reason: `Adjusted quantity: ${payload.reason}` 
            }
          ]
        }));
        break;
      }
      case "UPDATE_STATUS": {
        setInventory(prev => prev.map(b => b.id === payload.batchId ? { 
          ...b, 
          status: payload.status, 
          updatedAt: Date.now() 
        } : b));
        setTimelines(prev => ({
          ...prev,
          [payload.batchId]: [
            ...(prev[payload.batchId] || []),
            { 
              status: payload.status, 
              timestamp: Date.now(), 
              actor: "Emmanuel Osei", 
              reason: payload.reason 
            }
          ]
        }));
        break;
      }
      case "UPDATE_CONDITION": {
        setInventory(prev => prev.map(b => b.id === payload.batchId ? { 
          ...b, 
          conditionNotes: payload.notes, 
          updatedAt: Date.now() 
        } : b));
        break;
      }
      case "CREATE_DISPUTE": {
        setDisputes(prev => {
          if (prev.some(d => d.id === payload.id)) return prev;
          return [payload, ...prev];
        });
        break;
      }
    }
  };

  const triggerSync = () => {
    if (syncQueue.length === 0) return;
    const sortedQueue = [...syncQueue].sort((a, b) => a.timestamp - b.timestamp);
    sortedQueue.forEach(item => {
      executeAction(item.action, item.payload);
    });
    setSyncQueue([]);
  };

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (!isOffline && isHydrated && syncQueue.length > 0) {
      timer = setTimeout(() => {
        triggerSync();
      }, 1500);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isOffline, syncQueue, isHydrated]);

  const registerFarmer = (farmerData: Omit<Farmer, "id" | "farmerCode" | "createdAt" | "updatedAt" | "registrationSource" | "verificationStatus" | "status">) => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const codePrefix = farmerData.region === "Ashanti" ? "KUM" : farmerData.region === "Bono" ? "SUN" : "TAM";
    const farmer: Farmer = {
      ...farmerData,
      id: `farmer-${Date.now()}`,
      farmerCode: `FRM-${codePrefix}-${randomSuffix}`,
      registrationSource: "agent_assisted",
      verificationStatus: "verified",
      status: "active",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (isOffline) {
      setSyncQueue(prev => [...prev, {
        id: `sync-${Date.now()}-${Math.random()}`,
        action: "CREATE_FARMER",
        payload: farmer,
        timestamp: Date.now()
      }]);
      setFarmers(prev => [...prev, farmer]);
    } else {
      executeAction("CREATE_FARMER", farmer);
    }

    setDraftRegistration(null);
    return farmer;
  };

  const addIntake = (intakeData: Omit<InventoryBatch, "id" | "receiptCode" | "createdAt" | "updatedAt" | "receivedByWarehouseAgentId" | "warehouseId" | "lastFeeCalculatedAt" | "storageRateSnapshot" | "storageFeeAccrued" | "photos" | "status">) => {
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const codePrefix = defaultWarehouse.region === "Ashanti" ? "KUM" : defaultWarehouse.region === "Bono" ? "SUN" : "TAM";
    
    const ratePerDay = intakeData.cropType.toLowerCase() === "cocoa" ? 0.50 : intakeData.cropType.toLowerCase() === "maize" ? 0.15 : 0.05;
    const rateLabel = `${intakeData.cropType} Standard Rate`;

    const storageRateSnapshot: FeeRuleSnapshot = {
      label: rateLabel,
      calculationType: "per_unit_per_day",
      payer: "farmer",
      ratePerUnitPerDay: ratePerDay,
      currency: "GHS",
      snapshottedAt: Date.now(),
    };

    const batch: InventoryBatch = {
      ...intakeData,
      id: `batch-${Date.now()}`,
      receiptCode: `RCP-${codePrefix}-${randomSuffix}`,
      receivedByWarehouseAgentId: defaultAgent.id,
      warehouseId: defaultWarehouse.id,
      photos: [],
      storageFeeAccrued: 0,
      lastFeeCalculatedAt: Date.now(),
      storageRateSnapshot,
      status: "received",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (isOffline) {
      setSyncQueue(prev => [...prev, {
        id: `sync-${Date.now()}-${Math.random()}`,
        action: "CREATE_INTAKE",
        payload: batch,
        timestamp: Date.now()
      }]);
      setInventory(prev => [batch, ...prev]);
      setTimelines(prev => ({
        ...prev,
        [batch.id]: [{ status: "received", timestamp: batch.receivedAt, actor: "Emmanuel Osei" }]
      }));
    } else {
      executeAction("CREATE_INTAKE", batch);
    }

    setDraftIntake(null);
    return batch;
  };

  const createDispute = (disputeData: Omit<Dispute, "id" | "createdAt" | "status">) => {
    const dispute: Dispute = {
      ...disputeData,
      id: `disp-${Date.now()}`,
      status: "open",
      createdAt: Date.now()
    };

    if (isOffline) {
      setSyncQueue(prev => [...prev, {
        id: `sync-${Date.now()}-${Math.random()}`,
        action: "CREATE_DISPUTE",
        payload: dispute,
        timestamp: Date.now()
      }]);
      setDisputes(prev => [dispute, ...prev]);
    } else {
      executeAction("CREATE_DISPUTE", dispute);
    }
    return dispute;
  };

  const updateBatchQuantity = (batchId: string, newQty: number, reason: string) => {
    const payload = { batchId, newQty, reason };
    if (isOffline) {
      setSyncQueue(prev => [...prev, {
        id: `sync-${Date.now()}-${Math.random()}`,
        action: "UPDATE_QTY",
        payload,
        timestamp: Date.now()
      }]);
      setInventory(prev => prev.map(b => b.id === batchId ? { 
        ...b, 
        quantityAvailable: newQty, 
        status: newQty === 0 ? "spoiled" : b.status 
      } : b));
      setTimelines(prev => ({
        ...prev,
        [batchId]: [
          ...(prev[batchId] || []),
          { 
            status: newQty === 0 ? "spoiled" : "adjusted", 
            timestamp: Date.now(), 
            actor: "Emmanuel Osei", 
            reason: `Offline Pending: Adjusted quantity to ${newQty} kg. Reason: ${reason}` 
          }
        ]
      }));
    } else {
      executeAction("UPDATE_QTY", payload);
    }
  };

  const updateBatchStatus = (batchId: string, status: InventoryBatchStatus, reason: string) => {
    const payload = { batchId, status, reason };
    if (isOffline) {
      setSyncQueue(prev => [...prev, {
        id: `sync-${Date.now()}-${Math.random()}`,
        action: "UPDATE_STATUS",
        payload,
        timestamp: Date.now()
      }]);
      setInventory(prev => prev.map(b => b.id === batchId ? { ...b, status } : b));
      setTimelines(prev => ({
        ...prev,
        [batchId]: [
          ...(prev[batchId] || []),
          { 
            status, 
            timestamp: Date.now(), 
            actor: "Emmanuel Osei", 
            reason: `Offline Pending: Changed status to ${status}. Reason: ${reason}` 
          }
        ]
      }));
    } else {
      executeAction("UPDATE_STATUS", payload);
    }
  };

  const updateBatchCondition = (batchId: string, notes: string) => {
    const payload = { batchId, notes };
    if (isOffline) {
      setSyncQueue(prev => [...prev, {
        id: `sync-${Date.now()}-${Math.random()}`,
        action: "UPDATE_CONDITION",
        payload,
        timestamp: Date.now()
      }]);
      setInventory(prev => prev.map(b => b.id === batchId ? { ...b, conditionNotes: notes } : b));
    } else {
      executeAction("UPDATE_CONDITION", payload);
    }
  };

  const getBatchTimeline = (batchId: string) => {
    return timelines[batchId] || [];
  };

  return (
    <WarehouseContext.Provider value={{
      isOffline,
      setIsOffline,
      syncQueue,
      farmers,
      inventory,
      disputes,
      activeWarehouse: defaultWarehouse,
      activeAgent: defaultAgent,
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
      triggerSync
    }}>
      {children}
    </WarehouseContext.Provider>
  );
}

export function useWarehouse() {
  const context = useContext(WarehouseContext);
  if (!context) {
    throw new Error("useWarehouse must be used within a WarehouseProvider");
  }
  return context;
}
