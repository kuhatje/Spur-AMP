using System;
using System.Collections.Generic;
using System.IO;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Autodesk.Revit.DB.Structure;
using Newtonsoft.Json;

namespace Daylun.PanelImporter
{
    /// <summary>
    /// Basic Revit external command that reads the JSON exported from the web Builder
    /// and places placeholder panel families on matching levels.
    /// </summary>
    public class PanelLayoutImporter : IExternalCommand
    {
        private const string DefaultLayoutPath = @"C:\Daylun\daylun-revit-layout.json";
        private const string PlaceholderFamilyDirectory = @"C:\Daylun\Families";

        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            UIDocument uidoc = commandData.Application.ActiveUIDocument;
            Document doc = uidoc.Document;

            if (!File.Exists(DefaultLayoutPath))
            {
                message = $"Layout JSON not found at {DefaultLayoutPath}";
                return Result.Failed;
            }

            var payload = JsonConvert.DeserializeObject<RevitExportPayload>(File.ReadAllText(DefaultLayoutPath));
            if (payload == null)
            {
                message = "Unable to parse layout JSON.";
                return Result.Failed;
            }

            using (Transaction tx = new Transaction(doc, "Import Daylun Layout"))
            {
                tx.Start();

                foreach (var story in payload.Stories)
                {
                    Level level = EnsureLevel(doc, story.ElevationFeet);
                    foreach (var component in story.Components)
                    {
                        PlaceFamilyInstance(doc, level, component);
                    }
                }

                tx.Commit();
            }

            TaskDialog.Show("Daylun Panel Importer", "Panels placed successfully.");
            return Result.Succeeded;
        }

        private Level EnsureLevel(Document doc, double elevationFeet)
        {
            double elevationInternal = UnitUtils.ConvertToInternalUnits(elevationFeet, UnitTypeId.Feet);
            FilteredElementCollector collector = new FilteredElementCollector(doc).OfClass(typeof(Level));

            foreach (Level level in collector)
            {
                if (Math.Abs(level.Elevation - elevationInternal) < 0.001)
                {
                    return level;
                }
            }

            Level newLevel = Level.Create(doc, elevationInternal);
            newLevel.Name = $"Story_{Math.Round(elevationFeet)}ft";
            return newLevel;
        }

        private void PlaceFamilyInstance(Document doc, Level level, RevitComponentInstance component)
        {
            string familyPath = Path.Combine(PlaceholderFamilyDirectory, component.Family + ".rfa");
            FamilySymbol symbol = LoadOrFindFamily(doc, component.Family, familyPath);
            if (symbol == null)
            {
                throw new InvalidOperationException($"Family {component.Family} missing at {familyPath}");
            }

            if (!symbol.IsActive)
            {
                symbol.Activate();
            }

            XYZ point = new XYZ(
                UnitUtils.ConvertToInternalUnits(component.FootprintCenter.X, UnitTypeId.Feet),
                UnitUtils.ConvertToInternalUnits(component.FootprintCenter.Y, UnitTypeId.Feet),
                level.Elevation);

            var instance = doc.Create.NewFamilyInstance(point, symbol, level, StructuralType.NonStructural);
            if (component.RotationDeg != 0)
            {
                double rotationRad = UnitUtils.DegreesToRadians(component.RotationDeg);
                Line axis = Line.CreateBound(point, point + XYZ.BasisZ);
                ElementTransformUtils.RotateElement(doc, instance.Id, axis, rotationRad);
            }
        }

        private FamilySymbol LoadOrFindFamily(Document doc, string familyName, string familyPath)
        {
            FilteredElementCollector collector = new FilteredElementCollector(doc)
                .OfClass(typeof(Family));

            foreach (Family family in collector)
            {
                if (family.Name.Equals(familyName, StringComparison.OrdinalIgnoreCase))
                {
                    ISet<ElementId> symbols = family.GetFamilySymbolIds();
                    foreach (ElementId symbolId in symbols)
                    {
                        return doc.GetElement(symbolId) as FamilySymbol;
                    }
                }
            }

            if (!File.Exists(familyPath))
            {
                return null;
            }

            if (doc.LoadFamily(familyPath, out Family loadedFamily))
            {
                ISet<ElementId> symbols = loadedFamily.GetFamilySymbolIds();
                foreach (ElementId symbolId in symbols)
                {
                    return doc.GetElement(symbolId) as FamilySymbol;
                }
            }

            return null;
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
