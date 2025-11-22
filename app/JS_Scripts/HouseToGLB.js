// This component must run on client side only
"use client";

import * as THREE from 'three';

const COMPONENT_DIMENSIONS = {
  panel_4x8: { width: 1, thickness: 0.1, height: 2},
  corner_panel: { width: 1, depth: 1, thickness: 0.1, height: 2},
  floor_panel: { width: 1, depth: 1, height: 0.15 },
};

const COMPONENT_COLORS = {
  panel_4x8: 0x2E8B57,     // Sea Green - main structural panels
  corner_panel: 0x228B22,  // Forest Green - corner reinforcement
  floor_panel: 0x8FBC8F,   // Dark Sea Green - floor panels
};

export class HouseToGLBConverter {
  constructor() {
    this.scene = new THREE.Scene();
    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.GLTFExporter = null;
  }

  async initializeExporter() {
    if (typeof window !== 'undefined' && !this.GLTFExporter) {
      try {
        const { GLTFExporter } = await import('three/examples/jsm/exporters/GLTFExporter.js');
        this.GLTFExporter = GLTFExporter;
      } catch (error) {
        console.error('Failed to load GLTFExporter:', error);
      }
    }
  }

  createPanel4x8Geometry() {
    const dims = COMPONENT_DIMENSIONS.panel_4x8;
    return new THREE.BoxGeometry(dims.width, dims.height, dims.thickness);
  }

