import { useEffect, useState } from 'react'

import { Label } from '@/components/ui/label'
import '@/global.css'
import optionsStorage, { ExportType } from '@/options-storage'

export default function OptionsPage() {
  const [exportType, setExportType] = useState<ExportType>('markdown')

  useEffect(() => {
    optionsStorage.getAll().then((options) => {
      if (options.exportType) {
        setExportType(options.exportType as ExportType)
      }
    })
  }, [])

  const handleExportTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value as ExportType
    setExportType(value)
    optionsStorage.set({ exportType: value })
  }

  return (
    <div id="root" className="min-h-screen !bg-zinc-950 text-zinc-100">
      <div id="container" className="container mx-auto max-w-2xl p-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">LLM Export Settings</h1>
          <p className="text-sm text-zinc-400">
            Configure how your chat exports will be formatted.
          </p>
        </div>
        <div className="mt-4 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="export-type">Format</Label>
            <select
              id="export-type"
              value={exportType}
              onChange={handleExportTypeChange}
              className="flex h-9 w-[180px] rounded-md border border-zinc-800 bg-zinc-900 px-3 py-1 text-sm text-zinc-100 shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="markdown">Markdown</option>
              <option value="xml">XML</option>
              <option value="json">JSON</option>
              <option value="html">HTML</option>
            </select>
            <p className="text-sm text-zinc-400">Preferred export format</p>
          </div>
        </div>
      </div>
    </div>
  )
}
