import OptionsSync from 'webext-options-sync'

export type ExportType = 'markdown' | 'xml' | 'json' | 'html'

export interface Options {
  exportType: ExportType
  [key: string]: string
}

export const defaultOptions: Options = {
  exportType: 'markdown',
}

const optionsStorage = new OptionsSync({
  defaults: defaultOptions,
  migrations: [OptionsSync.migrations.removeUnused],
  logging: true,
})

export default optionsStorage
