# House Builder 3D

An interactive 3D house building tool with real-time visualization.
A live deployment is available at https://spur-amp.vercel.app/.

## About

This is a comprehensive House Builder application. Features include:

- **Interactive House Builder**: A comprehensive 2D/3D house design interface
- **Multiple Floor Support**: Build multi-story structures
- **Component Library**: Walls, doors, windows, and floor panels
- **3D Model Preview**: Real-time 3D visualization of your designs
- **Export Functionality**: Save and load your projects

## Key Features

- 🏗️ **Grid-based Building System**: Snap-to-grid component placement
- 🎨 **Component Types**: Walls, doors, windows, and floor panels
- 📐 **Isometric 3D Preview**: Real-time 3D visualization
- 💾 **Project Save/Load**: JSON-based project serialization
- 🏢 **Multi-floor Support**: Create complex multi-story buildings
- 📱 **Responsive Design**: Works on desktop and mobile

## Technologies Used

- **Next.js 15** - React framework
- **TypeScript** - Type safety
- **Three.js** (via @react-three/fiber) - 3D visualization
- **Tailwind CSS** - Styling
- **Canvas API** - 2D drawing for the builder interface


## How to Use

1. **Select Component**: Choose from wall, door, window, or floor panels
2. **Click to Place**: Click on the grid to place components
3. **Right-click to Remove**: Right-click to remove placed components
4. **Manage Floors**: Add/remove floors and switch between them
5. **Tools**: Use "Fill Walls" to create perimeter walls or "Clear Floor" to reset
6. **3D Preview**: View your creation in the 3D model preview panel

## Project Structure

```
app/
├── HouseBuilder/           # Main House Builder page
│   └── components/         # House Builder components
├── components/             # Shared components (Header, Footer)
├── JS_Scripts/            # Utility scripts
└── globals.css            # Global styles

public/
├── models/                # 3D model assets
└── [images]              # Essential image assets
```

## Features in Detail

### Building System
- **Grid-based placement**: Components snap to a grid for precise positioning
- **Multiple component types**: Walls, doors, windows, and floor panels
- **Rotation support**: Components can be rotated for flexible design

### Visualization
- **2D Grid View**: Top-down view of the current floor
- **Isometric 3D View**: 3D perspective showing all floors
- **Real-time updates**: Changes appear immediately in both views

### Project Management
- **Save/Load**: Export projects as JSON files
- **Multi-floor support**: Create buildings with multiple levels
- **Manufacturing export**: Generate data for construction purposes

---

**© 2025 House Builder 3D - Interactive Building Design Tool** 
