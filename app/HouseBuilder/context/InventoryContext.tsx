"use client";

import React, { createContext, useContext, ReactNode } from 'react';
import { useInventory, PanelInventory, ComponentSpec } from '../hooks/useInventory';

interface InventoryContextType {
  inventory: PanelInventory;
  updateInventoryFromHouse: (house: any) => void;
  getTotalCost: () => number;
  getTotalWeight: () => number;
  getInventorySummary: () => Array<{
    type: string;
    count: number;
    spec: ComponentSpec | undefined;
    totalCost: number;
    totalWeight: number;
  }>;
  PANEL_SPECS: Record<string, ComponentSpec>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const inventoryHook = useInventory();

  return (
    <InventoryContext.Provider value={inventoryHook}>
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventoryContext = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventoryContext must be used within an InventoryProvider');
  }
  return context;
};
