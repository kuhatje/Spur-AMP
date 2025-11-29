## Daylun Revit Importer (Local Prototype)

This folder contains a minimal Revit external command that consumes the JSON exported from the web Builder (`Export Revit Layout` button). The goal is to prove that the Builder grid can be translated into native Revit elements before we invest time in Autodesk Platform Services automation.

### Workflow

1. In the House Builder UI, frame a layout and click **Export Revit Layout**.  
   This downloads `daylun-revit-layout.json`.
2. Copy the JSON to a folder Revit can reach (defaults to `C:\Daylun\daylun-revit-layout.json` in the sample command).
3. Build `PanelLayoutImporter.cs` into a Revit add-in:
   - Create a new Revit **External Command** add-in project (C#).
   - Add a reference to `Newtonsoft.Json` (NuGet).
   - Add this file to the project and update the namespace if needed.
   - Compile and register the add-in via an `.addin` manifest.
4. Create three placeholder Generic Model families (`Daylun_Panel_4x8_Placeholder.rfa`, `Daylun_CornerPanel_Placeholder.rfa`, `Daylun_FloorPanel_Placeholder.rfa`) and place them in `C:\Daylun\Families\` or edit the path constants near the top of the command.
5. Run the add-in inside a blank RVT:
   - The importer ensures levels exist at each story elevation.
   - Each JSON component is placed as a family instance with rotation taken from the Builder.

### Notes

- The importer is intentionally dumb: it only places placeholders. Swap the placeholder family files with your production families later and the same JSON will still work.
- The script expects the JSON schema defined in `app/HouseBuilder/utils/revitPayload.ts`. If you extend the Builder with new component types, update both the TypeScript generator and the C# DTO classes.
- Once this local loop is stable we can port the logic into a Design Automation work-item (APS) by reusing the JSON contract and placement logic.
