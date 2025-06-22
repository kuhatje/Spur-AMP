"use client";
import { useState, useRef, useCallback, useEffect } from "react";
import { useIsVisible } from "../../JS_Scripts/Visible";
import Model_Preview from "../../JS_Scripts/Model";
import { HouseToGLBConverter } from "../../JS_Scripts/HouseToGLB";

// Component types matching the tkinter implementation
enum ComponentType {
  WALL_PANEL = "wall_panel",
  DOOR_PANEL = "door_panel", 
  WINDOW_PANEL = "window_panel",
  FLOOR_PANEL = "floor_panel",
  EMPTY = "empty"
}

// Component colors for visualization
const COMPONENT_COLORS = {
  [ComponentType.WALL_PANEL]: "#8B4513",
  [ComponentType.DOOR_PANEL]: "#654321", 
  [ComponentType.WINDOW_PANEL]: "#87CEEB",
  [ComponentType.FLOOR_PANEL]: "#D2691E",
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
  components: { [key: string]: Component };
}

interface House {
  floors: Floor[];
  currentFloorIndex: number;
}

export default function Builder() {
  const ref_Builder = useRef(null);
  const is_visible_Builder = useIsVisible(ref_Builder);
  
  // Canvas refs
  const gridCanvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // State management
  const [house, setHouse] = useState<House>({
    floors: [{ floorNumber: 0, width: 10, height: 10, components: {} }],
    currentFloorIndex: 0
  });
  
  const [selectedComponentType, setSelectedComponentType] = useState<ComponentType>(ComponentType.WALL_PANEL);
  const [statusMessage, setStatusMessage] = useState("Ready");
  
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
  
  const addComponent = (x: number, y: number, type: ComponentType) => {
    const key = `${x},${y}`;
    const newHouse = { ...house };
    newHouse.floors[house.currentFloorIndex].components[key] = {
      type,
      x,
      y,
      rotation: 0
    };
    setHouse(newHouse);
  };
  
  const removeComponent = (x: number, y: number) => {
    const key = `${x},${y}`;
    const newHouse = { ...house };
    delete newHouse.floors[house.currentFloorIndex].components[key];
    setHouse(newHouse);
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
    setStatusMessage(`Added Floor ${newFloor.floorNumber}`);
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
      setStatusMessage("Removed floor");
    } else {
      setStatusMessage("Must have at least one floor");
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
    setStatusMessage("Cleared floor");
  };
  
  const fillWalls = () => {
    const floor = getCurrentFloor();
    const newHouse = { ...house };
    const components = { ...floor.components };
    
    // Fill perimeter with walls
    for (let x = 0; x < floor.width; x++) {
      components[`${x},0`] = { type: ComponentType.WALL_PANEL, x, y: 0, rotation: 0 };
      components[`${x},${floor.height - 1}`] = { type: ComponentType.WALL_PANEL, x, y: floor.height - 1, rotation: 0 };
    }
    for (let y = 1; y < floor.height - 1; y++) {
      components[`0,${y}`] = { type: ComponentType.WALL_PANEL, x: 0, y, rotation: 0 };
      components[`${floor.width - 1},${y}`] = { type: ComponentType.WALL_PANEL, x: floor.width - 1, y, rotation: 0 };
    }
    
    newHouse.floors[house.currentFloorIndex].components = components;
    setHouse(newHouse);
    setStatusMessage("Added perimeter walls");
  };

  const loadFloorPanels = () => {
    const floor = getCurrentFloor();
    const newHouse = { ...house };
    const components = { ...floor.components };
    
    // Fill entire floor with floor panels
    for (let x = 0; x < floor.width; x++) {
      for (let y = 0; y < floor.height; y++) {
        components[`${x},${y}`] = { type: ComponentType.FLOOR_PANEL, x, y, rotation: 0 };
      }
    }
    
    newHouse.floors[house.currentFloorIndex].components = components;
    setHouse(newHouse);
    setStatusMessage("Loaded floor panels");
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
    Object.values(floor.components).forEach(component => {
      drawComponent(ctx, component, cellSize);
    });
    
    // Draw drag selection rectangle
    if (isDragging && dragStart && dragEnd) {
      const startX = Math.min(dragStart.x, dragEnd.x) * cellSize;
      const startY = Math.min(dragStart.y, dragEnd.y) * cellSize;
      const endX = Math.max(dragStart.x, dragEnd.x) * cellSize + cellSize;
      const endY = Math.max(dragStart.y, dragEnd.y) * cellSize + cellSize;
      
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
  
  const drawComponent = (ctx: CanvasRenderingContext2D, component: Component, cellSize: number = gridSize) => {
    const x1 = component.x * cellSize;
    const y1 = component.y * cellSize;
    const x2 = x1 + cellSize;
    const y2 = y1 + cellSize;
    
    const color = COMPONENT_COLORS[component.type];
    
    // Draw base rectangle
    ctx.fillStyle = color;
    ctx.strokeStyle = 'black';
    ctx.lineWidth = 2;
    ctx.fillRect(x1, y1, cellSize, cellSize);
    ctx.strokeRect(x1, y1, cellSize, cellSize);
    
    // Draw component-specific details
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    
    if (component.type === ComponentType.DOOR_PANEL) {
      // Draw door swing arc
      ctx.beginPath();
      ctx.arc(x1, y1, cellSize, 0, Math.PI / 2);
      ctx.stroke();
    } else if (component.type === ComponentType.WINDOW_PANEL) {
      // Draw window cross
      ctx.beginPath();
      ctx.moveTo(x1 + cellSize / 2, y1);
      ctx.lineTo(x1 + cellSize / 2, y2);
      ctx.moveTo(x1, y1 + cellSize / 2);
      ctx.lineTo(x2, y1 + cellSize / 2);
      ctx.stroke();
    } else if (component.type === ComponentType.FLOOR_PANEL) {
      // Draw floor tile pattern
      ctx.strokeStyle = '#8B6914';
      ctx.lineWidth = 1;
      const padding = Math.max(2, cellSize * 0.1); // Responsive padding
      ctx.beginPath();
      ctx.moveTo(x1 + padding, y1 + padding);
      ctx.lineTo(x2 - padding, y2 - padding);
      ctx.moveTo(x1 + padding, y2 - padding);
      ctx.lineTo(x2 - padding, y1 + padding);
      ctx.stroke();
    }
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
      
      // Draw components
      Object.values(floor.components).forEach(component => {
        if (component.type === ComponentType.WALL_PANEL) {
          drawIsoWall(ctx, component.x, component.y, zOffset, scale, offsetX, offsetY, isCurrentFloor);
        } else if (component.type === ComponentType.DOOR_PANEL) {
          drawIsoDoor(ctx, component.x, component.y, zOffset, scale, offsetX, offsetY, isCurrentFloor);
        } else if (component.type === ComponentType.WINDOW_PANEL) {
          drawIsoWindow(ctx, component.x, component.y, zOffset, scale, offsetX, offsetY, isCurrentFloor);
        } else if (component.type === ComponentType.FLOOR_PANEL) {
          drawIsoFloor(ctx, component.x, component.y, zOffset, scale, offsetX, offsetY, isCurrentFloor);
        }
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
  
  // 3D Isometric drawing functions
  const drawIsoWall = (ctx: CanvasRenderingContext2D, x: number, y: number, zBase: number, scale: number, offsetX: number, offsetY: number, isCurrentFloor: boolean) => {
    const wallHeight = 3 * scale;
    const color = isCurrentFloor ? '#8B4513' : '#A0826D';
    
    const p1 = isoProject(x, y, zBase, scale, offsetX, offsetY);
    const p2 = isoProject(x + 1, y, zBase, scale, offsetX, offsetY);
    const p3 = isoProject(x + 1, y, zBase + wallHeight, scale, offsetX, offsetY);
    const p4 = isoProject(x, y, zBase + wallHeight, scale, offsetX, offsetY);
    const p5 = isoProject(x + 1, y + 1, zBase, scale, offsetX, offsetY);
    const p6 = isoProject(x + 1, y + 1, zBase + wallHeight, scale, offsetX, offsetY);
    const p7 = isoProject(x, y + 1, zBase + wallHeight, scale, offsetX, offsetY);
    
    // Front face
    ctx.fillStyle = color;
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Right face
    ctx.beginPath();
    ctx.moveTo(p2[0], p2[1]);
    ctx.lineTo(p5[0], p5[1]);
    ctx.lineTo(p6[0], p6[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Top face
    ctx.fillStyle = '#6B3410';
    ctx.beginPath();
    ctx.moveTo(p4[0], p4[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.lineTo(p6[0], p6[1]);
    ctx.lineTo(p7[0], p7[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  
  const drawIsoDoor = (ctx: CanvasRenderingContext2D, x: number, y: number, zBase: number, scale: number, offsetX: number, offsetY: number, isCurrentFloor: boolean) => {
    const doorHeight = 2.5 * scale;
    const color = isCurrentFloor ? '#654321' : '#806040';
    
    const p1 = isoProject(x, y, zBase, scale, offsetX, offsetY);
    const p2 = isoProject(x + 1, y, zBase, scale, offsetX, offsetY);
    const p3 = isoProject(x + 1, y, zBase + doorHeight, scale, offsetX, offsetY);
    const p4 = isoProject(x, y, zBase + doorHeight, scale, offsetX, offsetY);
    
    ctx.fillStyle = color;
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  
  const drawIsoWindow = (ctx: CanvasRenderingContext2D, x: number, y: number, zBase: number, scale: number, offsetX: number, offsetY: number, isCurrentFloor: boolean) => {
    const wallHeight = 3 * scale;
    const windowBottom = 1 * scale;
    const windowTop = 2.5 * scale;
    const color = isCurrentFloor ? '#8B4513' : '#A0826D';
    
    // Bottom part
    const p1 = isoProject(x, y, zBase, scale, offsetX, offsetY);
    const p2 = isoProject(x + 1, y, zBase, scale, offsetX, offsetY);
    const p5 = isoProject(x, y, zBase + windowBottom, scale, offsetX, offsetY);
    const p6 = isoProject(x + 1, y, zBase + windowBottom, scale, offsetX, offsetY);
    
    ctx.fillStyle = color;
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p6[0], p6[1]);
    ctx.lineTo(p5[0], p5[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Top part
    const p7 = isoProject(x, y, zBase + windowTop, scale, offsetX, offsetY);
    const p8 = isoProject(x + 1, y, zBase + windowTop, scale, offsetX, offsetY);
    const p3 = isoProject(x + 1, y, zBase + wallHeight, scale, offsetX, offsetY);
    const p4 = isoProject(x, y, zBase + wallHeight, scale, offsetX, offsetY);
    
    ctx.beginPath();
    ctx.moveTo(p7[0], p7[1]);
    ctx.lineTo(p8[0], p8[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Window glass
    ctx.fillStyle = '#87CEEB';
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(p5[0], p5[1]);
    ctx.lineTo(p6[0], p6[1]);
    ctx.lineTo(p8[0], p8[1]);
    ctx.lineTo(p7[0], p7[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1.0;
  };
  
  const drawIsoFloor = (ctx: CanvasRenderingContext2D, x: number, y: number, zBase: number, scale: number, offsetX: number, offsetY: number, isCurrentFloor: boolean) => {
    const floorThickness = 0.2 * scale;
    const color = isCurrentFloor ? '#D2691E' : '#C8B88B';
    
    const p1 = isoProject(x, y, zBase + floorThickness, scale, offsetX, offsetY);
    const p2 = isoProject(x + 1, y, zBase + floorThickness, scale, offsetX, offsetY);
    const p3 = isoProject(x + 1, y + 1, zBase + floorThickness, scale, offsetX, offsetY);
    const p4 = isoProject(x, y + 1, zBase + floorThickness, scale, offsetX, offsetY);
    
    ctx.fillStyle = color;
    ctx.strokeStyle = 'black';
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p2[0], p2[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    
    // Tile pattern
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(p1[0], p1[1]);
    ctx.lineTo(p3[0], p3[1]);
    ctx.moveTo(p2[0], p2[1]);
    ctx.lineTo(p4[0], p4[1]);
    ctx.stroke();
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
    const y = Math.floor(canvasY / cellSize);
    
    if (x >= 0 && x < floor.width && y >= 0 && y < floor.height) {
      setIsDragging(true);
      setDragStart({x, y});
      setDragEnd({x, y});
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
    const y = Math.floor(canvasY / cellSize);
    
    if (x >= 0 && x < floor.width && y >= 0 && y < floor.height) {
      setDragEnd({x, y});
    }
  };

  const handleMouseUp = (event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart || !dragEnd) return;
    
    setIsDragging(false);
    
    // Fill the selected area
    const minX = Math.min(dragStart.x, dragEnd.x);
    const maxX = Math.max(dragStart.x, dragEnd.x);
    const minY = Math.min(dragStart.y, dragEnd.y);
    const maxY = Math.max(dragStart.y, dragEnd.y);
    
    let placedCount = 0;
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        addComponent(x, y, selectedComponentType);
        placedCount++;
      }
    }
    
    setStatusMessage(`Placed ${placedCount} ${selectedComponentType.replace('_', ' ')}(s)`);
    setDragStart(null);
    setDragEnd(null);
  };

  const handleGridClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // This is now handled by mouse down/up events
  };
  
  const handleGridRightClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    
    const canvas = gridCanvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const canvasX = (event.clientX - rect.left) * (canvas.width / rect.width);
    const canvasY = (event.clientY - rect.top) * (canvas.height / rect.height);
    
    const floor = getCurrentFloor();
    const cellSize = Math.min(canvas.width / floor.width, canvas.height / floor.height);
    
    const x = Math.floor(canvasX / cellSize);
    const y = Math.floor(canvasY / cellSize);
    
    if (x >= 0 && x < floor.width && y >= 0 && y < floor.height) {
      removeComponent(x, y);
      setStatusMessage(`Removed component at (${x}, ${y})`);
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
      project: 'House Builder Project',
      timestamp: new Date().toISOString(),
      floors: house.floors.map(floor => ({
        floorNumber: floor.floorNumber,
        dimensions: { width: floor.width, height: floor.height },
        components: Object.values(floor.components).map(component => ({
          type: component.type,
          position: { x: component.x, y: component.y },
          rotation: component.rotation
        }))
      }))
    };
    
    const blob = new Blob([JSON.stringify(manufacturingData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'house-manufacturing-data.json';
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage("Manufacturing data exported");
  };

  const generateCustomModel = async () => {
    try {
      setStatusMessage("Generating 3D model...");
      const scene = glbConverter.convertHouseToScene(house);
      setCustomModel(scene);
      setSelectedModel("donut"); // Switch to the custom model tab
      setStatusMessage("3D model generated successfully! View it in the 'Custom Design' tab below.");
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
  
  // Update views when house changes
  useEffect(() => {
    updateFloorView();
    update3DPreview();
  }, [house, updateFloorView, update3DPreview]);

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
          <h2 className="text-2xl md:text-4xl font-extrabold mb-2 md:mb-4">House Builder</h2>
          <p className="text-sm md:text-lg">Design your house with our interactive floor plan builder</p>
        </div>

        {/* Mobile-first responsive grid */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 gap-4 md:gap-6 bg-gray-100 text-gray-800 p-3 md:p-6 rounded-lg">
          
          {/* Controls Panel - Full width on mobile, left column on desktop */}
          <div className="w-full lg:col-span-3 space-y-4 md:space-y-6">
            {/* Floor Management */}
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <h3 className="font-bold text-base md:text-lg mb-2 md:mb-3">Floor Management</h3>
              <select 
                value={house.currentFloorIndex}
                onChange={(e) => changeFloor(parseInt(e.target.value))}
                className="w-full p-2 border rounded mb-2 md:mb-3 text-sm md:text-base"
              >
                {house.floors.map((_, index) => (
                  <option key={index} value={index}>Floor {index}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button 
                  onClick={addFloor}
                  className="flex-1 bg-blue-500 text-white px-2 md:px-3 py-2 rounded hover:bg-blue-600 text-xs md:text-sm"
                >
                  Add Floor
                </button>
                <button 
                  onClick={removeFloor}
                  className="flex-1 bg-red-500 text-white px-2 md:px-3 py-2 rounded hover:bg-red-600 text-xs md:text-sm"
                >
                  Remove Floor
                </button>
              </div>
            </div>

            {/* Components */}
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <h3 className="font-bold text-base md:text-lg mb-2 md:mb-3">Components</h3>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                {Object.values(ComponentType).filter(type => type !== ComponentType.EMPTY).map(type => (
                  <label key={type} className="flex items-center text-xs md:text-sm">
                    <input
                      type="radio"
                      name="component"
                      value={type}
                      checked={selectedComponentType === type}
                      onChange={(e) => setSelectedComponentType(e.target.value as ComponentType)}
                      className="mr-2"
                    />
                    {type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </label>
                ))}
              </div>
            </div>

            {/* Tools */}
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <h3 className="font-bold text-base md:text-lg mb-2 md:mb-3">Tools</h3>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
                <button 
                  onClick={clearFloor}
                  className="bg-orange-500 text-white px-2 md:px-3 py-2 rounded hover:bg-orange-600 text-xs md:text-sm"
                >
                  Clear Floor
                </button>
                <button 
                  onClick={fillWalls}
                  className="bg-green-500 text-white px-2 md:px-3 py-2 rounded hover:bg-green-600 text-xs md:text-sm"
                >
                  Fill Walls
                </button>
                <button 
                  onClick={loadFloorPanels}
                  className="bg-amber-600 text-white px-2 md:px-3 py-2 rounded hover:bg-amber-700 text-xs md:text-sm col-span-2 md:col-span-1"
                >
                  Load Floor Panels
                </button>
              </div>
            </div>

            {/* File Operations */}
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <h3 className="font-bold text-base md:text-lg mb-2 md:mb-3">File Operations</h3>
              <div className="space-y-2">
                <button 
                  onClick={saveProject}
                  className="w-full bg-blue-600 text-white px-2 md:px-3 py-2 rounded hover:bg-blue-700 text-xs md:text-sm"
                >
                  Save Project
                </button>
                <label className="w-full bg-purple-600 text-white px-2 md:px-3 py-2 rounded hover:bg-purple-700 cursor-pointer block text-center text-xs md:text-sm">
                  Load Project
                  <input
                    type="file"
                    accept=".json"
                    onChange={loadProject}
                    className="hidden"
                  />
                </label>
                <button 
                  onClick={exportToManufacturing}
                  className="w-full bg-indigo-600 text-white px-2 md:px-3 py-2 rounded hover:bg-indigo-700 text-xs md:text-sm"
                >
                  Export to Manufacturing
                </button>
              </div>
            </div>

            {/* 3D Model Generation */}
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <h3 className="font-bold text-base md:text-lg mb-2 md:mb-3">3D Model</h3>
              <div className="space-y-2">
                <button 
                  onClick={generateCustomModel}
                  className="w-full bg-green-600 text-white px-2 md:px-3 py-2 rounded hover:bg-green-700 text-xs md:text-sm"
                >
                  Generate 3D Model
                </button>
                <button 
                  onClick={downloadCustomModel}
                  className="w-full bg-teal-600 text-white px-2 md:px-3 py-2 rounded hover:bg-teal-700 text-xs md:text-sm"
                  disabled={!customModel}
                >
                  Download GLB
                </button>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                Generate a 3D model from your design and view it in the preview below
              </p>
            </div>
          </div>

          {/* 2D Grid View - Responsive canvas */}
          <div className="w-full lg:col-span-6">
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <h3 className="font-bold text-base md:text-lg mb-2 md:mb-3 text-center">2D Floor Plan</h3>
              <div className="border-2 border-gray-300 rounded overflow-hidden flex justify-center">
                <canvas
                  ref={gridCanvasRef}
                  width={320}
                  height={320}
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onContextMenu={handleGridRightClick}
                  className="cursor-crosshair bg-white max-w-full h-auto md:w-[400px] md:h-[400px]"
                  style={{ width: '100%', maxWidth: '400px', height: 'auto', aspectRatio: '1' }}
                />
              </div>
              <p className="text-xs md:text-sm text-gray-600 mt-2 text-center">
                Left click to place • Right click to remove
              </p>
            </div>
          </div>

          {/* 3D Preview - Responsive canvas */}
          <div className="w-full lg:col-span-3">
            <div className="bg-white p-3 md:p-4 rounded-lg shadow">
              <h3 className="font-bold text-base md:text-lg mb-2 md:mb-3 text-center">3D Preview</h3>
              <div className="flex justify-center">
                <canvas
                  ref={previewCanvasRef}
                  width={280}
                  height={400}
                  className="border border-gray-300 rounded bg-gray-200 max-w-full h-auto md:w-[380px] md:h-[600px]"
                  style={{ width: '100%', maxWidth: '280px', height: 'auto', aspectRatio: '0.7' }}
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
              <p className="mb-3 md:mb-4 text-sm md:text-base">
                Use the floor plan builder above to design your house layout, then preview different architectural styles here.
              </p>
              <p className="text-xs md:text-sm text-gray-300">
                The 3D models shown here are examples of different house styles that can be built using our panel system.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
} 