"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useIsVisible } from "../../JS_Scripts/Visible";
import Model_Preview from "../../JS_Scripts/Model";
import { HouseToGLBConverter } from "../../JS_Scripts/HouseToGLB";
import { useInventoryContext } from "../context/InventoryContext";

// Blueshell frame component types - simplified for structural design
enum ComponentType {
  PANEL_4X8 = "panel_4x8",
  CORNER_PANEL = "corner_panel",
  FLOOR_PANEL = "floor_panel",
  EMPTY = "empty"
}

// Component colors for blueshell visualization
const COMPONENT_COLORS = {
  [ComponentType.PANEL_4X8]: "#2E8B57",      // Sea Green - main structural panels
  [ComponentType.CORNER_PANEL]: "#228B22",   // Forest Green - corner reinforcement
  [ComponentType.FLOOR_PANEL]: "#8FBC8F",    // Dark Sea Green - floor panels
  [ComponentType.EMPTY]: "#F0F0F0"
};

interface Component {
  type: ComponentType;
  x: number;
  y: number;
  rotation: number;
}

interface Floor {
  floorNumber: number;
  width: number;
  height: number;
  components: { [key: string]: Component[] };
}

interface House {
  floors: Floor[];
  currentFloorIndex: number;
}

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
  const panelSize = 8;
  
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
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    // Set canvas size based on device
    const isMobile = window.innerWidth < 768;
    const canvasWidth = isMobile ? 280 : 380;
    const canvasHeight = isMobile ? 400 : 600;
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const scale = isMobile ? 15 : 20;
    const offsetX = isMobile ? 140 : 190;
    const offsetY = isMobile ? 300 : 400;
    const floorHeight = 3;
    
    // First, draw all floor planes (transparent outlines to show floor levels)
    house.floors.forEach((floor, floorIdx) => {
      const zOffset = floorIdx * floorHeight * scale;
      const points = isoProjectRect(0, 0, floor.width, floor.height, zOffset, scale, offsetX, offsetY);
      
      if (floorIdx === 0) {
        // Ground floor - solid fill
        ctx.fillStyle = '#C0C0C0';
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) {
          ctx.lineTo(points[i], points[i + 1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        // Upper floors - much more visible cutting planes
        const isCurrentFloor = floorIdx === house.currentFloorIndex;
        
        if (isCurrentFloor) {
          // Current floor - bright blue cutting plane
          ctx.fillStyle = 'rgba(4, 116, 188, 0.4)';
          ctx.strokeStyle = '#0474BC';
          ctx.lineWidth = 3;
        } else {
          // Other floors - visible gray cutting plane
          ctx.fillStyle = 'rgba(160, 160, 160, 0.6)';
          ctx.strokeStyle = '#606060';
          ctx.lineWidth = 2;
        }
        
        ctx.setLineDash([8, 4]); // More prominent dashes
        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 2; i < points.length; i += 2) {
          ctx.lineTo(points[i], points[i + 1]);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]); // Reset to solid lines
        
        // Add diagonal grid pattern for better visibility
        ctx.strokeStyle = isCurrentFloor ? '#0474BC' : '#808080';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        
        // Draw diagonal lines across the floor
        const gridSpacing = scale * 2;
        for (let i = -floor.width; i <= floor.width + floor.height; i++) {
          const x1 = i * gridSpacing;
          const y1 = 0;
          const x2 = x1 - floor.height * gridSpacing;
          const y2 = floor.height * gridSpacing;
          
          const p1 = isoProject(x1 / scale, y1 / scale, zOffset, scale, offsetX, offsetY);
          const p2 = isoProject(x2 / scale, y2 / scale, zOffset, scale, offsetX, offsetY);
          
          // Only draw lines within the floor bounds
          if (x1 >= 0 && x1 <= floor.width * scale && x2 >= 0 && x2 <= floor.width * scale) {
            ctx.beginPath();
            ctx.moveTo(p1[0], p1[1]);
            ctx.lineTo(p2[0], p2[1]);
            ctx.stroke();
          }
        }
        
        ctx.globalAlpha = 1.0; // Reset alpha
      }
    });

    // Then draw all the components on each floor
    house.floors.forEach((floor, floorIdx) => {
      const zOffset = floorIdx * floorHeight * scale;
      const isCurrentFloor = floorIdx === house.currentFloorIndex;
      
      // Draw blueshell frame components
      Object.values(floor.components).forEach(componentArray => {
        componentArray.forEach(component => {
          if (component.type === ComponentType.PANEL_4X8) {
            drawIsoPanel4x8(ctx, component, zOffset, scale, offsetX, offsetY, isCurrentFloor);
          } else if (component.type === ComponentType.CORNER_PANEL) {
            drawIsoCornerPanel(ctx, component, zOffset, scale, offsetX, offsetY, isCurrentFloor);
          } else if (component.type === ComponentType.FLOOR_PANEL) {
            drawIsoFloorPanel(ctx, component, zOffset, scale, offsetX, offsetY, isCurrentFloor);
          }
        });
      });
    });
  }, [house]);
  
  // Isometric projection helpers
  const isoProject = (x: number, y: number, z: number, scale: number, offsetX: number, offsetY: number): [number, number] => {
    const isoX = 0.866;
    const isoY = 0.5;
    const screenX = offsetX + (x - y) * isoX * scale;
    const screenY = offsetY - (x + y) * isoY * scale - z;
    return [screenX, screenY];
  };
  
  const isoProjectRect = (x: number, y: number, width: number, height: number, z: number, scale: number, offsetX: number, offsetY: number): number[] => {
    const p1 = isoProject(x, y, z, scale, offsetX, offsetY);
    const p2 = isoProject(x + width, y, z, scale, offsetX, offsetY);
    const p3 = isoProject(x + width, y + height, z, scale, offsetX, offsetY);
    const p4 = isoProject(x, y + height, z, scale, offsetX, offsetY);
    return [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]];
  };
  
  // 3D Isometric drawing functions for blueshell panels
  const drawIsoPanel4x8 = (ctx: CanvasRenderingContext2D, component: Component, zBase: number, scale: number, offsetX: number, offsetY: number, isCurrentFloor: boolean) => {
    const panelHeight = 3 * scale;
    const color = isCurrentFloor ? '#2E8B57' : '#5F9F7F';
    
    const p1 = isoProject(component.x, component.y, zBase, scale, offsetX, offsetY);
    const p2 = isoProject(component.x + 1, component.y, zBase, scale, offsetX, offsetY);
    const p3 = isoProject(component.x + 1, component.y, zBase + panelHeight, scale, offsetX, offsetY);
    const p4 = isoProject(component.x, component.y, zBase + panelHeight, scale, offsetX, offsetY);
    const p5 = isoProject(component.x + 1, component.y + 1, zBase, scale, offsetX, offsetY);
    const p6 = isoProject(component.x + 1, component.y + 1, zBase + panelHeight, scale, offsetX, offsetY);
    const p7 = isoProject(component.x, component.y + 1, zBase + panelHeight, scale, offsetX, offsetY);
    
    // Front face
    ctx.fillStyle = color;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Right face
    ctx.fillStyle = '#1F5F3F';
    ctx.beginPath();
    ctx.moveTo(p2[0], p2[1]);
    ctx.lineTo(p5[0], p5[1]);
    ctx.lineTo(p6[0], p6[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Top face
    ctx.fillStyle = '#4F8F6F';
    ctx.beginPath();
    ctx.moveTo(p4[0], p4[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.lineTo(p6[0], p6[1]);
    ctx.lineTo(p7[0], p7[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Add structural grid lines on front face
    ctx.strokeStyle = '#1F5F3F';
    ctx.lineWidth = 0.5;
    const gridLines = 4;
    for (let i = 1; i < gridLines; i++) {
      const ratio = i / gridLines;
      const px = p1[0] + (p2[0] - p1[0]) * ratio;
      const py = p1[1] + (p2[1] - p1[1]) * ratio;
      const px2 = p4[0] + (p3[0] - p4[0]) * ratio;
      const py2 = p4[1] + (p3[1] - p4[1]) * ratio;
      
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px2, py2);
      ctx.stroke();
    }
  };
  
  const drawIsoCornerPanel = (ctx: CanvasRenderingContext2D, component: Component, zBase: number, scale: number, offsetX: number, offsetY: number, isCurrentFloor: boolean) => {
    const panelHeight = 3 * scale;
    const color = isCurrentFloor ? '#228B22' : '#5F9F5F';
    const thickness = 0.25; // Panel thickness
    
    // Define L-shape vertices based on rotation (unified shape approach)
    let lVertices: Array<{x: number, y: number}> = [];
    
    switch (component.rotation) {
      case 0: // L opens to bottom-right ⌞
        lVertices = [
          {x: 0, y: 0},                    // Top-left outer
          {x: thickness, y: 0},            // Top-left inner
          {x: thickness, y: 1-thickness},  // Inner corner
          {x: 1, y: 1-thickness},          // Bottom inner
          {x: 1, y: 1},                    // Bottom-right outer
          {x: 0, y: 1}                     // Bottom-left outer
        ];
        break;
      case 90: // L opens to bottom-left ⌟
        lVertices = [
          {x: 0, y: 0},                    // Top-left outer
          {x: 1, y: 0},                    // Top-right outer
          {x: 1, y: 1},                    // Bottom-right outer
          {x: 0, y: 1},                    // Bottom-left outer
          {x: 0, y: 1-thickness},          // Left inner
          {x: 1-thickness, y: 1-thickness} // Inner corner
        ];
        break;
      case 180: // L opens to top-left ⌜
        lVertices = [
          {x: 0, y: 0},                    // Top-left outer
          {x: 1, y: 0},                    // Top-right outer
          {x: 1, y: 1},                    // Bottom-right outer
          {x: 1-thickness, y: 1},          // Bottom inner
          {x: 1-thickness, y: thickness},  // Inner corner
          {x: 0, y: thickness}             // Left inner
        ];
        break;
      case 270: // L opens to top-right ⌝
        lVertices = [
          {x: thickness, y: 0},            // Top inner
          {x: 1, y: 0},                    // Top-right outer
          {x: 1, y: 1},                    // Bottom-right outer
          {x: 0, y: 1},                    // Bottom-left outer
          {x: 0, y: 0},                    // Top-left outer
          {x: thickness, y: thickness}     // Inner corner
        ];
        break;
      default: // Fallback to 0 degree
        lVertices = [
          {x: 0, y: 0}, {x: thickness, y: 0}, {x: thickness, y: 1-thickness},
          {x: 1, y: 1-thickness}, {x: 1, y: 1}, {x: 0, y: 1}
        ];
    }
    
    // Convert to world coordinates
    const worldVertices = lVertices.map(v => ({
      x: component.x + v.x,
      y: component.y + v.y
    }));
    
    // Project all vertices to isometric space
    const bottomPoints = worldVertices.map(v => isoProject(v.x, v.y, zBase, scale, offsetX, offsetY));
    const topPoints = worldVertices.map(v => isoProject(v.x, v.y, zBase + panelHeight, scale, offsetX, offsetY));
    
    // Draw the unified L-shaped corner panel
    
    // Bottom face (foundation)
    ctx.fillStyle = '#1F5F1F';
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bottomPoints[0][0], bottomPoints[0][1]);
    for (let i = 1; i < bottomPoints.length; i++) {
      ctx.lineTo(bottomPoints[i][0], bottomPoints[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Top face
    ctx.fillStyle = '#4F8F4F';
    ctx.beginPath();
    ctx.moveTo(topPoints[0][0], topPoints[0][1]);
    for (let i = 1; i < topPoints.length; i++) {
      ctx.lineTo(topPoints[i][0], topPoints[i][1]);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Side faces - draw each edge as a separate face
    ctx.fillStyle = color;
    for (let i = 0; i < worldVertices.length; i++) {
      const next = (i + 1) % worldVertices.length;
      
      // Only draw visible faces (avoid internal faces)
      const edge = {
        x: worldVertices[next].x - worldVertices[i].x,
        y: worldVertices[next].y - worldVertices[i].y
      };
      
      // Skip very small edges (internal connections)
      if (Math.abs(edge.x) < 0.01 && Math.abs(edge.y) < 0.01) continue;
      
      // Draw side face between bottom[i] -> bottom[next] -> top[next] -> top[i]
      ctx.beginPath();
      ctx.moveTo(bottomPoints[i][0], bottomPoints[i][1]);
      ctx.lineTo(bottomPoints[next][0], bottomPoints[next][1]);
      ctx.lineTo(topPoints[next][0], topPoints[next][1]);
      ctx.lineTo(topPoints[i][0], topPoints[i][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  };
  
  const drawIsoFloorPanel = (ctx: CanvasRenderingContext2D, component: Component, zBase: number, scale: number, offsetX: number, offsetY: number, isCurrentFloor: boolean) => {
    const floorThickness = 0.3 * scale;
    const color = isCurrentFloor ? '#8FBC8F' : '#A8CCA8';
    
    const p1 = isoProject(component.x, component.y, zBase + floorThickness, scale, offsetX, offsetY);
    const p2 = isoProject(component.x + 1, component.y, zBase + floorThickness, scale, offsetX, offsetY);
    const p3 = isoProject(component.x + 1, component.y + 1, zBase + floorThickness, scale, offsetX, offsetY);
    const p4 = isoProject(component.x, component.y + 1, zBase + floorThickness, scale, offsetX, offsetY);
    
    ctx.fillStyle = color;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Decking pattern
    ctx.strokeStyle = '#4F7F5F';
    ctx.lineWidth = 0.5;
    const deckingLines = 6;
    for (let i = 1; i < deckingLines; i++) {
      const ratio = i / deckingLines;
      const px1 = p1[0] + (p2[0] - p1[0]) * ratio;
      const py1 = p1[1] + (p2[1] - p1[1]) * ratio;
      const px2 = p4[0] + (p3[0] - p4[0]) * ratio;
      const py2 = p4[1] + (p3[1] - p4[1]) * ratio;
      
      ctx.beginPath();
      ctx.moveTo(px1, py1);
      ctx.lineTo(px2, py2);
      ctx.stroke();
    }
  };
  
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
                🐛 Debug {showDebug ? '▼' : '▶'}
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