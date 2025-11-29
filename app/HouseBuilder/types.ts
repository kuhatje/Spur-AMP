export enum ComponentType {
  PANEL_4X8 = "panel_4x8",
  CORNER_PANEL = "corner_panel",
  FLOOR_PANEL = "floor_panel",
  EMPTY = "empty"
}

export interface Component {
  type: ComponentType;
  x: number;
  y: number;
  rotation: number;
}

export interface Floor {
  floorNumber: number;
  width: number;
  height: number;
  components: { [key: string]: Component[] };
}

export interface House {
  floors: Floor[];
  currentFloorIndex: number;
}
