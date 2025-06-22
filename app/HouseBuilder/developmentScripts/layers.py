import tkinter as tk
from tkinter import ttk, messagebox, filedialog
import json
import math
from enum import Enum
from dataclasses import dataclass, asdict
from typing import List, Dict, Tuple, Optional


# Component types
class ComponentType(Enum):
    WALL_PANEL = "wall_panel"
    DOOR_PANEL = "door_panel"
    WINDOW_PANEL = "window_panel"
    FLOOR_PANEL = "floor_panel"
    EMPTY = "empty"


# Component colors for visualization
COMPONENT_COLORS = {
    ComponentType.WALL_PANEL: "#8B4513",
    ComponentType.DOOR_PANEL: "#654321",
    ComponentType.WINDOW_PANEL: "#87CEEB",
    ComponentType.FLOOR_PANEL: "#D2691E",
    ComponentType.EMPTY: "#F0F0F0"
}


@dataclass
class Component:
    type: ComponentType
    x: int
    y: int
    rotation: int = 0  # 0, 90, 180, 270 degrees

    def to_dict(self):
        return {
            'type': self.type.value,
            'x': self.x,
            'y': self.y,
            'rotation': self.rotation
        }

    @classmethod
    def from_dict(cls, data):
        return cls(
            type=ComponentType(data['type']),
            x=data['x'],
            y=data['y'],
            rotation=data.get('rotation', 0)
        )


class Floor:
    def __init__(self, floor_number: int, width: int = 10, height: int = 10):
        self.floor_number = floor_number
        self.width = width
        self.height = height
        self.components: Dict[Tuple[int, int], Component] = {}

    def add_component(self, component: Component):
        self.components[(component.x, component.y)] = component

    def remove_component(self, x: int, y: int):
        if (x, y) in self.components:
            del self.components[(x, y)]

    def get_component(self, x: int, y: int) -> Optional[Component]:
        return self.components.get((x, y))

    def to_dict(self):
        return {
            'floor_number': self.floor_number,
            'width': self.width,
            'height': self.height,
            'components': [comp.to_dict() for comp in self.components.values()]
        }

    @classmethod
    def from_dict(cls, data):
        floor = cls(data['floor_number'], data['width'], data['height'])
        for comp_data in data['components']:
            comp = Component.from_dict(comp_data)
            floor.add_component(comp)
        return floor


class House:
    def __init__(self):
        self.floors: List[Floor] = [Floor(0)]  # Start with ground floor
        self.current_floor_index = 0

    def add_floor(self):
        new_floor_number = len(self.floors)
        self.floors.append(Floor(new_floor_number))

    def remove_floor(self, index: int):
        if len(self.floors) > 1 and 0 <= index < len(self.floors):
            self.floors.pop(index)
            # Renumber floors
            for i, floor in enumerate(self.floors):
                floor.floor_number = i

    def get_current_floor(self) -> Floor:
        return self.floors[self.current_floor_index]

    def to_dict(self):
        return {
            'floors': [floor.to_dict() for floor in self.floors],
            'current_floor_index': self.current_floor_index
        }

    @classmethod
    def from_dict(cls, data):
        house = cls()
        house.floors = [Floor.from_dict(floor_data) for floor_data in data['floors']]
        house.current_floor_index = data['current_floor_index']
        return house


