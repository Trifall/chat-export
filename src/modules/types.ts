export type Site = 'chatgpt' | 'claude' | 'gemini'

export interface Message {
  role: string
  content: string
}

export interface ChatContent {
  format: string
  content: string
}
