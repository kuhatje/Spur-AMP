"use client";
import { useState, useRef, useEffect } from "react";
import Model_Preview from "../../JS_Scripts/Model";
import { useInventoryContext } from "../context/InventoryContext";

// Import ComponentSpec interface from the inventory hook
import { ComponentSpec } from "../hooks/useInventory";

interface ComponentLibraryProps {
  onAddToProject?: (component: ComponentSpec) => void;
}

export default function ComponentLibrary({ onAddToProject }: ComponentLibraryProps) {
  // Get inventory context
  const { inventory, getTotalCost, getTotalWeight, getInventorySummary, PANEL_SPECS } = useInventoryContext();
  
  // Convert PANEL_SPECS to array for component selection
  const DAYLUN_COMPONENTS = Object.values(PANEL_SPECS);
  
  const [selectedComponent, setSelectedComponent] = useState<ComponentSpec>(DAYLUN_COMPONENTS[0]);
  const [showFallback, setShowFallback] = useState(false);
  const [modelLoadError, setModelLoadError] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw fallback canvas visualization when 3D model fails to load
  useEffect(() => {
    if ((showFallback || modelLoadError) && selectedComponent && canvasRef.current) {
      drawComponentVisual(canvasRef.current, selectedComponent);
    }
  }, [selectedComponent, showFallback, modelLoadError]);

  // Reset error states when component changes
  useEffect(() => {
    setModelLoadError(false);
    setShowFallback(false);
  }, [selectedComponent]);

  const drawComponentVisual = (canvas: HTMLCanvasElement, component: ComponentSpec) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate scale to fit canvas
    const canvasWidth = 400;
    const canvasHeight = 300;
    const padding = 40;

    // Scale based on component dimensions
    const scaleX = (canvasWidth - 2 * padding) / component.width;
    const scaleY = (canvasHeight - 2 * padding) / component.height;
    const scale = Math.min(scaleX, scaleY) * 0.8;

    // Calculate panel dimensions
    const panelWidth = component.width * scale;
    const panelHeight = component.height * scale;

    // Center the panel
    const xOffset = (canvasWidth - panelWidth) / 2;
    const yOffset = (canvasHeight - panelHeight) / 2;

    // Draw isometric view of panel
    const thicknessVisual = 20;

    // Front face
    ctx.fillStyle = component.color;
    ctx.strokeStyle = '#2C3E50';
    ctx.lineWidth = 2;
    ctx.fillRect(xOffset, yOffset + thicknessVisual, panelWidth, panelHeight);
    ctx.strokeRect(xOffset, yOffset + thicknessVisual, panelWidth, panelHeight);

    // Top face (to show thickness)
    ctx.fillStyle = '#D2B48C';
    ctx.beginPath();
    ctx.moveTo(xOffset, yOffset + thicknessVisual);
    ctx.lineTo(xOffset + 30, yOffset);
    ctx.lineTo(xOffset + panelWidth + 30, yOffset);
    ctx.lineTo(xOffset + panelWidth, yOffset + thicknessVisual);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Right face
    ctx.fillStyle = '#A0826D';
    ctx.beginPath();
    ctx.moveTo(xOffset + panelWidth, yOffset + thicknessVisual);
    ctx.lineTo(xOffset + panelWidth + 30, yOffset);
    ctx.lineTo(xOffset + panelWidth + 30, yOffset + panelHeight - thicknessVisual);
    ctx.lineTo(xOffset + panelWidth, yOffset + panelHeight);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Add dimension labels
    ctx.fillStyle = '#2C3E50';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    
    // Width label
    ctx.fillText(`${component.width}'`, xOffset + panelWidth / 2, yOffset + panelHeight + 35);
    
    // Height label
    ctx.save();
    ctx.translate(xOffset - 25, yOffset + panelHeight / 2 + thicknessVisual);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText(`${component.height}'`, 0, 0);
    ctx.restore();

    // Grid pattern on front face
    ctx.strokeStyle = '#8B7355';
    ctx.lineWidth = 0.5;
    const gridSize = 20;
    
    for (let i = 0; i <= panelWidth / gridSize; i++) {
      const x = xOffset + i * gridSize;
      ctx.beginPath();
      ctx.moveTo(x, yOffset + thicknessVisual);
      ctx.lineTo(x, yOffset + panelHeight);
      ctx.stroke();
    }
    
    for (let i = 0; i <= panelHeight / gridSize; i++) {
      const y = yOffset + thicknessVisual + i * gridSize;
      ctx.beginPath();
      ctx.moveTo(xOffset, y);
      ctx.lineTo(xOffset + panelWidth, y);
      ctx.stroke();
    }

    // Add Daylun branding
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.font = 'bold 24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('DAYLUN', xOffset + panelWidth / 2, yOffset + panelHeight / 2 + thicknessVisual);
  };

  const handleAddToProject = () => {
    if (onAddToProject) {
      onAddToProject(selectedComponent);
    }
    // Show success message or handle integration
    alert(`${selectedComponent.name} would be added to your project. Integration with House Builder coming soon!`);
  };

  const handleDownloadSpec = () => {
    alert(`Specification sheet for ${selectedComponent.name} would be downloaded as PDF.`);
  };

  const handleView3D = () => {
    alert(`3D model viewer for ${selectedComponent.name} would open with detailed textures and materials.`);
  };

  const handleExportQuote = () => {
    const inventorySummary = getInventorySummary();
    const quoteData = {
      project: 'Blueshell Frame Quote',
      timestamp: new Date().toISOString(),
      components: inventorySummary.map(({ type, count, spec, totalCost, totalWeight }) => ({
        sku: spec?.sku || type,
        name: spec?.name || type,
        quantity: count,
        unitPrice: spec?.price || 0,
        totalPrice: totalCost,
        weight: totalWeight
      })),
      totals: {
        totalCost: getTotalCost(),
        totalWeight: getTotalWeight(),
        totalPanels: Object.values(inventory).reduce((sum, count) => sum + count, 0)
      }
    };
    
    const blob = new Blob([JSON.stringify(quoteData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'blueshell-frame-quote.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOrderMaterials = () => {
    const totalPanels = Object.values(inventory).reduce((sum, count) => sum + count, 0);
    if (totalPanels === 0) {
      alert('No panels in current design. Please add panels using the Builder above.');
      return;
    }
    
    alert(`Order request would be submitted for ${totalPanels} panels totaling $${getTotalCost().toFixed(2)}. Integration with ordering system coming soon!`);
  };

  return (
    <div className="bg-gray-100 py-8 md:py-12 px-3 md:px-6 lg:px-20">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-4xl font-extrabold text-gray-800 mb-2">Component Library</h2>
          <p className="text-lg text-gray-600">Daylun Construction Materials Catalog</p>
        </div>

        {/* Current Project Inventory */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-bold text-blue-800 mb-4 flex items-center">
            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            Current Project Inventory
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
            {getInventorySummary().map(({ type, count, spec, totalCost, totalWeight }) => (
              <div key={type} className="bg-white rounded-lg p-4 border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-800">
                    {spec?.name || type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </h4>
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded-full text-sm font-medium">
                    {count}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>Unit Price:</span>
                    <span>${spec?.price.toFixed(2) || '0.00'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Cost:</span>
                    <span className="font-medium">${totalCost.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Total Weight:</span>
                    <span>{totalWeight} lbs</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          <div className="bg-white rounded-lg p-4 border-2 border-blue-300">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex flex-col md:flex-row md:items-center gap-4">
                <div className="text-center md:text-left">
                  <div className="text-2xl font-bold text-blue-800">${getTotalCost().toFixed(2)}</div>
                  <div className="text-sm text-gray-600">Total Project Cost</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-2xl font-bold text-green-800">{getTotalWeight().toLocaleString()} lbs</div>
                  <div className="text-sm text-gray-600">Total Weight</div>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-2xl font-bold text-purple-800">
                    {Object.values(inventory).reduce((sum, count) => sum + count, 0)}
                  </div>
                  <div className="text-sm text-gray-600">Total Panels</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={handleExportQuote}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200 text-sm"
                >
                  Export Quote
                </button>
                <button 
                  onClick={handleOrderMaterials}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200 text-sm"
                >
                  Order Materials
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="flex flex-col lg:flex-row">
            
            {/* Left Panel - Component List */}
            <div className="lg:w-1/3 bg-gray-50 p-6 border-r">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Available Components</h3>
              
              <div className="space-y-2">
                {DAYLUN_COMPONENTS.map((component, index) => {
                  // Find the corresponding inventory count
                  const panelType = Object.keys(PANEL_SPECS).find(key => PANEL_SPECS[key].sku === component.sku);
                  const currentCount = panelType ? inventory[panelType as keyof typeof inventory] : 0;
                  
                  return (
                    <div
                      key={component.sku}
                      onClick={() => setSelectedComponent(component)}
                      className={`p-4 rounded-lg cursor-pointer transition-colors duration-200 ${
                        selectedComponent.sku === component.sku
                          ? 'bg-blue-100 border-2 border-blue-500'
                          : 'bg-white border-2 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-semibold text-gray-800">{component.name}</h4>
                        {currentCount > 0 && (
                          <span className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs font-medium">
                            {currentCount} in use
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">SKU: {component.sku}</p>
                      <p className="text-sm text-gray-600">Size: {component.width}' × {component.height}'</p>
                      <p className="text-sm font-medium text-green-600">${component.price.toFixed(2)}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Panel - Component Details */}
            <div className="lg:w-2/3 p-6">
              {/* Component Header */}
              <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-800">{selectedComponent.name}</h3>
                <p className="text-gray-600">SKU: {selectedComponent.sku}</p>
              </div>

              {/* Visual and Specifications */}
              <div className="flex flex-col xl:flex-row gap-6 mb-6">
                {/* 3D Model Visualization */}
                <div className="xl:w-1/2">
                  <div className="border border-gray-300 rounded bg-white overflow-hidden">
                    {selectedComponent.modelPath && !showFallback && !modelLoadError ? (
                      <div className="h-[300px] w-full relative">
                        <div 
                          onError={() => setModelLoadError(true)}
                          className="w-full h-full"
                        >
                          <Model_Preview 
                            loc={selectedComponent.modelPath}
                            customScene={null}
                            key={selectedComponent.sku}
                          />
                        </div>
                        
                        {/* Loading overlay for when model is loading */}
                        <div className="absolute top-2 right-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
                          3D Model
                        </div>
                      </div>
                    ) : (
                      <div>
                        <canvas
                          ref={canvasRef}
                          width={400}
                          height={300}
                          className="w-full"
                          style={{ maxWidth: '400px', height: 'auto', aspectRatio: '4/3' }}
                        />
                        {selectedComponent.modelPath && modelLoadError && (
                          <div className="p-2 bg-red-50 text-red-800 text-xs text-center">
                            3D model failed to load - showing technical drawing
                            <button 
                              onClick={() => {
                                setModelLoadError(false);
                                setShowFallback(false);
                              }}
                              className="ml-2 text-blue-600 underline"
                            >
                              Retry 3D Model
                            </button>
                          </div>
                        )}
                        {!selectedComponent.modelPath && (
                          <div className="p-2 bg-blue-50 text-blue-800 text-xs text-center">
                            Technical drawing view - 3D model coming soon
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Model Controls */}
                  <div className="mt-2 text-center">
                    <div className="flex justify-center gap-2">
                      {selectedComponent.modelPath && (
                        <button
                          onClick={() => setShowFallback(!showFallback)}
                          className="text-xs bg-gray-200 hover:bg-gray-300 px-2 py-1 rounded"
                        >
                          {showFallback || modelLoadError ? "Show 3D Model" : "Show 2D View"}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {showFallback || modelLoadError ? "2D Technical Drawing" : "Interactive 3D Model - Click and drag to rotate"}
                    </p>
                  </div>
                </div>

                {/* Specifications */}
                <div className="xl:w-1/2">
                  <h4 className="text-lg font-semibold text-gray-800 mb-3">Specifications</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium">Dimensions:</span>
                      <span>{selectedComponent.width}' × {selectedComponent.height}' × {selectedComponent.thickness}"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Material:</span>
                      <span>{selectedComponent.material}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Weight:</span>
                      <span>{selectedComponent.weight} lbs</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">R-Value:</span>
                      <span>R-{selectedComponent.insulationRValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Fire Rating:</span>
                      <span>{selectedComponent.fireRating}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium">Price:</span>
                      <span className="text-green-600 font-semibold">${selectedComponent.price.toFixed(2)} per panel</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Description */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Description</h4>
                <p className="text-gray-700">{selectedComponent.description}</p>
              </div>

              {/* Features */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Key Features</h4>
                <ul className="space-y-1">
                  {selectedComponent.features.map((feature, index) => (
                    <li key={index} className="text-gray-700 text-sm">• {feature}</li>
                  ))}
                </ul>
              </div>

              {/* Applications */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-800 mb-2">Applications</h4>
                <p className="text-gray-700 text-sm">{selectedComponent.applications.join(', ')}</p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={handleAddToProject}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors duration-200"
                >
                  Add to Project
                </button>
                <button
                  onClick={handleDownloadSpec}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors duration-200"
                >
                  Download Spec Sheet
                </button>
                <button
                  onClick={handleView3D}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors duration-200"
                >
                  View 3D Model
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-6 text-center">
          <div className="flex flex-wrap justify-center gap-4">
            <button className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700 transition-colors duration-200">
              Export Catalog (PDF)
            </button>
            <button className="bg-orange-600 text-white px-6 py-2 rounded-lg hover:bg-orange-700 transition-colors duration-200">
              Request Quote
            </button>
            <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition-colors duration-200">
              Technical Specs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
