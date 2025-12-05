using System;
using System.IO;
using Autodesk.Revit.DB;
using Autodesk.Revit.DB.Structure;
using Newtonsoft.Json;

namespace Daylun.PanelImporter
{
    public class PanelLayoutImportSettings
    {
        public string LayoutPath { get; }
        public string FamilyDirectory { get; }
        public string? OutputPath { get; }

        public PanelLayoutImportSettings(string layoutPath, string familyDirectory, string? outputPath = null)
        {
            LayoutPath = layoutPath;
            FamilyDirectory = familyDirectory;
            OutputPath = outputPath;
        }

        public static PanelLayoutImportSettings Default =>
            new PanelLayoutImportSettings(
                @"C:\Daylun\daylun-revit-layout.json",
                @"C:\Daylun\Families");

        public static bool TryFromEnvironment(out PanelLayoutImportSettings settings)
        {
            settings = null!;
            var layoutPath = Environment.GetEnvironmentVariable("DAYLUN_LAYOUT_JSON");
            var familyPath = Environment.GetEnvironmentVariable("DAYLUN_FAMILY_DIR");
            var outputPath = Environment.GetEnvironmentVariable("DAYLUN_OUTPUT_RVT");

            if (string.IsNullOrWhiteSpace(layoutPath) || string.IsNullOrWhiteSpace(familyPath))
            {
                return false;
            }

            settings = new PanelLayoutImportSettings(layoutPath!, familyPath!, outputPath);
            return true;
        }

        public static bool AutoRunEnabled =>
            string.Equals(Environment.GetEnvironmentVariable("DAYLUN_AUTORUN"), "1", StringComparison.OrdinalIgnoreCase);
    }

    public class PanelLayoutRunner
    {
        private readonly Document _doc;
        private readonly PanelLayoutImportSettings _settings;

        public PanelLayoutRunner(Document doc, PanelLayoutImportSettings settings)
        {
            _doc = doc;
            _settings = settings;
        }

        public void Run()
        {
            if (!File.Exists(_settings.LayoutPath))
            {
                throw new FileNotFoundException($"Layout JSON not found at {_settings.LayoutPath}");
            }

            var payload = JsonConvert.DeserializeObject<RevitExportPayload>(File.ReadAllText(_settings.LayoutPath));
            if (payload == null)
            {
                throw new InvalidOperationException("Unable to parse layout JSON.");
            }

            using (Transaction tx = new Transaction(_doc, "Import Daylun Layout"))
            {
                tx.Start();

                foreach (var story in payload.Stories)
                {
                    Level level = EnsureLevel(_doc, story.ElevationFeet);
                    foreach (var component in story.Components)
                    {
                        PlaceFamilyInstance(_doc, level, component, _settings.FamilyDirectory);
                    }
                }

                tx.Commit();
            }

            if (!string.IsNullOrWhiteSpace(_settings.OutputPath))
            {
                var outputDir = Path.GetDirectoryName(_settings.OutputPath);
                if (!string.IsNullOrEmpty(outputDir) && !Directory.Exists(outputDir))
                {
                    Directory.CreateDirectory(outputDir);
                }

                ModelPath path = ModelPathUtils.ConvertUserVisiblePathToModelPath(_settings.OutputPath);
                SaveAsOptions options = new SaveAsOptions { OverwriteExistingFile = true };
                _doc.SaveAs(path, options);
            }
        }

        private static Level EnsureLevel(Document doc, double elevationFeet)
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

        private static void PlaceFamilyInstance(Document doc, Level level, RevitComponentInstance component, string familyDirectory)
        {
            string familyPath = Path.Combine(familyDirectory, component.Family + ".rfa");
            FamilySymbol symbol = LoadOrFindFamily(doc, component.Family, familyPath)
                ?? throw new InvalidOperationException($"Family {component.Family} missing at {familyPath}");

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

        private static FamilySymbol? LoadOrFindFamily(Document doc, string familyName, string familyPath)
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
}
