import { useEffect, useState } from 'react'

import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

  const handleExportTypeChange = (value: ExportType) => {
    setExportType(value)
    optionsStorage.set({ exportType: value })
  }

  return (
    <div id="root" className="min-h-screen !bg-zinc-950 text-zinc-100">
      <div id="container" className="container mx-auto max-w-2xl p-4">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">ChatGPT Export Settings</h1>
          <p className="text-sm text-zinc-400">
            Configure how your chat exports will be formatted.
          </p>
        </div>
        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label htmlFor="export-type" className="text-zinc-100">
              Export Format
            </Label>
            <Select value={exportType} onValueChange={handleExportTypeChange}>
              <SelectTrigger
                id="export-type"
                className="w-[180px] border-zinc-800 bg-zinc-900 text-zinc-100"
              >
                <SelectValue placeholder="Select format" />
              </SelectTrigger>
              <SelectContent className="border-zinc-800 bg-zinc-900">
                <SelectItem
                  value="markdown"
                  className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  Markdown
                </SelectItem>
                <SelectItem
                  value="xml"
                  className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  XML
                </SelectItem>
                <SelectItem
                  value="json"
                  className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  JSON
                </SelectItem>
                <SelectItem
                  value="html"
                  className="text-zinc-100 focus:bg-zinc-800 focus:text-zinc-100"
                >
                  HTML
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-zinc-400">
              Choose how you want your chat exports to be formatted.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
