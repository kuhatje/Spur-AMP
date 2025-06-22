// This component must run on client side only
"use client";

import * as THREE from 'three';

const COMPONENT_DIMENSIONS = {
  wall_panel: { width: 1, height: 2.5, depth: 0.2 },
  door_panel: { width: 1, height: 2.5, depth: 0.2, openingHeight: 2.0, openingWidth: 0.8 },
  window_panel: { width: 1, height: 2.5, depth: 0.2, openingHeight: 1.0, openingWidth: 0.8, openingOffsetY: 0.8 },
  floor_panel: { width: 1, height: 0.1, depth: 1 },
};

const COMPONENT_COLORS = {
  wall_panel: 0x8B4513,    // Brown
  door_panel: 0x654321,    // Dark brown
  window_panel: 0x87CEEB,  // Sky blue
  floor_panel: 0xD2691E,   // Chocolate
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

  createWallGeometry() {
    const dims = COMPONENT_DIMENSIONS.wall_panel;
    return new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
  }

  createDoorGeometry() {
    const dims = COMPONENT_DIMENSIONS.door_panel;
    
    // Create the main wall geometry
    const wallGeometry = new THREE.BoxGeometry(dims.width, dims.height, dims.depth);
    
    // Create the door opening by creating two parts: top and sides
    const geometries = [];
    
    // Top part above door
    const topGeometry = new THREE.BoxGeometry(
      dims.width, 
      dims.height - dims.openingHeight, 
      dims.depth
    );
    topGeometry.translate(0, dims.openingHeight / 2, 0);
    geometries.push(topGeometry);
    
    // Left side
    const leftSideWidth = (dims.width - dims.openingWidth) / 2;
    if (leftSideWidth > 0.01) {
      const leftGeometry = new THREE.BoxGeometry(leftSideWidth, dims.openingHeight, dims.depth);
      leftGeometry.translate(-dims.width/2 + leftSideWidth/2, -dims.height/2 + dims.openingHeight/2, 0);
      geometries.push(leftGeometry);
    }
    
    // Right side
    if (leftSideWidth > 0.01) {
      const rightGeometry = new THREE.BoxGeometry(leftSideWidth, dims.openingHeight, dims.depth);
      rightGeometry.translate(dims.width/2 - leftSideWidth/2, -dims.height/2 + dims.openingHeight/2, 0);
      geometries.push(rightGeometry);
    }
    
    // Merge geometries
    if (geometries.length === 1) {
      return geometries[0];
    } else {
      const mergedGeometry = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];
      const uvs = [];
      
      geometries.forEach(geo => {
        const posArray = geo.attributes.position.array;
        const normArray = geo.attributes.normal.array;
        const uvArray = geo.attributes.uv.array;
        
        positions.push(...posArray);
        normals.push(...normArray);
        uvs.push(...uvArray);
      });
      
      mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      
      return mergedGeometry;
    }
  }

  createWindowGeometry() {
    const dims = COMPONENT_DIMENSIONS.window_panel;
    
    // Similar to door but with window opening in the middle
    const geometries = [];
    
    // Top part above window
    const topHeight = dims.height - dims.openingOffsetY - dims.openingHeight;
    if (topHeight > 0.01) {
      const topGeometry = new THREE.BoxGeometry(dims.width, topHeight, dims.depth);
      topGeometry.translate(0, dims.height/2 - topHeight/2, 0);
      geometries.push(topGeometry);
    }
    
    // Bottom part below window
    if (dims.openingOffsetY > 0.01) {
      const bottomGeometry = new THREE.BoxGeometry(dims.width, dims.openingOffsetY, dims.depth);
      bottomGeometry.translate(0, -dims.height/2 + dims.openingOffsetY/2, 0);
      geometries.push(bottomGeometry);
    }
    
    // Left side
    const leftSideWidth = (dims.width - dims.openingWidth) / 2;
    if (leftSideWidth > 0.01) {
      const leftGeometry = new THREE.BoxGeometry(leftSideWidth, dims.openingHeight, dims.depth);
      leftGeometry.translate(
        -dims.width/2 + leftSideWidth/2, 
        -dims.height/2 + dims.openingOffsetY + dims.openingHeight/2, 
        0
      );
      geometries.push(leftGeometry);
    }
    
    // Right side
    if (leftSideWidth > 0.01) {
      const rightGeometry = new THREE.BoxGeometry(leftSideWidth, dims.openingHeight, dims.depth);
      rightGeometry.translate(
        dims.width/2 - leftSideWidth/2, 
        -dims.height/2 + dims.openingOffsetY + dims.openingHeight/2, 
        0
      );
      geometries.push(rightGeometry);
    }
    
    // Merge geometries (similar to door logic)
    if (geometries.length === 1) {
      return geometries[0];
    } else {
      const mergedGeometry = new THREE.BufferGeometry();
      const positions = [];
      const normals = [];
      const uvs = [];
      
      geometries.forEach(geo => {
        const posArray = geo.attributes.position.array;
        const normArray = geo.attributes.normal.array;
        const uvArray = geo.attributes.uv.array;
        
        positions.push(...posArray);
        normals.push(...normArray);
        uvs.push(...uvArray);
      });
      
      mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
      mergedGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
      
      return mergedGeometry;
    }
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
      case 'wall_panel':
        geometry = this.createWallGeometry();
        break;
      case 'door_panel':
        geometry = this.createDoorGeometry();
        break;
      case 'window_panel':
        geometry = this.createWindowGeometry();
        break;
      case 'floor_panel':
        geometry = this.createFloorGeometry();
        break;
      default:
        return; // Skip empty or unknown components
    }
    
    const material = this.createMaterialForComponent(component.type);
    const mesh = new THREE.Mesh(geometry, material);
    
    // Position the component
    const x = component.x;
    const z = component.y; // Y in 2D becomes Z in 3D
    const y = floorIndex * 2.6; // Stack floors vertically (floor height + small gap)
    
    // For floor panels, position them at the bottom of the floor
    if (component.type === 'floor_panel') {
      mesh.position.set(x, y - 1.3, z);
    } else {
      mesh.position.set(x, y, z);
    }
    
    // Apply rotation if needed
    if (component.rotation) {
      mesh.rotation.y = (component.rotation * Math.PI) / 180;
    }
    
    this.group.add(mesh);
  }

  convertHouseToScene(house) {
    // Clear existing geometry
    this.group.clear();
    
    // Process each floor
    house.floors.forEach((floor, floorIndex) => {
      Object.values(floor.components).forEach(component => {
        this.addComponentToScene(component, floorIndex);
      });
    });
    
    // Add some basic lighting to the scene
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    this.scene.add(ambientLight);
    
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    this.scene.add(directionalLight);
    
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