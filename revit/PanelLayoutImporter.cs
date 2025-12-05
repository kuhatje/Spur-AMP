using System;
using System.Collections.Generic;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace Daylun.PanelImporter
{
    /// <summary>
    /// Basic Revit external command that reads the JSON exported from the web Builder
    /// and places placeholder panel families on matching levels.
    /// </summary>
    public class PanelLayoutImporter : IExternalCommand
    {
        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIDocument uidoc = commandData.Application.ActiveUIDocument;
            Document doc = uidoc.Document;
            try
            {
                var runner = new PanelLayoutRunner(doc, PanelLayoutImportSettings.Default);
                runner.Run();
                TaskDialog.Show("Daylun Panel Importer", "Panels placed successfully.");
                return Result.Succeeded;
            }
            catch (Exception ex)
            {
                message = ex.Message;
                return Result.Failed;
            }
        }
    }

    #region Payload DTOs
    public class RevitExportPayload
    {
        public PayloadMetadata Metadata { get; set; } = new PayloadMetadata();
        public List<RevitStory> Stories { get; set; } = new List<RevitStory>();
    }

    public class PayloadMetadata
    {
        public double CellSizeFeet { get; set; }
        public double StoryHeightFeet { get; set; }
        public int TotalFloors { get; set; }
    }

    public class RevitStory
    {
        public int StoryNumber { get; set; }
        public double ElevationFeet { get; set; }
        public List<RevitComponentInstance> Components { get; set; } = new List<RevitComponentInstance>();
    }

    public class RevitComponentInstance
    {
        public string Id { get; set; } = string.Empty;
        public string Family { get; set; } = string.Empty;
        public Footprint FootprintCenter { get; set; } = new Footprint();
        public double RotationDeg { get; set; }
    }

    public class Footprint
    {
        public double X { get; set; }
        public double Y { get; set; }
    }
    #endregion
}
