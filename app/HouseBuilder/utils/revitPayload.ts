import { ComponentType, House, Component } from "../types";

export interface RevitPayloadOptions {
  cellSizeFeet?: number;
  storyHeightFeet?: number;
}

export interface RevitComponentInstance {
  id: string;
  type: ComponentType;
  family: string;
  story: number;
  position: {
    x: number;
    y: number;
    elevation: number;
  };
  rotationDeg: number;
  footprintCenter: {
    x: number;
    y: number;
  };
  notes?: string;
}

export interface RevitExportPayload {
  metadata: {
    generatedAt: string;
    cellSizeFeet: number;
    storyHeightFeet: number;
    totalFloors: number;
    totalPanels: number;
    componentCounts: Record<ComponentType, number>;
  };
  stories: Array<{
    storyNumber: number;
    elevationFeet: number;
    components: RevitComponentInstance[];
  }>;
}

const FAMILY_MAP: Record<ComponentType, string> = {
  [ComponentType.PANEL_4X8]: "Daylun_Panel_4x8_Placeholder",
  [ComponentType.CORNER_PANEL]: "Daylun_CornerPanel_Placeholder",
  [ComponentType.FLOOR_PANEL]: "Daylun_FloorPanel_Placeholder",
  [ComponentType.EMPTY]: "Daylun_EmptySlot"
};

const DEFAULT_OPTIONS = {
  cellSizeFeet: 8,
  storyHeightFeet: 10
};

const createInstanceId = (component: Component, storyIndex: number) => {
  return `${component.type}_S${storyIndex + 1}_${component.x}_${component.y}`;
};

const convertComponent = (
  component: Component,
  storyIndex: number,
  options: Required<RevitPayloadOptions>
): RevitComponentInstance => {
  const { cellSizeFeet, storyHeightFeet } = options;
  const centerX = component.x * cellSizeFeet + cellSizeFeet / 2;
  const centerY = component.y * cellSizeFeet + cellSizeFeet / 2;
  const baseElevation = storyIndex * storyHeightFeet;
  const elevation =
    component.type === ComponentType.FLOOR_PANEL
      ? baseElevation
      : baseElevation; // Panels start at story base; wall height handled in Revit family

  return {
    id: createInstanceId(component, storyIndex),
    type: component.type,
    family: FAMILY_MAP[component.type],
    story: storyIndex + 1,
    position: {
      x: component.x * cellSizeFeet,
      y: component.y * cellSizeFeet,
      elevation
    },
    rotationDeg: component.rotation,
    footprintCenter: {
      x: centerX,
      y: centerY
    },
    notes:
      component.type === ComponentType.CORNER_PANEL
        ? "Rotate L-shaped placeholder to face exterior corner"
        : undefined
  };
};

export const generateRevitPayload = (
  house: House,
  opts: RevitPayloadOptions = {}
): RevitExportPayload => {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  const componentCounts = {
    [ComponentType.PANEL_4X8]: 0,
    [ComponentType.CORNER_PANEL]: 0,
    [ComponentType.FLOOR_PANEL]: 0,
    [ComponentType.EMPTY]: 0
  };

  const stories = house.floors.map((floor, storyIdx) => {
    const components: RevitComponentInstance[] = [];

    Object.values(floor.components).forEach((componentArray) => {
      componentArray.forEach((component) => {
        if (component.type === ComponentType.EMPTY) {
          return;
        }
        componentCounts[component.type]++;
        components.push(convertComponent(component, storyIdx, options));
      });
    });

    return {
      storyNumber: storyIdx + 1,
      elevationFeet: storyIdx * options.storyHeightFeet,
      components
    };
  });

  const totalPanels = Object.values(componentCounts).reduce(
    (sum, count) => sum + count,
    0
  );

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      cellSizeFeet: options.cellSizeFeet,
      storyHeightFeet: options.storyHeightFeet,
      totalFloors: house.floors.length,
      totalPanels,
      componentCounts
    },
    stories
  };
};
