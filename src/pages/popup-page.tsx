import "@/global.css";
import optionsStorage, { ExportType } from "@/options-storage";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";

export default function PopupPage() {
  const [exportType, setExportType] = useState<ExportType>("markdown");

  useEffect(() => {
    optionsStorage.getAll().then((options) => {
      if (options.exportType) {
        setExportType(options.exportType as ExportType);
      }
    });
  }, []);

  const handleExportTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ExportType;
    setExportType(value);
    optionsStorage.set({ exportType: value });
  };

  return (
    <div className="h-[400px] w-[300px] p-4">
      <div className="space-y-0.5">
        <h1 className="text-xl font-bold tracking-tight">Export Settings</h1>
        <p className="text-sm text-muted-foreground">
          Configure export format.
        </p>
      </div>
      <div className="mt-4 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="export-type">Format</Label>
          <select
            id="export-type"
            value={exportType}
            onChange={handleExportTypeChange}
            className="flex h-9 w-[180px] rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          >
            <option value="markdown">Markdown</option>
            <option value="xml">XML</option>
            <option value="json">JSON</option>
            <option value="html">HTML</option>
          </select>
          <p className="text-sm text-muted-foreground">
            Choose your preferred export format.
          </p>
        </div>
      </div>
    </div>
  );
}
