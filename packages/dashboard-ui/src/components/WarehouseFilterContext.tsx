// packages/dashboard-ui/src/components/WarehouseFilterContext.tsx
"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type WarehouseFilterContextType = {
  selectedWarehouseId: string; // "all" or specific warehouse ID
  setSelectedWarehouseId: (id: string) => void;
};

const WarehouseFilterContext = createContext<WarehouseFilterContextType | undefined>(undefined);

export function WarehouseFilterProvider({ children }: { children: ReactNode }) {
  const [selectedWarehouseId, setSelectedWarehouseId] = useState<string>("all");

  return (
    <WarehouseFilterContext.Provider value={{ selectedWarehouseId, setSelectedWarehouseId }}>
      {children}
    </WarehouseFilterContext.Provider>
  );
}

export function useWarehouseFilter() {
  const context = useContext(WarehouseFilterContext);
  if (!context) {
    throw new Error("useWarehouseFilter must be used within a WarehouseFilterProvider");
  }
  return context;
}
