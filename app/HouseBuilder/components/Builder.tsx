"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useIsVisible } from "../../JS_Scripts/Visible";
import Model_Preview from "../../JS_Scripts/Model";
import { HouseToGLBConverter } from "../../JS_Scripts/HouseToGLB";
import { useInventoryContext } from "../context/InventoryContext";
import { ComponentType, Component, Floor, House } from "../types";
import { generateRevitPayload } from "../utils/revitPayload";

// Component colors for blueshell visualization
const COMPONENT_COLORS = {
  [ComponentType.PANEL_4X8]: "#2E8B57",      // Sea Green - main structural panels
  [ComponentType.CORNER_PANEL]: "#228B22",   // Forest Green - corner reinforcement
  [ComponentType.FLOOR_PANEL]: "#8FBC8F",    // Dark Sea Green - floor panels
  [ComponentType.EMPTY]: "#F0F0F0"
};

interface IsoConfig {
  scale: number;
  heightScale: number;
  offsetX: number;
  offsetY: number;
}

interface PrismDimensions {
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
}

interface PlateOptions {
  x: number;
  y: number;
  width: number;
  depth: number;
  elevation: number;
  fill: string;
  stroke?: string;
  opacity?: number;
  dashed?: boolean;
}

const ISO_X = Math.cos(Math.PI / 6);
const ISO_Y = Math.sin(Math.PI / 6);

const clampValue = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const shadeColor = (hex: string, percent: number) => {
  const normalized = hex.replace("#", "");
  const num = parseInt(normalized, 16);
  const amt = Math.round((percent / 100) * 255);

  const r = clampValue((num >> 16) + amt, 0, 255);
  const g = clampValue(((num >> 8) & 0xff) + amt, 0, 255);
  const b = clampValue((num & 0xff) + amt, 0, 255);
  return `rgb(${r}, ${g}, ${b})`;
};

const isoProjectPoint = (
  x: number,
  y: number,
  z: number,
  config: IsoConfig
): [number, number] => {
  const screenX = config.offsetX + (x - y) * ISO_X * config.scale;
  const screenY =
    config.offsetY - (x + y) * ISO_Y * config.scale - z * config.heightScale;
  return [screenX, screenY];
};

const drawIsoFace = (
  ctx: CanvasRenderingContext2D,
  points: Array<[number, number]>
) => {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i][0], points[i][1]);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

const drawIsoPlate = (
  ctx: CanvasRenderingContext2D,
  options: PlateOptions,
  config: IsoConfig
) => {
  const { x, y, width, depth, elevation, fill, stroke, opacity, dashed } =
    options;
  const points = [
    isoProjectPoint(x, y, elevation, config),
    isoProjectPoint(x + width, y, elevation, config),
    isoProjectPoint(x + width, y + depth, elevation, config),
    isoProjectPoint(x, y + depth, elevation, config),
  ];

  ctx.save();
  ctx.globalAlpha = opacity ?? 1;
  ctx.fillStyle = fill;
  ctx.strokeStyle = stroke ?? "#1F2933";
  ctx.lineWidth = 1.2;
  if (dashed) {
    ctx.setLineDash([6, 4]);
  }
  drawIsoFace(ctx, points);
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;
  ctx.restore();
};

const drawIsoPrism = (
  ctx: CanvasRenderingContext2D,
  prism: PrismDimensions,
  config: IsoConfig,
  baseColor: string
) => {
  const { x, y, z, width, depth, height } = prism;
  const p000 = isoProjectPoint(x, y, z, config);
  const p100 = isoProjectPoint(x + width, y, z, config);
  const p010 = isoProjectPoint(x, y + depth, z, config);
  const p110 = isoProjectPoint(x + width, y + depth, z, config);
  const p001 = isoProjectPoint(x, y, z + height, config);
  const p101 = isoProjectPoint(x + width, y, z + height, config);
  const p011 = isoProjectPoint(x, y + depth, z + height, config);
  const p111 = isoProjectPoint(x + width, y + depth, z + height, config);

  const sideDark = shadeColor(baseColor, -25);
  const sideLight = shadeColor(baseColor, -12);
  const topColor = shadeColor(baseColor, 18);

  ctx.strokeStyle = "#1F2933";
  ctx.lineWidth = 1;

  // Left/Back face
  ctx.fillStyle = sideDark;
  drawIsoFace(ctx, [p000, p010, p011, p001]);

  // Right face
  ctx.fillStyle = sideLight;
  drawIsoFace(ctx, [p000, p100, p101, p001]);

  // Top face
  ctx.fillStyle = topColor;
  drawIsoFace(ctx, [p001, p101, p111, p011]);
};

const getCornerSegments = (
  component: Component,
  wallThickness: number
): Array<{ x: number; y: number; width: number; depth: number }> => {
  const { x, y } = component;
  const rotation = ((component.rotation ?? 0) + 360) % 360;

  switch (rotation) {
    case 0:
      return [
        { x, y, width: 1, depth: wallThickness }, // bottom leg
        { x, y, width: wallThickness, depth: 1 }, // left leg
      ];
    case 90:
      return [
        { x, y, width: 1, depth: wallThickness }, // bottom leg
        { x: x + 1 - wallThickness, y, width: wallThickness, depth: 1 }, // right leg
      ];
    case 180:
      return [
        { x, y: y + 1 - wallThickness, width: 1, depth: wallThickness }, // top leg
        { x: x + 1 - wallThickness, y, width: wallThickness, depth: 1 }, // right leg
      ];
    case 270:
    default:
      return [
        { x, y: y + 1 - wallThickness, width: 1, depth: wallThickness }, // top leg
        { x, y, width: wallThickness, depth: 1 }, // left leg
      ];
  }
};

