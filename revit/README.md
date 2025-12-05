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
   - If you want auto-run support, add a second `<AddIn Type="Application">` entry in the same manifest that points to `Daylun.PanelImporter.PanelLayoutAutoApp`.
4. Create three placeholder Generic Model families (`Daylun_Panel_4x8_Placeholder.rfa`, `Daylun_CornerPanel_Placeholder.rfa`, `Daylun_FloorPanel_Placeholder.rfa`) and place them in `C:\Daylun\Families\` or edit the path constants near the top of the command.
5. Run the add-in inside a blank RVT:
   - The importer ensures levels exist at each story elevation.
   - Each JSON component is placed as a family instance with rotation taken from the Builder.
   - You now have an RVT that reflects the Builder layout.

### Fully automated RVT generation (optional)

If you want a one-click pipeline (no manual button presses), the project also includes `PanelLayoutAutoApp`, which listens for new documents and runs the importer automatically when the following environment variables are set before launching `Revit.exe` or `revitcoreconsole.exe`:

| Variable | Purpose |
| --- | --- |
| `DAYLUN_AUTORUN=1` | Enables the automation hook |
| `DAYLUN_LAYOUT_JSON` | Full path to the exported `daylun-revit-layout.json` |
| `DAYLUN_FAMILY_DIR` | Folder containing the placeholder family files |
| `DAYLUN_OUTPUT_RVT` | Destination `.rvt` path (doc is saved automatically) |

Example PowerShell session (Revit 2024, headless):

```powershell
$env:DAYLUN_AUTORUN = "1"
$env:DAYLUN_LAYOUT_JSON = "C:\Daylun\daylun-revit-layout.json"
$env:DAYLUN_FAMILY_DIR = "C:\Daylun\Families"
$env:DAYLUN_OUTPUT_RVT = "C:\Daylun\output\custom-house.rvt"
"C:\Program Files\Autodesk\Revit 2024\revitcoreconsole.exe" `
    /i "C:\Daylun\templates\DaylunBlank.rte" `
    /al "C:\Path\To\Daylun.PanelImporter.dll"
```

When `revitcoreconsole` starts it creates a document from the template, `PanelLayoutAutoApp` sees the environment variables, runs `PanelLayoutRunner`, saves to `custom-house.rvt`, and exits. This produces an RVT ready to open in the Revit UI or feed into downstream APS workflows.

### Notes

- The importer is intentionally dumb: it only places placeholders. Swap the placeholder family files with your production families later and the same JSON will still work.
- The script expects the JSON schema defined in `app/HouseBuilder/utils/revitPayload.ts`. If you extend the Builder with new component types, update both the TypeScript generator and the C# DTO classes.
- Once this local loop is stable we can port the logic into a Design Automation work-item (APS) by reusing the JSON contract and placement logic.
