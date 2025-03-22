import { getChatContent } from '@/modules/chat-content'

export async function copyToClipboard() {
  const { content } = await getChatContent(false)
  await navigator.clipboard.writeText(content)
}

export async function saveToFile() {
  const { format, content } = await getChatContent(true)
  const mimeTypes: { [key: string]: string } = {
    markdown: 'text/markdown',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
  }

  const extensions: { [key: string]: string } = {
    markdown: 'md',
    json: 'json',
    xml: 'xml',
    html: 'html',
  }

  const blob = new Blob([content], { type: mimeTypes[format] || 'text/plain' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chat-export-${new Date().toISOString().split('T')[0]}.${extensions[format] || 'txt'}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