  createCornerPanelGeometry() {
    const dims = COMPONENT_DIMENSIONS.corner_panel;
    
    // Create a proper L-shaped geometry using Shape and ExtrudeGeometry
    const shape = new THREE.Shape();
    const thickness = dims.thickness;
    
    // Define L-shape path (default orientation - opens to bottom-right)
    shape.moveTo(0, 0);                    // Start at origin
    shape.lineTo(1, 0);            // Top inner edge
    shape.lineTo(1, thickness);  // Inner corner vertical
    shape.lineTo(thickness, thickness);          // Inner corner horizontal
    shape.lineTo(thickness, 1);                    // Bottom-right outer
    shape.lineTo(0, 1);                    // Bottom-left outer
    shape.closePath();                     // Back to start
    
    // Extrude the shape to create 3D geometry
    // Shape is in XY plane, extrudes along Z (height)
    const extrudeSettings = {
      depth: dims.height,
      bevelEnabled: false
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    geometry.rotateX(-Math.PI / 2);
    // Center the geometry
    geometry.translate(0, -dims.height/2, 0);
    
    return geometry;
  }


  createFloorGeometry() {
    const dims = COMPONENT_DIMENSIONS.floor_panel;
    return new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
  }

  createMaterialForComponent(componentType) {
    const color = COMPONENT_COLORS[componentType] || 0x888888;
    return new THREE.MeshStandardMaterial({ 
      color: color,
      roughness: 0.7,
      metalness: 0.1
    });
  }

  addComponentToScene(component, floorIndex) {
    let geometry;
    
    switch (component.type) {
      case 'panel_4x8':
        geometry = this.createPanel4x8Geometry();
        break;
      case 'corner_panel':
        geometry = this.createCornerPanelGeometry();
        break;
      case 'floor_panel':
        geometry = this.createFloorGeometry();
        break;
      default:
        return; // Skip empty or unknown components
    }
    
    const material = this.createMaterialForComponent(component.type);
    const mesh = new THREE.Mesh(geometry, material);
    
    // Improved positioning - center components on grid cells and ensure proper alignment
    const gridSize = 1.0; // Each grid cell is 1 unit
    const x = (component.x - 4.5) * gridSize; // Center the 10x10 grid around origin
    const negz = (component.y - 4.5) * gridSize; 
    const floorHeight = 3; // Height between floors
    
    let y;
    if (component.type === 'floor_panel') {
      // Floor panels at the bottom of each floor
      y = floorIndex * floorHeight;
    } else {
      // Walls, doors, windows stand on the floor
      y = floorIndex * floorHeight + 1; // Half the wall height above floor
    }
    
    mesh.position.set(x, y, -negz);
    
    if (component.type === 'panel_4x8') {
      // Apply rotation if not floor panel 
      if (component.rotation === 0) {
      mesh.position.set(x, y, -negz + (0.5 - COMPONENT_DIMENSIONS.panel_4x8.thickness/2));
      }
      else if (component.rotation === 90) {
      mesh.position.set(x - (0.5 - COMPONENT_DIMENSIONS.panel_4x8.thickness/2), y, -negz);
      mesh.rotation.y = Math.PI / 2;
      }
      else if (component.rotation === 180) {
      mesh.position.set(x, y, -negz - (0.5 - COMPONENT_DIMENSIONS.panel_4x8.thickness/2));
      }
      else if (component.rotation === 270) {
      mesh.position.set(x + (0.5 - COMPONENT_DIMENSIONS.panel_4x8.thickness/2), y, -negz);
      mesh.rotation.y = Math.PI / 2;
      }
    }

    else if (component.type === 'corner_panel') {
      if (component.rotation === 0) {
        mesh.position.set(x - 0.5, y, -negz + 0.5);
      }
      else if (component.rotation === 90) {
        mesh.rotation.y = -Math.PI / 2;
        mesh.position.set(x - 0.5, y, -negz - 0.5);
      }
      else if (component.rotation === 180) {
        mesh.rotation.y = Math.PI;
        mesh.position.set(x + 0.5, y, -negz - 0.5);
      }
      else if (component.rotation === 270) {
        mesh.rotation.y = Math.PI / 2;
        mesh.position.set(x + 0.5, y, -negz + 0.5);
      }
    }
    
    // Add name for debugging
    mesh.name = `${component.type}_${component.x}_${component.y}_floor${floorIndex}`;
    
    this.group.add(mesh);
  }

  convertHouseToScene(house) {
    // Clear existing geometry and lights
    this.group.clear();
    
    // Remove existing lights
    const lightsToRemove = [];
    this.scene.traverse((child) => {
      if (child.type === 'AmbientLight' || child.type === 'DirectionalLight') {
        lightsToRemove.push(child);
      }
    });
    lightsToRemove.forEach(light => this.scene.remove(light));
    
    // Process each floor
    house.floors.forEach((floor, floorIndex) => {
      Object.values(floor.components).forEach(componentArray => {
        componentArray.forEach(component => {
          this.addComponentToScene(component, floorIndex);
        });
      });
    });
    
    // Add improved lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
    this.scene.add(ambientLight);
    
    // Multiple directional lights for better illumination
    const mainLight = new THREE.DirectionalLight(0xffffff, 0.8);
    mainLight.position.set(10, 10, 5);
    mainLight.castShadow = false;
    this.scene.add(mainLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
    fillLight.position.set(-5, 8, -5);
    fillLight.castShadow = false;
    this.scene.add(fillLight);
    
    const backLight = new THREE.DirectionalLight(0xffffff, 0.2);
    backLight.position.set(0, 5, -10);
    backLight.castShadow = false;
    this.scene.add(backLight);
    
    // Center the group for better viewing
    const box = new THREE.Box3().setFromObject(this.group);
    const center = box.getCenter(new THREE.Vector3());
    this.group.position.sub(center);
    
    return this.scene;
  }

  async exportToGLB(house) {
    await this.initializeExporter();
    
    if (!this.GLTFExporter) {
      throw new Error('GLTFExporter could not be loaded');
    }
    
    this.convertHouseToScene(house);
    
    const exporter = new this.GLTFExporter();
    
    return new Promise((resolve, reject) => {
      exporter.parse(
        this.scene,
        (result) => {
          const blob = new Blob([result], { type: 'application/octet-stream' });
          const url = URL.createObjectURL(blob);
          resolve(url);
        },
        (error) => {
          console.error('GLB export error:', error);
          reject(error);
        },
        {
          binary: true,
          embedImages: true
        }
      );
    });
  }

  async downloadGLB(house, filename = 'custom-house.glb') {
    try {
      const url = await this.exportToGLB(house);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export GLB:', error);
      throw error;
    }
  }
} 