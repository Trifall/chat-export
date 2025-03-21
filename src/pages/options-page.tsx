import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import "@/global.css";
import optionsStorage, { ExportType } from "@/options-storage";
import { useEffect, useState } from "react";

export default function OptionsPage() {
  const [exportType, setExportType] = useState<ExportType>("markdown");

  useEffect(() => {
    optionsStorage.getAll().then((options) => {
      if (options.exportType) {
        setExportType(options.exportType as ExportType);
      }
    });
  }, []);

  const handleExportTypeChange = (value: ExportType) => {
    setExportType(value);
    optionsStorage.set({ exportType: value });
  };

  return (
    <div className="container mx-auto max-w-2xl p-4">
      <div className="space-y-0.5">
        <h1 className="text-2xl font-bold tracking-tight">
          ChatGPT Export Settings
        </h1>
        <p className="text-sm text-muted-foreground">
          Configure how your chat exports will be formatted.
        </p>
      </div>
      <div className="mt-6 space-y-6">
        <div className="space-y-2">
          <Label htmlFor="export-type">Export Format</Label>
          <Select value={exportType} onValueChange={handleExportTypeChange}>
            <SelectTrigger id="export-type" className="w-[180px]">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="markdown">Markdown</SelectItem>
              <SelectItem value="xml">XML</SelectItem>
              <SelectItem value="json">JSON</SelectItem>
              <SelectItem value="html">HTML</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">
            Choose how you want your chat exports to be formatted.
          </p>
        </div>
      </div>
    </div>
  );
}