export default function Builder() {
  const ref_Builder = useRef(null);
  const is_visible_Builder = useIsVisible(ref_Builder);
  
  // Inventory tracking
  const { updateInventoryFromHouse } = useInventoryContext();
  
  // Canvas refs
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // State management
  const [house, setHouse] = useState<House>({
    floors: [{ floorNumber: 0, width: 10, height: 10, components: {} }],
    currentFloorIndex: 0
  });
  
  const [selectedComponentType, setSelectedComponentType] = useState<ComponentType>(ComponentType.PANEL_4X8);
  const [selectedRotation, setSelectedRotation] = useState(0);
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [showDebug, setShowDebug] = useState(false);
  
  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{x: number, y: number} | null>(null);
  const [dragEnd, setDragEnd] = useState<{x: number, y: number} | null>(null);
  
  // 3D Model Preview state
  const [selectedModel, setSelectedModel] = useState("house1");
  const [customModel, setCustomModel] = useState<any>(null);
  const [glbConverter] = useState(() => new HouseToGLBConverter());
  const models = {
    house1: { name: "Modern Home", path: "/models/house1/scene.gltf" },
    subhouse: { name: "Suburban", path: "/models/subhouse.glb" },
    donut: { name: "Custom Design", path: "/models/donut.glb" },
  };
  
  const gridSize = 40;
  
  // Helper functions
  const getCurrentFloor = (): Floor => house.floors[house.currentFloorIndex];
  
  const addComponent = (x: number, y: number, type: ComponentType, rotation: number = 0): boolean => {
    const key = `${x},${y}`;
    const newHouse = { ...house };
    const floor = newHouse.floors[house.currentFloorIndex];
    
    // Initialize components array if it doesn't exist
    if (!floor.components[key]) {
      floor.components[key] = [];
    }
    
    // Check if we can place this component type
    const hasWallPanel = floor.components[key].some(c => c.type === ComponentType.PANEL_4X8 || c.type === ComponentType.CORNER_PANEL);
    const hasFloorPanel = floor.components[key].some(c => c.type === ComponentType.FLOOR_PANEL);
    const isWallPanel = type === ComponentType.PANEL_4X8 || type === ComponentType.CORNER_PANEL;
    const isFloorPanel = type === ComponentType.FLOOR_PANEL;
    
    // Cannot place wall panels together
    if (isWallPanel && hasWallPanel) {
      return false;
    }

    if (isFloorPanel && hasFloorPanel) {
      return false;
    }
    
    // Add the component
    floor.components[key].push({
      type,
      x,
      y,
      rotation
    });
    
    setHouse(newHouse);
    return true;
  };
  
  const removeComponent = (x: number, y: number, type: ComponentType) => {
    const key = `${x},${y}`;
    const floor = getCurrentFloor();
    const components = floor.components[key];
    
    if (!components || components.length === 0) return;
    
    // Find the component of the specified type
    const newHouse = { ...house };
    const newComponents = newHouse.floors[house.currentFloorIndex].components[key];
    
    const index = newComponents.findIndex(c => c.type === type);
    
    if (index !== -1) {
      newComponents.splice(index, 1);
      setStatusMessage(`Removed ${type.replace('_', ' ')}`);
      
      // If no components left, delete the key
      if (newComponents.length === 0) {
        delete newHouse.floors[house.currentFloorIndex].components[key];
      }
      
      setHouse(newHouse);
    } else {
      setStatusMessage("No matching component to remove");
    }
  };

  const rotateComponent = (x: number, y: number, type: ComponentType) => {
    const key = `${x},${y}`;
    const floor = getCurrentFloor();
    const components = floor.components[key];
    
    if (!components || components.length === 0) return;
    
    // Find the index in the original array
    const index = components.findIndex(c => c.type === type);
    if (index === -1) {
      setStatusMessage("No matching component to rotate");
      return;
    }

    const component = components[index];  // Get it once
    const newRotation = (component.rotation + 90) % 360;

    const newHouse = { ...house };
    const newComponents = newHouse.floors[house.currentFloorIndex].components[key];

    // Update using the same index
    newComponents[index] = {
      ...component,
      rotation: newRotation
    };

    setHouse(newHouse);
    setStatusMessage(`Rotated ${type.replace('_', ' ')} to ${newRotation}°`);
  };
  
  // Floor management
  const addFloor = () => {
    const newFloor: Floor = {
      floorNumber: house.floors.length,
      width: 10,
      height: 10,
      components: {}
    };
    const newHouse = { 
      ...house, 
      floors: [...house.floors, newFloor],
      currentFloorIndex: house.floors.length
    };
    setHouse(newHouse);
    setStatusMessage(`Added Story ${newFloor.floorNumber + 1}`);
  };
  
  const removeFloor = () => {
    if (house.floors.length > 1) {
      const newFloors = house.floors.filter((_, index) => index !== house.currentFloorIndex);
      // Renumber floors
      newFloors.forEach((floor, index) => {
        floor.floorNumber = index;
      });
      const newHouse = {
        floors: newFloors,
        currentFloorIndex: Math.min(house.currentFloorIndex, newFloors.length - 1)
      };
      setHouse(newHouse);
      setStatusMessage("Removed story");
    } else {
      setStatusMessage("Must have at least one story");
    }
  };
  
  const changeFloor = (floorIndex: number) => {
    setHouse({ ...house, currentFloorIndex: floorIndex });
  };
  
  // Tools
  const clearFloor = () => {
    const newHouse = { ...house };
    newHouse.floors[house.currentFloorIndex].components = {};
    setHouse(newHouse);
    setStatusMessage("Cleared story");
  };
  
  const fillWalls = () => {
    const floor = getCurrentFloor();
    const newHouse = { ...house };
    const components = { ...floor.components };
    
    // Smart blueshell frame placement with proper orientations and corners
    
    // Top and bottom edges - horizontal 4x8 panels (0° rotation)
    for (let x = 1; x < floor.width - 1; x++) {
      const key1 = `${x},0`;
      if (!components[key1]) components[key1] = [];
      components[key1] = [{ type: ComponentType.PANEL_4X8, x, y: 0, rotation: 0 }];
      
      const key2 = `${x},${floor.height - 1}`;
      if (!components[key2]) components[key2] = [];
      components[key2] = [{ type: ComponentType.PANEL_4X8, x, y: floor.height - 1, rotation: 0 }];
    }
    
    // Left and right edges - vertical 4x8 panels (90° rotation)
    for (let y = 1; y < floor.height - 1; y++) {
      const key1 = `0,${y}`;
      if (!components[key1]) components[key1] = [];
      components[key1] = [{ type: ComponentType.PANEL_4X8, x: 0, y, rotation: 90 }];
      
      const key2 = `${floor.width - 1},${y}`;
      if (!components[key2]) components[key2] = [];
      components[key2] = [{ type: ComponentType.PANEL_4X8, x: floor.width - 1, y, rotation: 90 }];
    }
    
    // Corner panels with appropriate rotations for structural integrity
    // Top-left corner (0° rotation - L opens to bottom-right)
    components[`0,0`] = [{ type: ComponentType.CORNER_PANEL, x: 0, y: 0, rotation: 0 }];
    
    // Top-right corner (90° rotation - L opens to bottom-left)
    components[`${floor.width - 1},0`] = [{ type: ComponentType.CORNER_PANEL, x: floor.width - 1, y: 0, rotation: 90 }];
    
    // Bottom-right corner (180° rotation - L opens to top-left)
    components[`${floor.width - 1},${floor.height - 1}`] = [{ type: ComponentType.CORNER_PANEL, x: floor.width - 1, y: floor.height - 1, rotation: 180 }];
    
    // Bottom-left corner (270° rotation - L opens to top-right)
    components[`0,${floor.height - 1}`] = [{ type: ComponentType.CORNER_PANEL, x: 0, y: floor.height - 1, rotation: 270 }];
    
    newHouse.floors[house.currentFloorIndex].components = components;
    setHouse(newHouse);
    setStatusMessage("Added blueshell frame perimeter with corner reinforcements");
  };

  const loadFloorPanels = () => {
    const floor = getCurrentFloor();
    const newHouse = { ...house };
    const components = { ...floor.components };
    
    // Fill entire floor with floor panels
    for (let x = 0; x < floor.width; x++) {
      for (let y = 0; y < floor.height; y++) {
        const key = `${x},${y}`;
        // Initialize array if doesn't exist
        if (!components[key]) components[key] = [];
        
        // Add floor panel, replacing any existing floor panel at this position
        const index = components[key].findIndex(c => c.type === ComponentType.FLOOR_PANEL);
        const floorPanel = { type: ComponentType.FLOOR_PANEL, x, y, rotation: 0 };
        
        if (index !== -1) {
          components[key][index] = floorPanel;
        } else {
          components[key].push(floorPanel);
        }
      }
    }
    
    newHouse.floors[house.currentFloorIndex].components = components;
    setHouse(newHouse);
    setStatusMessage("Filled floor with panels");
  };
  
  // Canvas drawing - 2D Grid View
  const updateFloorView = useCallback(() => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size based on device
    const isMobile = window.innerWidth < 768;
    const canvasSize = isMobile ? 320 : 400;
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    const floor = getCurrentFloor();
    
    // Calculate responsive grid size to always show full 10x10 grid
    const cellSize = Math.min(canvasSize / floor.width, canvasSize / floor.height);
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.strokeStyle = 'gray';
    ctx.lineWidth = 1;
    
    // Vertical lines
    for (let x = 0; x <= floor.width; x++) {
      const xPos = x * cellSize;
      ctx.beginPath();
      ctx.moveTo(xPos, 0);
      ctx.lineTo(xPos, floor.height * cellSize);
      ctx.stroke();
    }
    
    // Horizontal lines
    for (let y = 0; y <= floor.height; y++) {
      const yPos = y * cellSize;
      ctx.beginPath();
      ctx.moveTo(0, yPos);
      ctx.lineTo(floor.width * cellSize, yPos);
      ctx.stroke();
    }
    
    // Draw components
    Object.values(floor.components).forEach(componentArray => {
      componentArray.forEach(component => {
        drawComponent(ctx, component, cellSize, floor.height);
      });
    });
    
    // Draw drag selection rectangle
    if (isDragging && dragStart && dragEnd) {
      const startX = Math.min(dragStart.x, dragEnd.x) * cellSize;
      const startY = (floor.height - 1 - Math.max(dragStart.y, dragEnd.y)) * cellSize; // Flip Y
      const endX = Math.max(dragStart.x, dragEnd.x) * cellSize + cellSize;
      const endY = (floor.height - 1 - Math.min(dragStart.y, dragEnd.y)) * cellSize + cellSize; // Flip Y
      
      ctx.strokeStyle = '#0474BC';
      ctx.setLineDash([5, 5]);
      ctx.lineWidth = 2;
      ctx.strokeRect(startX, startY, endX - startX, endY - startY);
      ctx.setLineDash([]);
      
      // Semi-transparent fill
      ctx.fillStyle = 'rgba(4, 116, 188, 0.2)';
      ctx.fillRect(startX, startY, endX - startX, endY - startY);
    }
  }, [house, isDragging, dragStart, dragEnd]);
  
  const drawComponent = (ctx: CanvasRenderingContext2D, component: Component, cellSize: number = gridSize, floorHeight: number = 10) => {
    const x1 = component.x * cellSize;
    const y1 = (floorHeight - 1 - component.y) * cellSize; // Flip Y coordinate for drawing
    const x2 = x1 + cellSize;
    const y2 = y1 + cellSize;
    const centerX = x1 + cellSize / 2;
    const centerY = y1 + cellSize / 2;
    
    const color = COMPONENT_COLORS[component.type];
    const panelThickness = cellSize * 0.15; // Thickness for edge panels
    
    // Save context for rotation
    ctx.save();
    
    if (component.type === ComponentType.PANEL_4X8) {
      // Draw 4x8 panel only on one edge based on rotation
      ctx.fillStyle = color;
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 2;
      
      // Draw panel on specific edge based on rotation
      if (component.rotation === 0) {
        // Bottom edge
        ctx.fillRect(x1, y2 - panelThickness, cellSize, panelThickness);
        ctx.strokeRect(x1, y2 - panelThickness, cellSize, panelThickness);
      } else if (component.rotation === 90) {
        // Left edge
        ctx.fillRect(x1, y1, panelThickness, cellSize);
        ctx.strokeRect(x1, y1, panelThickness, cellSize);
      } else if (component.rotation === 180) {
        // Top edge
        ctx.fillRect(x1, y1, cellSize, panelThickness);
        ctx.strokeRect(x1, y1, cellSize, panelThickness);
      } else if (component.rotation === 270) {
        // Right edge
        ctx.fillRect(x2 - panelThickness, y1, panelThickness, cellSize);
        ctx.strokeRect(x2 - panelThickness, y1, panelThickness, cellSize);
      }
      
      // Draw structural grid pattern on the panel
      ctx.strokeStyle = '#1F5F3F';
      ctx.lineWidth = 1;
      
      if (component.rotation === 0 || component.rotation === 180) {
        // Horizontal panel - draw vertical divisions
        const gridWidth = cellSize / 4;
        for (let i = 1; i < 4; i++) {
          ctx.beginPath();
          const yPos = component.rotation === 0 ? y2 - panelThickness : y1 + panelThickness;
          ctx.moveTo(x1 + i * gridWidth, yPos);
          ctx.lineTo(x1 + i * gridWidth, yPos);
          ctx.stroke();
        }
      } else {
        // Vertical panel - draw horizontal divisions
        const gridHeight = cellSize / 8;
        for (let i = 1; i < 8; i++) {
          ctx.beginPath();
          const xPos = component.rotation === 90 ? x1 + panelThickness : x2 - panelThickness;
          ctx.moveTo(xPos, y1 + i * gridHeight);
          ctx.lineTo(xPos, y1 + i * gridHeight);
          ctx.stroke();
        }
      }
      
    } else if (component.type === ComponentType.CORNER_PANEL) {
      // Save again for corner panel rotation
      ctx.save();
      
      // Draw corner panel as L-shape only (no fill, just edges)
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 4;
      
      const thickness = panelThickness;
      
      // Apply rotation to draw L-shape on correct edges
      ctx.translate(centerX, centerY);
      ctx.rotate((component.rotation * Math.PI) / 180);
      ctx.translate(-centerX, -centerY);
      
      const xStart = centerX - cellSize/2;
      const yStart = centerY - cellSize/2;
      const yEnd = centerY + cellSize/2;
      
      // Draw filled L-shape using two separate fills
      ctx.fillRect(xStart, yStart, thickness, cellSize); // Vertical edge
      ctx.fillRect(xStart + thickness, yEnd - thickness, cellSize - thickness, thickness); // Horizontal edge
      
      // Restore rotation
      ctx.restore();
      
    } else if (component.type === ComponentType.FLOOR_PANEL) {
      // Set 50% opacity for floor panels so they show through
      ctx.globalAlpha = 0.5;
      
      // Draw floor panel fill
      ctx.fillStyle = color;
      ctx.strokeStyle = 'black';
      ctx.lineWidth = 1;
      ctx.fillRect(x1, y1, cellSize, cellSize);
      ctx.strokeRect(x1, y1, cellSize, cellSize);
      
      // Draw decking pattern with even spacing
      ctx.globalAlpha = 0.7; // Slightly more opaque for lines
      ctx.strokeStyle = '#4F7F5F';
      ctx.lineWidth = 1;
      const padding = Math.max(2, cellSize * 0.1);
      const availableHeight = cellSize - padding * 2;
      const deckingSpacing = availableHeight / 6; // Divide into 6 equal sections
      
      for (let i = 1; i <= 5; i++) {
        const lineY = y1 + padding + i * deckingSpacing;
        ctx.beginPath();
        ctx.moveTo(x1 + padding, lineY);
        ctx.lineTo(x2 - padding, lineY);
        ctx.stroke();
      }
      
      // Reset opacity
      ctx.globalAlpha = 1.0;
    }
    
    // Restore context (resets rotation, opacity, etc.)
    ctx.restore();
  };
  
  // 3D Preview - Isometric projection
  const update3DPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const isMobile = window.innerWidth < 768;
    const canvasWidth = isMobile ? 300 : 420;
    const canvasHeight = isMobile ? 320 : 560;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const maxWidth = house.floors.reduce(
      (acc, floor) => Math.max(acc, floor.width),
      0
    );
    const maxDepth = house.floors.reduce(
      (acc, floor) => Math.max(acc, floor.height),
      0
    );

    const dimensionForScale = Math.max(maxWidth + maxDepth, 12);
    const baseScale =
      Math.min(canvasWidth, canvasHeight) / (dimensionForScale * 1.6);
    const isoConfig: IsoConfig = {
      scale: Math.max(baseScale, isMobile ? 16 : 20),
      heightScale: Math.max(baseScale * 1.35, 18),
      offsetX: canvasWidth / 2,
      offsetY: canvasHeight * 0.82,
    };

    const storyHeight = 1.4;
    const floorThickness = 0.12;
    const wallThickness = 0.18;

    // Ground plate with slight padding for framing reference
    const padding = 1.25;
    drawIsoPlate(
      ctx,
      {
        x: -padding,
        y: -padding,
        width: maxWidth + padding * 2,
        depth: maxDepth + padding * 2,
        elevation: 0,
        fill: "#E2E6EA",
        stroke: "#B0B7BF",
        opacity: 0.95,
      },
      isoConfig
    );

    house.floors.forEach((floor, idx) => {
      const elevation = idx * storyHeight;
      const isCurrent = idx === house.currentFloorIndex;
      drawIsoPlate(
        ctx,
        {
          x: 0,
          y: 0,
          width: floor.width,
          depth: floor.height,
          elevation,
          fill: isCurrent
            ? "rgba(4, 116, 188, 0.3)"
            : "rgba(148, 163, 184, 0.3)",
          stroke: isCurrent ? "#0474BC" : "#94A3B8",
          dashed: !isCurrent,
        },
        isoConfig
      );
    });

    const componentEntries: Array<{ component: Component; storyIdx: number }> =
      [];

    house.floors.forEach((floor, storyIdx) => {
      Object.values(floor.components).forEach((componentArray) => {
        componentArray.forEach((component) => {
          if (component.type !== ComponentType.EMPTY) {
            componentEntries.push({ component, storyIdx });
          }
        });
      });
    });

    componentEntries.sort((a, b) => {
      const depthA =
        a.storyIdx * 4 + (a.component.x + a.component.y);
      const depthB =
        b.storyIdx * 4 + (b.component.x + b.component.y);
      return depthB - depthA;
    });

    componentEntries.forEach(({ component, storyIdx }) => {
      const baseZ = storyIdx * storyHeight;
      const color = COMPONENT_COLORS[component.type];
      if (!color) return;

      if (component.type === ComponentType.FLOOR_PANEL) {
        drawIsoPrism(
          ctx,
          {
            x: component.x,
            y: component.y,
            z: baseZ,
            width: 1,
            depth: 1,
            height: floorThickness,
          },
          isoConfig,
          color
        );
        return;
      }

      const wallHeight = storyHeight - floorThickness * 1.15;
      const rotation = ((component.rotation ?? 0) + 360) % 360;

      if (component.type === ComponentType.PANEL_4X8) {
        let prism: PrismDimensions;
        if (rotation === 0) {
          prism = {
            x: component.x,
            y: component.y,
            z: baseZ + floorThickness,
            width: 1,
            depth: wallThickness,
            height: wallHeight,
          };
        } else if (rotation === 180) {
          prism = {
            x: component.x,
            y: component.y + 1 - wallThickness,
            z: baseZ + floorThickness,
            width: 1,
            depth: wallThickness,
            height: wallHeight,
          };
        } else if (rotation === 90) {
          prism = {
            x: component.x,
            y: component.y,
            z: baseZ + floorThickness,
            width: wallThickness,
            depth: 1,
            height: wallHeight,
          };
        } else {
          prism = {
            x: component.x + 1 - wallThickness,
            y: component.y,
            z: baseZ + floorThickness,
            width: wallThickness,
            depth: 1,
            height: wallHeight,
          };
        }
        drawIsoPrism(ctx, prism, isoConfig, color);
      } else if (component.type === ComponentType.CORNER_PANEL) {
        const segments = getCornerSegments(component, wallThickness);
        segments.forEach((segment) => {
          drawIsoPrism(
            ctx,
            {
              x: segment.x,
              y: segment.y,
              z: baseZ + floorThickness,
              width: segment.width,
              depth: segment.depth,
              height: wallHeight,
            },
            isoConfig,
            color
          );
        });
      }
    });
  }, [house]);
  // Mouse event handlers
  const handleMouseDown = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    const floor = getCurrentFloor();
    const cellSize = Math.min(canvas.width / floor.width, canvas.height / floor.height);
    
    const x = Math.floor(canvasX / cellSize);
    const y = floor.height - 1 - Math.floor(canvasY / cellSize); // Flip Y coordinate
    
    if (x >= 0 && x < floor.width && y >= 0 && y < floor.height) {
      if (event.button === 1) { // Middle click - rotate existing component
        event.preventDefault();
        rotateComponent(x, y, selectedComponentType);
      } else if (event.button === 0) { // Left click only - start drag to place components
        setIsDragging(true);
        setDragStart({x, y});
        setDragEnd({x, y});
      }
      // Right click (button 2) is handled by onContextMenu, so we ignore it here
    }
  };

  const handleMouseMove = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    const floor = getCurrentFloor();
    const cellSize = Math.min(canvas.width / floor.width, canvas.height / floor.height);
    
    const x = Math.floor(canvasX / cellSize);
    const y = floor.height - 1 - Math.floor(canvasY / cellSize); // Flip Y coordinate
    
    if (x >= 0 && x < floor.width && y >= 0 && y < floor.height) {
      setDragEnd({x, y});
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Only process left mouse button releases (button 0)
    if (event.button !== 0 || !isDragging || !dragStart || !dragEnd) return;
    
    setIsDragging(false);
    
    // Fill the selected area
    const minX = Math.min(dragStart.x, dragEnd.x);
    const maxX = Math.max(dragStart.x, dragEnd.x);
    const minY = Math.min(dragStart.y, dragEnd.y);
    const maxY = Math.max(dragStart.y, dragEnd.y);
    
    let placedCount = 0;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (addComponent(x, y, selectedComponentType, selectedRotation)) {
          placedCount++;
        }
      }
    }
    
    if (placedCount > 0) {
      setStatusMessage(`Placed ${placedCount} ${selectedComponentType.replace('_', ' ')}(s)`);
    } else {
      setStatusMessage("Could not place any components in selected area");
    }
    setDragStart(null);
    setDragEnd(null);
  };
  
  const handleGridRightClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    
    // Clear any ongoing drag state
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    const floor = getCurrentFloor();
    const cellSize = Math.min(canvas.width / floor.width, canvas.height / floor.height);
    
    const x = Math.floor(canvasX / cellSize);
    const y = floor.height - 1 - Math.floor(canvasY / cellSize); // Flip Y coordinate
    
    if (x >= 0 && x < floor.width && y >= 0 && y < floor.height) {
      removeComponent(x, y, selectedComponentType);
    }
  };


  
  // File operations
  const saveProject = () => {
    const data = JSON.stringify(house, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'house-project.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Project saved');
  };
  
  const loadProject = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        setHouse(data);
        setStatusMessage('Project loaded');
      } catch (error) {
        setStatusMessage('Error loading project');
      }
    };
    reader.readAsText(file);
  };
  
  const exportToManufacturing = () => {
    const manufacturingData = {
      project: 'Blueshell Frame Design',
      timestamp: new Date().toISOString(),
      stories: house.floors.map(floor => ({
        storyNumber: floor.floorNumber + 1,
        dimensions: { width: floor.width, height: floor.height },
        panels: Object.values(floor.components).flatMap(componentArray => 
          componentArray.map(component => ({
            type: component.type,
            position: { x: component.x, y: component.y },
            rotation: component.rotation,
            panelSize: component.type === ComponentType.PANEL_4X8 ? "4x8" : 
                       component.type === ComponentType.CORNER_PANEL ? "corner" : "floor"
          }))
        )
      })),
      totalPanels: house.floors.reduce((total, floor) => 
        total + Object.values(floor.components).reduce((sum, componentArray) => sum + componentArray.length, 0), 0
      ),
      estimatedHeight: house.floors.length * 8 // 8 feet per story
    };
    
    const blob = new Blob([JSON.stringify(manufacturingData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blueshell-frame-data.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Blueshell frame data exported");
  };

  const exportRevitDesignData = () => {
    const payload = generateRevitPayload(house, {
      cellSizeFeet: 8,
      storyHeightFeet: 10
    });

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json"
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "daylun-revit-layout.json";
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Revit layout data exported");
  };

  const generateCustomModel = async () => {
    try {
      setStatusMessage("Generating 3D model...");
      const scene = glbConverter.convertHouseToScene(house);
      
      // Force update by clearing and then setting the custom model
      setCustomModel(null);
      setTimeout(() => {
        setCustomModel(scene);
        setSelectedModel("donut"); // Switch to the custom model tab
        setStatusMessage("3D model generated successfully! Check the 'Custom Design' tab below.");
      }, 100);
    } catch (error) {
      console.error('Error generating custom model:', error);
      setStatusMessage("Error generating 3D model. Please try again.");
    }
  };

  const downloadCustomModel = async () => {
    if (customModel) {
      try {
        setStatusMessage("Preparing download...");
        await glbConverter.downloadGLB(house, 'my-custom-house.glb');
        setStatusMessage("Custom model downloaded as GLB file");
      } catch (error) {
        console.error('Download error:', error);
        setStatusMessage("Error downloading model. Please try again.");
      }
    } else {
      setStatusMessage("Please generate a custom model first");
    }
  };
  
  // Keyboard event handling
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') {
        setSelectedRotation(prev => (prev + 90) % 360);
        setStatusMessage(`Rotation set to ${(selectedRotation + 90) % 360}°`);
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedRotation]);

  // Update views when house changes
  useEffect(() => {
    updateFloorView();
    update3DPreview();
  }, [house, updateFloorView, update3DPreview]);

  // Update inventory when house design changes
  useEffect(() => {
    updateInventoryFromHouse(house);
  }, [house, updateInventoryFromHouse]);

  // Handle window resize for responsive canvas
  useEffect(() => {
    const handleResize = () => {
      updateFloorView();
      update3DPreview();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [updateFloorView, update3DPreview]);

  return (
    <section className="bg-[#0474BC] text-white py-8 md:py-16 px-3 md:px-6 lg:px-20">
      <div
        ref={ref_Builder}
        className={`transition-all ease-in-out duration-[1800ms] ${
          is_visible_Builder ? "opacity-100" : "opacity-25"
        }`}
      >
        <div className="text-center mb-6 md:mb-8">
          <h2 className="text-2xl md:text-4xl font-extrabold mb-2 md:mb-4">Blueshell Frame Designer</h2>
          <p className="text-sm md:text-lg">Design multi-story blueshell frames using 4×8 structural panels</p>
        </div>

        {/* Mobile-first responsive grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 bg-gray-100 text-gray-800 p-4 rounded-lg">
          
          {/* Controls Panel - More compact layout */}
          <div className="w-full lg:col-span-3 space-y-3">
            
            {/* Floor Management & Components Combined */}
            <div className="bg-white p-3 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3">Story & Panels</h3>
              
              {/* Floor Management - Compact */}
              <div className="mb-3 pb-3 border-b">
                <select 
                  value={house.currentFloorIndex}
                  onChange={(e) => changeFloor(parseInt(e.target.value))}
                  className="w-full p-2 border rounded mb-2 text-sm"
                >
                  {house.floors.map((_, index) => (
                    <option key={index} value={index}>Story {index + 1}</option>
                  ))}
                </select>
                <div className="flex gap-1">
                  <button 
                    onClick={addFloor}
                    className="flex-1 bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 text-xs"
                  >
                    Add Story
                  </button>
                  <button 
                    onClick={removeFloor}
                    className="flex-1 bg-red-500 text-white px-2 py-1 rounded hover:bg-red-600 text-xs"
                  >
                    Remove
                  </button>
                </div>
              </div>
              
              {/* Blueshell Panel Types - More compact */}
              <div className="grid grid-cols-1 gap-1 mb-3">
                {Object.values(ComponentType).filter(type => type !== ComponentType.EMPTY).map(type => (
                  <label key={type} className="flex items-center text-sm cursor-pointer hover:bg-gray-50 p-1 rounded">
                    <input
                      type="radio"
                      name="component"
                      value={type}
                      checked={selectedComponentType === type}
                      onChange={(e) => setSelectedComponentType(e.target.value as ComponentType)}
                      className="mr-2"
                    />
                    {type === ComponentType.PANEL_4X8 ? "4×8 Panel" : 
                     type === ComponentType.CORNER_PANEL ? "Corner Panel" :
                     type === ComponentType.FLOOR_PANEL ? "Floor Panel" : 
                     String(type).replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                ))}
              </div>
              
              {/* Rotation Controls - Inline */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Rotation:</span>
                <button
                  onClick={() => setSelectedRotation(prev => (prev - 90 + 360) % 360)}
                  className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm"
                >
                  ↺
                </button>
                <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded min-w-[40px] text-center">
                  {selectedRotation}°
                </span>
                <button
                  onClick={() => setSelectedRotation(prev => (prev + 90) % 360)}
                  className="bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded text-sm"
                >
                  ↻
                </button>
                <span className="text-xs text-gray-500 ml-2">Press R</span>
              </div>
            </div>

            {/* Tools & Operations Combined */}
            <div className="bg-white p-3 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3">Frame Tools</h3>
              
              {/* Quick Tools - Horizontal layout */}
              <div className="grid grid-cols-2 gap-2 mb-3 pb-3 border-b">
                <button 
                  onClick={clearFloor}
                  className="bg-orange-500 text-white px-2 py-1 rounded hover:bg-orange-600 text-xs"
                >
                  Clear Story
                </button>
                <button 
                  onClick={fillWalls}
                  className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 text-xs"
                >
                  Frame Perimeter
                </button>
              </div>
              
              {/* File Operations - Compact */}
              <div className="space-y-1">
                <button 
                  onClick={loadFloorPanels}
                  className="w-full bg-green-700 text-white px-2 py-1 rounded hover:bg-green-800 text-xs"
                >
                  Fill Floor Panels
                </button>
                <div className="grid grid-cols-2 gap-1">
                  <button 
                    onClick={saveProject}
                    className="bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 text-xs"
                  >
                    Save
                  </button>
                  <label className="bg-purple-600 text-white px-2 py-1 rounded hover:bg-purple-700 cursor-pointer text-center text-xs">
                    Load
                    <input
                      type="file"
                      accept=".json"
                      onChange={loadProject}
                      className="hidden"
                    />
                  </label>
                </div>
                <button 
                  onClick={exportToManufacturing}
                  className="w-full bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 text-xs"
                >
                  Export Frame Data
                </button>
                <button
                  onClick={exportRevitDesignData}
                  className="w-full bg-slate-700 text-white px-2 py-1 rounded hover:bg-slate-800 text-xs"
                >
                  Export Revit Layout
                </button>
                <p className="text-[11px] text-gray-500">
                  Downloads a JSON layout for the Revit automation script.
                </p>
              </div>
            </div>

            {/* 3D Model Generation - Compact */}
            <div className="bg-white p-3 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-2">3D Model</h3>
              <div className="grid grid-cols-2 gap-1 mb-2">
                <button 
                  onClick={generateCustomModel}
                  className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 text-xs"
                >
                  Generate
                </button>
                <button 
                  onClick={downloadCustomModel}
                  className="bg-teal-600 text-white px-2 py-1 rounded hover:bg-teal-700 text-xs"
                  disabled={!customModel}
                >
                  Download
                </button>
              </div>
              <p className="text-xs text-gray-600">
                Generate & view 3D model below
              </p>
            </div>

            {/* Debug Panel */}
            <div className="bg-white p-3 rounded-lg shadow">
              <button 
                onClick={() => setShowDebug(!showDebug)}
                className="w-full font-bold text-lg mb-2 text-left"
              >
               Debug {showDebug ? '▼' : '▶'}
              </button>
              {showDebug && (
                <div className="bg-gray-900 text-green-400 p-2 rounded text-xs overflow-auto max-h-96">
                  <pre>{JSON.stringify(house, null, 2)}</pre>
                </div>
              )}
            </div>
          </div>

          {/* 2D Grid View - Larger space allocation */}
          <div className="w-full lg:col-span-5">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3 text-center">2D Frame Layout</h3>
              <div className="border-2 border-gray-300 rounded overflow-hidden flex justify-center">
                <canvas
                  ref={gridCanvasRef}
                  width={400}
                  height={400}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onContextMenu={handleGridRightClick}
                  className="cursor-crosshair bg-white"
                  style={{ width: '100%', maxWidth: '450px', height: 'auto', aspectRatio: '1' }}
                />
              </div>
              <p className="text-sm text-gray-600 mt-2 text-center">
                Left click to place panels • Right click to remove • Middle click to rotate
              </p>
            </div>
          </div>

          {/* 3D Preview - Allocated space */}
          <div className="w-full lg:col-span-4">
            <div className="bg-white p-4 rounded-lg shadow">
              <h3 className="font-bold text-lg mb-3 text-center">3D Preview</h3>
              <div className="flex justify-center">
                <canvas
                  ref={previewCanvasRef}
                  width={320}
                  height={480}
                  className="border border-gray-300 rounded bg-gray-200"
                  style={{ width: '100%', maxWidth: '320px', height: 'auto', aspectRatio: '2/3' }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 bg-gray-800 text-white px-3 md:px-4 py-2 rounded text-xs md:text-sm">
          Status: {statusMessage}
        </div>

        {/* 3D Model Preview Section */}
        <div className="mt-8 md:mt-12 bg-[#04012A] text-white py-8 md:py-12 px-3 md:px-6 rounded-lg">
          <h3 className="text-xl md:text-3xl font-extrabold text-center mb-6 md:mb-8">3D Model Preview</h3>
          <div className="flex flex-col md:flex-row gap-6 md:gap-12 items-center">
            <div className="w-full md:w-2/3 rounded-lg overflow-hidden bg-[#04012A]">
              <div className="mb-4 md:mb-6">
                <div className="flex flex-wrap justify-center gap-2 bg-[#04012A] p-2 rounded-t-lg">
                  {Object.entries(models).map(([key, model]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedModel(key)}
                      className={`px-3 md:px-4 py-2 rounded-md font-semibold transition-colors duration-200 text-xs md:text-sm ${
                        selectedModel === key
                          ? "bg-[#0474BC] text-white"
                          : "bg-[#D6ECFA] text-[#0474BC] hover:bg-[#A9D7F8]"
                      }`}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              </div>

              <div className="h-48 sm:h-64 md:h-[300px] lg:h-[400px] xl:h-[450px]">
                <Model_Preview 
                  key={selectedModel === "donut" && customModel ? `custom-${Date.now()}` : selectedModel}
                  loc={models[selectedModel].path} 
                  customScene={selectedModel === "donut" ? customModel : null}
                />
              </div>
            </div>

            <div className="w-full md:w-1/3 text-center md:text-left">
              <h4 className="text-lg md:text-xl font-bold mb-3 md:mb-4">Model Information</h4>
              <p className="mb-3 md:mb-4 text-sm md:text-base">
                <strong>Selected Model:</strong> {models[selectedModel].name}
              </p>
              {/* <p className="mb-3 md:mb-4 text-sm md:text-base">
                Use the floor plan builder above to design your house layout, then preview different architectural styles here.
              </p>
              <p className="text-xs md:text-sm text-gray-300">
                The 3D models shown here are examples of different house styles that can be built using our panel system.
              </p> */}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 
