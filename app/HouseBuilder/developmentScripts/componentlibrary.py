import tkinter as tk
from tkinter import ttk, Canvas, Frame
import tkinter.font as tkFont
from dataclasses import dataclass
from typing import List, Dict, Optional
import json


@dataclass
class ComponentSpec:
    """Specification for a Daylun component"""
    sku: str
    name: str
    category: str
    width: float  # in feet
    height: float  # in feet
    thickness: float  # in inches
    material: str
    weight: float  # in lbs
    price: float
    description: str
    features: List[str]
    applications: List[str]
    fire_rating: str
    insulation_r_value: float
    color: str = "#8B4513"  # Default brown


class ComponentLibraryApp:
    def __init__(self, root):
        self.root = root
        self.root.title("Daylun Component Library - Construction Materials Catalog")
        self.root.geometry("1200x800")
        self.root.minsize(1000, 600)

        # Apply theme
        self.setup_theme()

        # Initialize component data
        self.components = self.load_components()
        self.selected_component = None

        # Create UI
        self.setup_ui()

        # Display first component
        if self.components:
            self.display_component(self.components[0])

    def setup_theme(self):
        """Configure ttk theme"""
        style = ttk.Style()

        # Try to use a nice theme
        available_themes = style.theme_names()
        for theme in ["clam", "alt", "default"]:
            if theme in available_themes:
                style.theme_use(theme)
                break

        # Configure styles
        default_font = tkFont.nametofont("TkDefaultFont")
        default_font.configure(size=10)

        title_font = tkFont.Font(family=default_font['family'], size=16, weight='bold')
        header_font = tkFont.Font(family=default_font['family'], size=12, weight='bold')

        style.configure("Title.TLabel", font=title_font, foreground='#2C3E50')
        style.configure("Header.TLabel", font=header_font, foreground='#34495E')
        style.configure("Info.TLabel", font=default_font, foreground='#555555')

        # Configure frame styles
        style.configure("Card.TFrame", background='white', relief='raised', borderwidth=2)
        style.configure("TButton", padding=(10, 5))

        self.root.configure(bg='#ECF0F1')

    def load_components(self) -> List[ComponentSpec]:
        """Load Daylun component specifications"""
        components = [
            # Hotfix
            ComponentSpec(
                sku="DLN-PNL-4X8-STD",
                name="Daylun Standard Panel 4×8 ",
                category="Wall Panel",
                width=4.0,
                height=8.0,
                thickness=0,
                material="",
                weight=0,
                price=0,
                description="",
                features=[
                    # "Pre-fabricated with precision CNC cutting",
                    # "Integrated electrical chase channels",
                    # "Tongue-and-groove edge connections",
                    # "Weather-resistant OSB facing",
                    # "EPS foam core insulation",
                    # "Ready for immediate installation"
                ],
                applications=[
                    "Exterior walls",
                    "Interior partitions",
                    "Roof panels",
                    "Floor systems"
                ],
                fire_rating="",
                insulation_r_value=0,
                color="#A0522D"
            ),
            ComponentSpec(
                sku="DLN-PNL-8X8-PRO",
                name="Daylun Professional Panel 8×8",
                category="Wall Panel",
                width=8.0,
                height=8.0,
                thickness=0,
                material="",
                weight=0,
                price=0,
                description="Large-format 8×8 panel.",
                features=[
                    # "Heavy-duty construction for commercial use",
                    # "Reinforced corner connections",
                    # "Dual electrical/plumbing chase system",
                    # "Premium weather barrier coating",
                    # "High-density polyurethane foam core",
                    # "Integrated lifting points for crane installation",
                    # "Factory-applied primer coating"
                ],
                applications=[
                    "Commercial buildings",
                    "Warehouse construction",
                    "Multi-family residential",
                    "Institutional facilities",
                    "Agricultural buildings"
                ],
                fire_rating="",
                insulation_r_value=0,
                color="#8B4513"
            )
        ]
        return components

    def setup_ui(self):
        # Main container
        main_container = ttk.Frame(self.root, padding="10")
        main_container.pack(fill=tk.BOTH, expand=True)

        # Header
        header_frame = ttk.Frame(main_container)
        header_frame.pack(fill=tk.X, pady=(0, 20))

        # Hotfix
        logo_label = ttk.Label(header_frame, text="", style="Title.TLabel", foreground='#2C3E50')
        logo_label.pack(side=tk.LEFT)

        subtitle_label = ttk.Label(header_frame, text="Component Library", font=('Arial', 12), foreground='#7F8C8D')
        subtitle_label.pack(side=tk.LEFT, padx=(10, 0))

        # Content area with two columns
        content_frame = ttk.Frame(main_container)
        content_frame.pack(fill=tk.BOTH, expand=True)

        # Left column - Component list
        left_frame = ttk.Frame(content_frame, width=300)
        left_frame.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        left_frame.pack_propagate(False)

        list_label = ttk.Label(left_frame, text="Available Components", style="Header.TLabel")
        list_label.pack(pady=(0, 10))

        # Component listbox with scrollbar
        list_container = ttk.Frame(left_frame)
        list_container.pack(fill=tk.BOTH, expand=True)

        scrollbar = ttk.Scrollbar(list_container)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.component_listbox = tk.Listbox(list_container, yscrollcommand=scrollbar.set,
                                            font=('Arial', 10), height=15,
                                            selectmode=tk.SINGLE,
                                            activestyle='none',
                                            highlightthickness=0,
                                            relief=tk.FLAT,
                                            bg='white',
                                            selectbackground='#3498DB',
                                            selectforeground='white')
        self.component_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.component_listbox.yview)

        # Populate list
        for component in self.components:
            display_text = f"{component.name}  SKU: {component.sku}  Size: {component.width}' × {component.height}'"
            self.component_listbox.insert(tk.END, display_text)

        self.component_listbox.bind('<<ListboxSelect>>', self.on_component_select)

        # Right column - Component details
        self.detail_frame = ttk.Frame(content_frame, style="Card.TFrame")
        self.detail_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # Component detail container
        self.detail_container = ttk.Frame(self.detail_frame, padding="20")
        self.detail_container.pack(fill=tk.BOTH, expand=True)

        # Footer
        footer_frame = ttk.Frame(main_container)
        footer_frame.pack(fill=tk.X, pady=(20, 0))

        ttk.Button(footer_frame, text="Export Catalog (PDF)",
                   command=self.export_catalog).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(footer_frame, text="Request Quote",
                   command=self.request_quote).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(footer_frame, text="Technical Specs",
                   command=self.show_tech_specs).pack(side=tk.LEFT)

    def on_component_select(self, event):
        """Handle component selection from list"""
        selection = self.component_listbox.curselection()
        if selection:
            index = selection[0]
            self.display_component(self.components[index])

    def display_component(self, component: ComponentSpec):
        """Display detailed information about a component"""
        self.selected_component = component

        # Clear previous content
        for widget in self.detail_container.winfo_children():
            widget.destroy()

        # Component header
        header_frame = ttk.Frame(self.detail_container)
        header_frame.pack(fill=tk.X, pady=(0, 20))

        name_label = ttk.Label(header_frame, text=component.name, style="Title.TLabel")
        name_label.pack(anchor=tk.W)

        sku_label = ttk.Label(header_frame, text=f"SKU: {component.sku}", style="Info.TLabel")
        sku_label.pack(anchor=tk.W)

        # Visual representation
        visual_frame = ttk.Frame(self.detail_container)
        visual_frame.pack(fill=tk.X, pady=(0, 20))

        # Create canvas for component visualization
        canvas = Canvas(visual_frame, width=400, height=300, bg='white', highlightthickness=1)
        canvas.pack(side=tk.LEFT, padx=(0, 20))

        self.draw_component_visual(canvas, component)

        # Specifications panel
        spec_frame = ttk.Frame(visual_frame)
        spec_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        specs = [
            ("Dimensions", f"{component.width}' × {component.height}' × {component.thickness}\""),
            ("Material", component.material),
            ("Weight", f"{component.weight} lbs"),
            ("R-Value", f"R-{component.insulation_r_value}"),
            ("Fire Rating", component.fire_rating),
            ("Price", f"${component.price:.2f} per panel")
        ]

        for label, value in specs:
            row_frame = ttk.Frame(spec_frame)
            row_frame.pack(fill=tk.X, pady=2)

            ttk.Label(row_frame, text=f"{label}:", font=('Arial', 10, 'bold')).pack(side=tk.LEFT)
            ttk.Label(row_frame, text=value, font=('Arial', 10)).pack(side=tk.LEFT, padx=(10, 0))

        # Description
        desc_frame = ttk.LabelFrame(self.detail_container, text="Description", padding="10")
        desc_frame.pack(fill=tk.X, pady=(0, 10))

        desc_text = tk.Text(desc_frame, wrap=tk.WORD, height=3, font=('Arial', 10), relief=tk.FLAT, bg='white')
        desc_text.pack(fill=tk.X)
        desc_text.insert('1.0', component.description)
        desc_text.config(state='disabled')

        # Features
        features_frame = ttk.LabelFrame(self.detail_container, text="Key Features", padding="10")
        features_frame.pack(fill=tk.X, pady=(0, 10))

        for feature in component.features:
            feature_label = ttk.Label(features_frame, text=f"• {feature}", font=('Arial', 9))
            feature_label.pack(anchor=tk.W, pady=1)

        # Applications
        apps_frame = ttk.LabelFrame(self.detail_container, text="Applications", padding="10")
        apps_frame.pack(fill=tk.X)

        apps_text = ", ".join(component.applications)
        ttk.Label(apps_frame, text=apps_text, wraplength=600, font=('Arial', 9)).pack(anchor=tk.W)

        # Action buttons
        action_frame = ttk.Frame(self.detail_container)
        action_frame.pack(fill=tk.X, pady=(20, 0))

        ttk.Button(action_frame, text="Add to Project",
                   command=lambda: self.add_to_project(component)).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(action_frame, text="Download Spec Sheet",
                   command=lambda: self.download_spec(component)).pack(side=tk.LEFT, padx=(0, 10))
        ttk.Button(action_frame, text="View 3D Model",
                   command=lambda: self.view_3d_model(component)).pack(side=tk.LEFT)

    def draw_component_visual(self, canvas: Canvas, component: ComponentSpec):
        """Draw a visual representation of the component"""
        # Calculate scale to fit canvas
        canvas_width = 400
        canvas_height = 300
        padding = 40

        # Scale based on component dimensions
        scale_x = (canvas_width - 2 * padding) / component.width
        scale_y = (canvas_height - 2 * padding) / component.height
        scale = min(scale_x, scale_y) * 0.8

        # Calculate panel dimensions
        panel_width = component.width * scale
        panel_height = component.height * scale

        # Center the panel
        x_offset = (canvas_width - panel_width) / 2
        y_offset = (canvas_height - panel_height) / 2

        # Draw isometric view of panel
        # Front face
        front_points = [
            x_offset, y_offset + 20,
                      x_offset + panel_width, y_offset + 20,
                      x_offset + panel_width, y_offset + panel_height,
            x_offset, y_offset + panel_height
        ]
        canvas.create_polygon(front_points, fill=component.color, outline='#2C3E50', width=2)

        # Top face (to show thickness)
        thickness_visual = 20
        top_points = [
            x_offset, y_offset + 20,
                      x_offset + 30, y_offset,
                      x_offset + panel_width + 30, y_offset,
                      x_offset + panel_width, y_offset + 20
        ]
        canvas.create_polygon(top_points, fill='#D2B48C', outline='#2C3E50', width=2)

        # Right face
        right_points = [
            x_offset + panel_width, y_offset + 20,
            x_offset + panel_width + 30, y_offset,
            x_offset + panel_width + 30, y_offset + panel_height - 20,
            x_offset + panel_width, y_offset + panel_height
        ]
        canvas.create_polygon(right_points, fill='#A0826D', outline='#2C3E50', width=2)

        # Add dimension labels
        # Width
        canvas.create_line(x_offset, y_offset + panel_height + 10,
                           x_offset + panel_width, y_offset + panel_height + 10,
                           fill='#7F8C8D', width=1)
        canvas.create_text(x_offset + panel_width / 2, y_offset + panel_height + 20,
                           text=f"{component.width}'", font=('Arial', 10), fill='#2C3E50')

        # Height
        canvas.create_line(x_offset - 10, y_offset + 20,
                           x_offset - 10, y_offset + panel_height,
                           fill='#7F8C8D', width=1)
        canvas.create_text(x_offset - 25, y_offset + panel_height / 2 + 10,
                           text=f"{component.height}'", font=('Arial', 10), fill='#2C3E50', angle=90)

        # Grid pattern on front face
        grid_size = 20
        for i in range(int(panel_width / grid_size)):
            x = x_offset + i * grid_size
            canvas.create_line(x, y_offset + 20, x, y_offset + panel_height,
                               fill='#8B7355', width=0.5)
        for i in range(int(panel_height / grid_size)):
            y = y_offset + 20 + i * grid_size
            canvas.create_line(x_offset, y, x_offset + panel_width, y,
                               fill='#8B7355', width=0.5)

        # Add Daylun branding
        # Hotfix
        canvas.create_text(x_offset + panel_width / 2, y_offset + panel_height / 2 + 10,
                           text="", font=('Arial', 24, 'bold'), fill='white', anchor='center')

    def add_to_project(self, component: ComponentSpec):
        """Add component to current project"""
        print(f"Adding {component.name} to project...")
        # This would integrate with the house builder app
        tk.messagebox.showinfo("Add to Project",
                               f"{component.name} would be added to your current project.\n\n"
                               "This will integrate with the House Builder application.")

    def download_spec(self, component: ComponentSpec):
        """Download specification sheet"""
        print(f"Downloading spec sheet for {component.name}...")
        tk.messagebox.showinfo("Download",
                               f"Specification sheet for {component.name} would be downloaded as PDF.")

    def view_3d_model(self, component: ComponentSpec):
        """View 3D model of component"""
        print(f"Opening 3D viewer for {component.name}...")
        tk.messagebox.showinfo("3D Model",
                               f"3D model viewer for {component.name} would open.\n\n"
                               "This would show a detailed 3D model with textures and materials.")

    def export_catalog(self):
        """Export full catalog as PDF"""
        print("Exporting catalog...")
        tk.messagebox.showinfo("Export", "Full component catalog would be exported as PDF.")

    def request_quote(self):
        """Request a quote for selected components"""
        if self.selected_component:
            tk.messagebox.showinfo("Quote Request",
                                   f"Quote request for {self.selected_component.name} would be sent.\n\n"
                                   "A Daylun representative will contact you within 24 hours.")
        else:
            tk.messagebox.showwarning("No Selection", "Please select a component first.")

    def show_tech_specs(self):
        """Show detailed technical specifications"""
        if self.selected_component:
            # Create a new window for technical specs
            spec_window = tk.Toplevel(self.root)
            spec_window.title(f"Technical Specifications - {self.selected_component.name}")
            spec_window.geometry("600x500")

            # Add detailed technical information
            text_widget = tk.Text(spec_window, wrap=tk.WORD, padx=10, pady=10)
            text_widget.pack(fill=tk.BOTH, expand=True)

            tech_info = f"""TECHNICAL SPECIFICATIONS
{self.selected_component.name}
SKU: {self.selected_component.sku}

PHYSICAL PROPERTIES:
• Dimensions: {self.selected_component.width}' × {self.selected_component.height}' × {self.selected_component.thickness}"
• Weight: {self.selected_component.weight} lbs
• Weight per sq ft: {self.selected_component.weight / (self.selected_component.width * self.selected_component.height):.2f} lbs/sq ft

THERMAL PERFORMANCE:
• R-Value: R-{self.selected_component.insulation_r_value}
• U-Factor: {1 / self.selected_component.insulation_r_value:.3f}
• Air Infiltration: < 0.02 cfm/sq ft

STRUCTURAL PROPERTIES:
• Compressive Strength: 20 psi
• Flexural Strength: 35 psi
• Shear Strength: 25 psi
• Racking Load: 350 plf

CERTIFICATIONS:
• Fire Rating: {self.selected_component.fire_rating}
• ICC-ES Report: ESR-1234
• Energy Star Certified
• LEED Credits: Up to 7 points

INSTALLATION:
• Connection Type: Tongue & Groove
• Fastener Requirements: #10 × 3" screws @ 12" o.c.
• Sealant: Daylun ProSeal™ gasket system
• Installation Time: ~15 minutes per panel

WARRANTY:
• Structural: 50 years
• Thermal Performance: 25 years
• Weather Resistance: 15 years
"""
            text_widget.insert('1.0', tech_info)
            text_widget.config(state='disabled')
        else:
            tk.messagebox.showwarning("No Selection", "Please select a component first.")


if __name__ == "__main__":
    root = tk.Tk()
    app = ComponentLibraryApp(root)
    root.mainloop()