class HouseBuilderApp:
    def __init__(self, root):
        self.root = root
        self.root.title("House Builder 3D")
        self.root.geometry("1400x900")

        # Apply native theme
        self.setup_theme()

        # Initialize house
        self.house = House()
        self.selected_component_type = ComponentType.WALL_PANEL
        self.grid_size = 40  # Pixels per grid unit
        self.panel_size = 8  # 8x8 panels

        # Create UI
        self.setup_ui()
        self.update_floor_view()
        self.update_3d_preview()

    def setup_theme(self):
        """Configure ttk theme to use native desktop style"""
        style = ttk.Style()

        # Get available themes
        available_themes = style.theme_names()

        # Platform-specific theme selection
        import platform
        system = platform.system()

        if system == "Windows":
            # Windows themes
            if "vista" in available_themes:
                style.theme_use("vista")
            elif "winnative" in available_themes:
                style.theme_use("winnative")
        elif system == "Darwin":  # macOS
            if "aqua" in available_themes:
                style.theme_use("aqua")
        else:  # Linux and others
            if "clam" in available_themes:
                style.theme_use("clam")
            elif "alt" in available_themes:
                style.theme_use("alt")

        # Custom style configurations
        style.configure("Title.TLabel", font=('Arial', 12, 'bold'))
        style.configure("TLabelframe.Label", font=('Arial', 10, 'bold'))

    def setup_ui(self):
        # Main container
        main_container = ttk.Frame(self.root)
        main_container.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)

        # Left panel - Controls
        left_panel = ttk.Frame(main_container, width=300)
        left_panel.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        left_panel.pack_propagate(False)

        # Floor controls
        floor_frame = ttk.LabelFrame(left_panel, text="Floor Management")
        floor_frame.pack(fill=tk.X, pady=(0, 10))

        self.floor_var = tk.StringVar(value="Floor 0")
        self.floor_combo = ttk.Combobox(floor_frame, textvariable=self.floor_var, state="readonly")
        self.floor_combo.pack(fill=tk.X, padx=5, pady=5)
        self.floor_combo.bind("<<ComboboxSelected>>", self.on_floor_changed)
        self.update_floor_list()

        floor_btn_frame = ttk.Frame(floor_frame)
        floor_btn_frame.pack(fill=tk.X, padx=5, pady=5)

        ttk.Button(floor_btn_frame, text="Add Floor", command=self.add_floor).pack(side=tk.LEFT, padx=2)
        ttk.Button(floor_btn_frame, text="Remove Floor", command=self.remove_floor).pack(side=tk.LEFT, padx=2)

        # Component palette
        component_frame = ttk.LabelFrame(left_panel, text="Components")
        component_frame.pack(fill=tk.X, pady=(0, 10))

        for comp_type in ComponentType:
            if comp_type != ComponentType.EMPTY:
                btn = ttk.Radiobutton(
                    component_frame,
                    text=comp_type.value.replace('_', ' ').title(),
                    value=comp_type.value,
                    command=lambda ct=comp_type: self.select_component(ct)
                )
                btn.pack(anchor=tk.W, padx=5, pady=2)
                if comp_type == ComponentType.WALL_PANEL:
                    btn.invoke()

        # Tools
        tools_frame = ttk.LabelFrame(left_panel, text="Tools")
        tools_frame.pack(fill=tk.X, pady=(0, 10))

        ttk.Button(tools_frame, text="Clear Floor", command=self.clear_floor).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(tools_frame, text="Fill Walls", command=self.fill_walls).pack(fill=tk.X, padx=5, pady=2)

        # File operations
        file_frame = ttk.LabelFrame(left_panel, text="File Operations")
        file_frame.pack(fill=tk.X, pady=(0, 10))

        ttk.Button(file_frame, text="Save Project", command=self.save_project).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(file_frame, text="Load Project", command=self.load_project).pack(fill=tk.X, padx=5, pady=2)
        ttk.Button(file_frame, text="Export to Manufacturing", command=self.export_to_manufacturing).pack(fill=tk.X,
                                                                                                          padx=5,
                                                                                                          pady=2)

        # Middle panel - 2D Grid View
        middle_panel = ttk.Frame(main_container)
        middle_panel.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))

        grid_label = ttk.Label(middle_panel, text="2D Floor Plan", style="Title.TLabel")
        grid_label.pack()

        # Canvas for grid
        canvas_frame = ttk.Frame(middle_panel, relief=tk.SUNKEN, borderwidth=2)
        canvas_frame.pack(fill=tk.BOTH, expand=True)

        self.grid_canvas = tk.Canvas(canvas_frame, bg='white')
        self.grid_canvas.pack(fill=tk.BOTH, expand=True)

        # Scrollbars
        h_scrollbar = ttk.Scrollbar(canvas_frame, orient=tk.HORIZONTAL, command=self.grid_canvas.xview)
        h_scrollbar.pack(side=tk.BOTTOM, fill=tk.X)
        v_scrollbar = ttk.Scrollbar(canvas_frame, orient=tk.VERTICAL, command=self.grid_canvas.yview)
        v_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.grid_canvas.configure(xscrollcommand=h_scrollbar.set, yscrollcommand=v_scrollbar.set)

        # Bind mouse events
        self.grid_canvas.bind("<Button-1>", self.on_grid_click)
        self.grid_canvas.bind("<B1-Motion>", self.on_grid_drag)
        self.grid_canvas.bind("<Button-3>", self.on_grid_right_click)

        # Right panel - 3D Preview
        right_panel = ttk.Frame(main_container, width=400)
        right_panel.pack(side=tk.RIGHT, fill=tk.Y)
        right_panel.pack_propagate(False)

        preview_label = ttk.Label(right_panel, text="3D Preview (Isometric)", font=('Arial', 12, 'bold'))
        preview_label.pack()

        self.preview_canvas = tk.Canvas(right_panel, bg='#E0E0E0', width=380, height=600)
        self.preview_canvas.pack(padx=10, pady=10)

        # Status bar
        
        self.status_var = tk.StringVar(value="Ready")
        status_bar = ttk.Label(self.root, textvariable=self.status_var, relief=tk.SUNKEN)
        status_bar.pack(side=tk.BOTTOM, fill=tk.X)

    def select_component(self, component_type: ComponentType):
        self.selected_component_type = component_type
        self.status_var.set(f"Selected: {component_type.value.replace('_', ' ').title()}")

    def update_floor_list(self):
        floor_names = [f"Floor {i}" for i in range(len(self.house.floors))]
        self.floor_combo['values'] = floor_names
        self.floor_var.set(f"Floor {self.house.current_floor_index}")

    def on_floor_changed(self, event):
        index = self.floor_combo.current()
        self.house.current_floor_index = index
        self.update_floor_view()
        self.update_3d_preview()

    def add_floor(self):
        self.house.add_floor()
        self.update_floor_list()
        self.house.current_floor_index = len(self.house.floors) - 1
        self.floor_combo.current(self.house.current_floor_index)
        self.update_floor_view()
        self.update_3d_preview()
        self.status_var.set(f"Added Floor {self.house.current_floor_index}")

    def remove_floor(self):
        if len(self.house.floors) > 1:
            self.house.remove_floor(self.house.current_floor_index)
            self.house.current_floor_index = min(self.house.current_floor_index, len(self.house.floors) - 1)
            self.update_floor_list()
            self.update_floor_view()
            self.update_3d_preview()
            self.status_var.set("Removed floor")
        else:
            messagebox.showwarning("Cannot Remove", "Must have at least one floor")

    def clear_floor(self):
        floor = self.house.get_current_floor()
        floor.components.clear()
        self.update_floor_view()
        self.update_3d_preview()
        self.status_var.set("Cleared floor")

    def fill_walls(self):
        floor = self.house.get_current_floor()
        # Fill perimeter with walls
        for x in range(floor.width):
            floor.add_component(Component(ComponentType.WALL_PANEL, x, 0))
            floor.add_component(Component(ComponentType.WALL_PANEL, x, floor.height - 1))
        for y in range(1, floor.height - 1):
            floor.add_component(Component(ComponentType.WALL_PANEL, 0, y))
            floor.add_component(Component(ComponentType.WALL_PANEL, floor.width - 1, y))
        self.update_floor_view()
        self.update_3d_preview()
        self.status_var.set("Added perimeter walls")

    def update_floor_view(self):
        self.grid_canvas.delete("all")
        floor = self.house.get_current_floor()

        # Draw grid
        for x in range(floor.width + 1):
            x_pos = x * self.grid_size
            self.grid_canvas.create_line(x_pos, 0, x_pos, floor.height * self.grid_size, fill='gray', width=1)

        for y in range(floor.height + 1):
            y_pos = y * self.grid_size
            self.grid_canvas.create_line(0, y_pos, floor.width * self.grid_size, y_pos, fill='gray', width=1)

        # Draw components
        for (x, y), component in floor.components.items():
            self.draw_component(x, y, component)

        # Update scroll region
        self.grid_canvas.configure(scrollregion=self.grid_canvas.bbox("all"))

    def draw_component(self, x: int, y: int, component: Component):
        x1 = x * self.grid_size
        y1 = y * self.grid_size
        x2 = x1 + self.grid_size
        y2 = y1 + self.grid_size

        color = COMPONENT_COLORS[component.type]

        # Draw base rectangle
        rect = self.grid_canvas.create_rectangle(x1, y1, x2, y2, fill=color, outline='black', width=2)

        # Draw component-specific details
        if component.type == ComponentType.DOOR_PANEL:
            # Draw door swing
            self.grid_canvas.create_arc(x1, y1, x2, y2, start=0, extent=90, outline='white', width=2, style=tk.ARC)
        elif component.type == ComponentType.WINDOW_PANEL:
            # Draw window cross
            self.grid_canvas.create_line(x1 + self.grid_size / 2, y1, x1 + self.grid_size / 2, y2, fill='white',
                                         width=2)
            self.grid_canvas.create_line(x1, y1 + self.grid_size / 2, x2, y1 + self.grid_size / 2, fill='white',
                                         width=2)
        elif component.type == ComponentType.FLOOR_PANEL:
            # Draw floor tile pattern
            margin = 4
            # Draw diagonal lines for tile pattern
            self.grid_canvas.create_line(x1 + margin, y1 + margin, x2 - margin, y2 - margin, fill='#8B6914', width=1)
            self.grid_canvas.create_line(x1 + margin, y2 - margin, x2 - margin, y1 + margin, fill='#8B6914', width=1)

    def on_grid_click(self, event):
        x = event.x // self.grid_size
        y = event.y // self.grid_size
        floor = self.house.get_current_floor()

        if 0 <= x < floor.width and 0 <= y < floor.height:
            component = Component(self.selected_component_type, x, y)
            floor.add_component(component)
            self.update_floor_view()
            self.update_3d_preview()
            self.status_var.set(f"Placed {self.selected_component_type.value} at ({x}, {y})")

    def on_grid_drag(self, event):
        # Allow dragging to place multiple components
        self.on_grid_click(event)

    def on_grid_right_click(self, event):
        x = event.x // self.grid_size
        y = event.y // self.grid_size
        floor = self.house.get_current_floor()

        if 0 <= x < floor.width and 0 <= y < floor.height:
            floor.remove_component(x, y)
            self.update_floor_view()
            self.update_3d_preview()
            self.status_var.set(f"Removed component at ({x}, {y})")

    def update_3d_preview(self):
        self.preview_canvas.delete("all")

        # Isometric projection parameters
        iso_x = 0.866  # cos(30°)
        iso_y = 0.5  # sin(30°)
        scale = 20
        offset_x = 200
        offset_y = 400
        floor_height = 3  # Height of each floor in grid units

        # Draw floors from bottom to top
        for floor_idx, floor in enumerate(self.house.floors):
            z_offset = floor_idx * floor_height * scale

            # Draw floor plate
            if floor_idx == 0:  # Ground floor
                points = self.iso_project_rect(0, 0, floor.width, floor.height, z_offset, scale, offset_x, offset_y)
                self.preview_canvas.create_polygon(points, fill='#C0C0C0', outline='black')

            # Draw components
            for (x, y), component in floor.components.items():
                if component.type == ComponentType.WALL_PANEL:
                    # Draw 3D wall
                    self.draw_iso_wall(x, y, z_offset, scale, offset_x, offset_y,
                                       floor_idx == self.house.current_floor_index)
                elif component.type == ComponentType.DOOR_PANEL:
                    # Draw door (shorter wall)
                    self.draw_iso_door(x, y, z_offset, scale, offset_x, offset_y,
                                       floor_idx == self.house.current_floor_index)
                elif component.type == ComponentType.WINDOW_PANEL:
                    # Draw window (wall with hole)
                    self.draw_iso_window(x, y, z_offset, scale, offset_x, offset_y,
                                         floor_idx == self.house.current_floor_index)
                elif component.type == ComponentType.FLOOR_PANEL:
                    # Draw floor tile
                    self.draw_iso_floor(x, y, z_offset, scale, offset_x, offset_y,
                                        floor_idx == self.house.current_floor_index)

            # Draw ceiling/next floor
            if floor_idx < len(self.house.floors) - 1:
                z_offset_ceiling = (floor_idx + 1) * floor_height * scale
                points = self.iso_project_rect(0, 0, floor.width, floor.height, z_offset_ceiling, scale, offset_x,
                                               offset_y)
                self.preview_canvas.create_polygon(points, fill='#E0E0E0', outline='black', stipple='gray50')

    def iso_project(self, x, y, z, scale, offset_x, offset_y):
        """Convert 3D coordinates to 2D isometric projection"""
        iso_x = 0.866
        iso_y = 0.5

        screen_x = offset_x + (x - y) * iso_x * scale
        screen_y = offset_y - (x + y) * iso_y * scale - z

        return screen_x, screen_y

    def iso_project_rect(self, x, y, width, height, z, scale, offset_x, offset_y):
        """Project a rectangle in 3D space"""
        p1 = self.iso_project(x, y, z, scale, offset_x, offset_y)
        p2 = self.iso_project(x + width, y, z, scale, offset_x, offset_y)
        p3 = self.iso_project(x + width, y + height, z, scale, offset_x, offset_y)
        p4 = self.iso_project(x, y + height, z, scale, offset_x, offset_y)
        return [p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]]

    def draw_iso_wall(self, x, y, z_base, scale, offset_x, offset_y, is_current_floor):
        wall_height = 3 * scale
        color = '#8B4513' if is_current_floor else '#A0826D'

        # Wall faces
        # Front face
        p1 = self.iso_project(x, y, z_base, scale, offset_x, offset_y)
        p2 = self.iso_project(x + 1, y, z_base, scale, offset_x, offset_y)
        p3 = self.iso_project(x + 1, y, z_base + wall_height, scale, offset_x, offset_y)
        p4 = self.iso_project(x, y, z_base + wall_height, scale, offset_x, offset_y)
        self.preview_canvas.create_polygon([p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]],
                                           fill=color, outline='black')

        # Right face
        p5 = self.iso_project(x + 1, y + 1, z_base, scale, offset_x, offset_y)
        p6 = self.iso_project(x + 1, y + 1, z_base + wall_height, scale, offset_x, offset_y)
        self.preview_canvas.create_polygon([p2[0], p2[1], p5[0], p5[1], p6[0], p6[1], p3[0], p3[1]],
                                           fill=color, outline='black')

        # Top face
        p7 = self.iso_project(x, y + 1, z_base + wall_height, scale, offset_x, offset_y)
        self.preview_canvas.create_polygon([p4[0], p4[1], p3[0], p3[1], p6[0], p6[1], p7[0], p7[1]],
                                           fill='#6B3410', outline='black')

    def draw_iso_door(self, x, y, z_base, scale, offset_x, offset_y, is_current_floor):
        door_height = 2.5 * scale
        color = '#654321' if is_current_floor else '#806040'

        # Similar to wall but shorter
        p1 = self.iso_project(x, y, z_base, scale, offset_x, offset_y)
        p2 = self.iso_project(x + 1, y, z_base, scale, offset_x, offset_y)
        p3 = self.iso_project(x + 1, y, z_base + door_height, scale, offset_x, offset_y)
        p4 = self.iso_project(x, y, z_base + door_height, scale, offset_x, offset_y)
        self.preview_canvas.create_polygon([p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]],
                                           fill=color, outline='black')

    def draw_iso_window(self, x, y, z_base, scale, offset_x, offset_y, is_current_floor):
        wall_height = 3 * scale
        window_bottom = 1 * scale
        window_top = 2.5 * scale
        color = '#8B4513' if is_current_floor else '#A0826D'

        # Draw wall with window hole
        p1 = self.iso_project(x, y, z_base, scale, offset_x, offset_y)
        p2 = self.iso_project(x + 1, y, z_base, scale, offset_x, offset_y)
        p3 = self.iso_project(x + 1, y, z_base + wall_height, scale, offset_x, offset_y)
        p4 = self.iso_project(x, y, z_base + wall_height, scale, offset_x, offset_y)

        # Bottom part
        p5 = self.iso_project(x, y, z_base + window_bottom, scale, offset_x, offset_y)
        p6 = self.iso_project(x + 1, y, z_base + window_bottom, scale, offset_x, offset_y)
        self.preview_canvas.create_polygon([p1[0], p1[1], p2[0], p2[1], p6[0], p6[1], p5[0], p5[1]],
                                           fill=color, outline='black')

        # Top part
        p7 = self.iso_project(x, y, z_base + window_top, scale, offset_x, offset_y)
        p8 = self.iso_project(x + 1, y, z_base + window_top, scale, offset_x, offset_y)
        self.preview_canvas.create_polygon([p7[0], p7[1], p8[0], p8[1], p3[0], p3[1], p4[0], p4[1]],
                                           fill=color, outline='black')

        # Window glass
        self.preview_canvas.create_polygon([p5[0], p5[1], p6[0], p6[1], p8[0], p8[1], p7[0], p7[1]],
                                           fill='#87CEEB', outline='black', stipple='gray25')

    def draw_iso_floor(self, x, y, z_base, scale, offset_x, offset_y, is_current_floor):
        """Draw floor panel in 3D view"""
        floor_thickness = 0.2 * scale
        color = '#D2691E' if is_current_floor else '#C8B88B'

        # Top surface of floor panel
        p1 = self.iso_project(x, y, z_base + floor_thickness, scale, offset_x, offset_y)
        p2 = self.iso_project(x + 1, y, z_base + floor_thickness, scale, offset_x, offset_y)
        p3 = self.iso_project(x + 1, y + 1, z_base + floor_thickness, scale, offset_x, offset_y)
        p4 = self.iso_project(x, y + 1, z_base + floor_thickness, scale, offset_x, offset_y)

        # Draw top surface
        self.preview_canvas.create_polygon([p1[0], p1[1], p2[0], p2[1], p3[0], p3[1], p4[0], p4[1]],
                                           fill=color, outline='black', width=1)

        # Draw tile pattern
        mid_x = (p1[0] + p3[0]) / 2
        mid_y = (p1[1] + p3[1]) / 2
        self.preview_canvas.create_line(p1[0], p1[1], p3[0], p3[1], fill='#8B6914', width=1)
        self.preview_canvas.create_line(p2[0], p2[1], p4[0], p4[1], fill='#8B6914', width=1)

    def save_project(self):
        filename = filedialog.asksaveasfilename(
            defaultextension=".json",
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if filename:
            with open(filename, 'w') as f:
                json.dump(self.house.to_dict(), f, indent=2)
            self.status_var.set(f"Saved project to {filename}")

    def load_project(self):
        filename = filedialog.askopenfilename(
            filetypes=[("JSON files", "*.json"), ("All files", "*.*")]
        )
        if filename:
            with open(filename, 'r') as f:
                data = json.load(f)
            self.house = House.from_dict(data)
            self.update_floor_list()
            self.update_floor_view()
            self.update_3d_preview()
            self.status_var.set(f"Loaded project from {filename}")

    def export_to_manufacturing(self):
        """Export house design to manufacturing specifications"""
        filename = filedialog.asksaveasfilename(
            defaultextension=".mfg",
            filetypes=[("Manufacturing files", "*.mfg"), ("All files", "*.*")]
        )
        if filename:
            # Generate manufacturing data
            mfg_data = {
                'version': '1.0',
                'project': 'House Builder Project',
                'panel_size': self.panel_size,
                'components': []
            }

            # Count components
            component_counts = {}
            for floor in self.house.floors:
                for component in floor.components.values():
                    key = component.type.value
                    component_counts[key] = component_counts.get(key, 0) + 1

            # Generate component list with specifications
            for comp_type, count in component_counts.items():
                mfg_data['components'].append({
                    'type': comp_type,
                    'quantity': count,
                    'dimensions': f"{self.panel_size}x{self.panel_size}",
                    'material': 'standard_panel',
                    'operations': ['cut', 'drill_mounting_holes', 'edge_finish']
                })

            # Add assembly information
            mfg_data['assembly'] = {
                'floors': len(self.house.floors),
                'total_components': sum(component_counts.values()),
                'floor_area': self.house.floors[0].width * self.house.floors[
                    0].height * self.panel_size * self.panel_size
            }

            # Save manufacturing data
            with open(filename, 'w') as f:
                json.dump(mfg_data, f, indent=2)

            # Also generate a simple G-code template
            gcode_filename = filename.replace('.mfg', '.gcode')
            self.generate_sample_gcode(gcode_filename, mfg_data)

            self.status_var.set(f"Exported manufacturing specs to {filename}")
            messagebox.showinfo("Export Complete",
                                f"Manufacturing specifications exported to:\n{filename}\n\n"
                                f"Sample G-code template generated at:\n{gcode_filename}")

    def generate_sample_gcode(self, filename, mfg_data):
        """Generate a sample G-code template for panel cutting"""
        with open(filename, 'w') as f:
            f.write("; House Builder 3D - G-code Template\n")
            f.write("; Generated for panel cutting operations\n")
            f.write(f"; Panel size: {self.panel_size}x{self.panel_size} units\n\n")

            f.write("; Initialize\n")
            f.write("G21 ; Set units to millimeters\n")
            f.write("G90 ; Absolute positioning\n")
            f.write("G0 Z5.0 ; Lift Z\n")
            f.write("M3 S12000 ; Start spindle\n\n")

            # Generate cutting operations for each component type
            panel_size_mm = self.panel_size * 100  # Convert to mm (assuming 1 unit = 100mm)

            for component in mfg_data['components']:
                f.write(f"; Cutting {component['quantity']} x {component['type']}\n")
                f.write(f"; Panel dimensions: {panel_size_mm}x{panel_size_mm}mm\n")

                # Simple rectangular cut
                f.write("G0 X0 Y0 ; Move to start\n")
                f.write("G0 Z1.0 ; Lower to cutting height\n")
                f.write(f"G1 X{panel_size_mm} Y0 F1000 ; Cut edge 1\n")
                f.write(f"G1 X{panel_size_mm} Y{panel_size_mm} F1000 ; Cut edge 2\n")
                f.write(f"G1 X0 Y{panel_size_mm} F1000 ; Cut edge 3\n")
                f.write("G1 X0 Y0 F1000 ; Cut edge 4\n")
                f.write("G0 Z5.0 ; Lift Z\n\n")

                # Add component-specific operations
                if component['type'] == 'door_panel':
                    f.write("; Door cutout\n")
                    f.write("G0 X100 Y100 ; Move to door cutout start\n")
                    f.write("; ... door cutout operations ...\n\n")
                elif component['type'] == 'window_panel':
                    f.write("; Window cutout\n")
                    f.write("G0 X200 Y300 ; Move to window cutout start\n")
                    f.write("; ... window cutout operations ...\n\n")

            f.write("; Finish\n")
            f.write("M5 ; Stop spindle\n")
            f.write("G0 Z50 ; Lift Z to safe height\n")
            f.write("G0 X0 Y0 ; Return to home\n")
            f.write("M30 ; End program\n")


if __name__ == "__main__":
    root = tk.Tk()
    app = HouseBuilderApp(root)
    root.mainloop()