"use client";

import { useState, useCallback } from 'react';

// Panel inventory interface
export interface PanelInventory {
  panel_4x8: number;
  corner_panel: number;
  floor_panel: number;
}

// Component specifications for cost calculations
export interface ComponentSpec {
  sku: string;
  name: string;
  category: string;
  width: number;
  height: number;
  thickness: number;
  material: string;
  weight: number;
  price: number;
  description: string;
  features: string[];
  applications: string[];
  fireRating: string;
  insulationRValue: number;
  color: string;
  modelPath?: string;
}

// Panel specifications matching the ComponentLibrary
export const PANEL_SPECS: Record<string, ComponentSpec> = {
  panel_4x8: {
    sku: "DLN-PNL-4X8-STD",
    name: "Daylun Standard Panel 4×8",
    category: "Wall Panel",
    width: 4.0,
    height: 8.0,
    thickness: 6.5,
    material: "EPS Core with OSB Facing",
    weight: 85,
    price: 90.00,
    description: "Our flagship 4×8 standard panel combines superior insulation performance with structural strength.",
    features: [
      "Pre-fabricated with precision CNC cutting",
      "Integrated electrical chase channels", 
      "Tongue-and-groove edge connections",
      "Weather-resistant OSB facing",
      "EPS foam core insulation",
      "Ready for immediate installation"
    ],
    applications: [
      "Exterior walls",
      "Interior partitions", 
      "Roof panels",
      "Floor systems"
    ],
    fireRating: "Class A",
    insulationRValue: 22.5,
    color: "#2E8B57",
    modelPath: "/models/panels/daylun-4x8-panel.glb"
  },
  corner_panel: {
    sku: "DLN-PNL-CRN-STD",
    name: "Daylun Corner Panel",
    category: "Corner Reinforcement",
    width: 4.0,
    height: 8.0,
    thickness: 6.5,
    material: "EPS Core with OSB Facing",
    weight: 95,
    price: 110.00,
    description: "Specialized corner panel designed for structural integrity at building corners.",
    features: [
      "L-shaped design for corner reinforcement",
      "Enhanced structural capacity",
      "Integrated corner bracing",
      "Weather-resistant OSB facing",
      "EPS foam core insulation"
    ],
    applications: [
      "Building corners",
      "Structural reinforcement",
      "Load-bearing corners"
    ],
    fireRating: "Class A",
    insulationRValue: 22.5,
    color: "#228B22",
    modelPath: "/models/panels/daylun-corner-panel.glb"
  },
  floor_panel: {
    sku: "DLN-PNL-FLR-STD",
    name: "Daylun Floor Panel",
    category: "Floor System",
    width: 4.0,
    height: 8.0,
    thickness: 8.0,
    material: "OSB with Structural Core",
    weight: 75,
    price: 85.00,
    description: "High-performance floor panel designed for multi-story construction.",
    features: [
      "Structural floor decking",
      "Moisture-resistant coating",
      "Tongue-and-groove edges",
      "Load-bearing capacity",
      "Easy installation"
    ],
    applications: [
      "Floor systems",
      "Structural decking",
      "Multi-story construction"
    ],
    fireRating: "Class A",
    insulationRValue: 15.0,
    color: "#8FBC8F",
    modelPath: "/models/panels/daylun-floor-panel.glb"
  }
};

export const useInventory = () => {
  const [inventory, setInventory] = useState<PanelInventory>({
    panel_4x8: 0,
    corner_panel: 0,
    floor_panel: 0
  });

  // Update inventory based on house design
  const updateInventoryFromHouse = useCallback((house: any) => {
    const newInventory: PanelInventory = {
      panel_4x8: 0,
      corner_panel: 0,
      floor_panel: 0
    };

    // Count components across all floors/stories
    // floor.components is an object where each key (e.g., "0,0") maps to an array of components
    house.floors.forEach((floor: any) => {
      Object.values(floor.components).forEach((componentArray: any) => {
        // componentArray is an array of components at a given position
        componentArray.forEach((component: any) => {
          if (component.type in newInventory) {
            newInventory[component.type as keyof PanelInventory]++;
          }
        });
      });
    });

    setInventory(newInventory);
  }, []);

  // Calculate total cost
  const getTotalCost = useCallback(() => {
    return Object.entries(inventory).reduce((total, [panelType, count]) => {
      const spec = PANEL_SPECS[panelType];
      return total + (spec ? spec.price * count : 0);
    }, 0);
  }, [inventory]);

  // Calculate total weight
  const getTotalWeight = useCallback(() => {
    return Object.entries(inventory).reduce((total, [panelType, count]) => {
      const spec = PANEL_SPECS[panelType];
      return total + (spec ? spec.weight * count : 0);
    }, 0);
  }, [inventory]);

  // Get inventory summary
  const getInventorySummary = useCallback(() => {
    return Object.entries(inventory).map(([panelType, count]) => {
      const spec = PANEL_SPECS[panelType];
      return {
        type: panelType,
        count,
        spec,
        totalCost: spec ? spec.price * count : 0,
        totalWeight: spec ? spec.weight * count : 0
      };
    });
  }, [inventory]);

  return {
    inventory,
    updateInventoryFromHouse,
    getTotalCost,
    getTotalWeight,
    getInventorySummary,
    PANEL_SPECS
  };
};
