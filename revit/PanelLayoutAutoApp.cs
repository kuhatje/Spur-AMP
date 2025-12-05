using Autodesk.Revit.ApplicationServices;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;

namespace Daylun.PanelImporter
{
    /// <summary>
    /// Optional automation hook that watches for a new document and runs the importer automatically
    /// when the DAYLUN_AUTORUN environment variable is set to 1.
    /// </summary>
    public class PanelLayoutAutoApp : IExternalDBApplication
    {
        private bool _hasExecuted = false;

        public ExternalDBApplicationResult OnStartup(ControlledApplication application)
        {
            application.DocumentCreated += OnDocumentCreated;
            return ExternalDBApplicationResult.Succeeded;
        }

        public ExternalDBApplicationResult OnShutdown(ControlledApplication application)
        {
            application.DocumentCreated -= OnDocumentCreated;
            return ExternalDBApplicationResult.Succeeded;
        }

        private void OnDocumentCreated(object sender, DocumentCreatedEventArgs e)
        {
            if (_hasExecuted || !PanelLayoutImportSettings.AutoRunEnabled)
            {
                return;
            }

            if (!PanelLayoutImportSettings.TryFromEnvironment(out var settings))
            {
                return;
            }

            _hasExecuted = true;

            try
            {
                var runner = new PanelLayoutRunner(e.Document, settings);
                runner.Run();
            }
            catch (System.Exception ex)
            {
                System.Diagnostics.Trace.WriteLine($"Daylun auto-run failed: {ex}");
                throw;
            }
        }
    }
}
