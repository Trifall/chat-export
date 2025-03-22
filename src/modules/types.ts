export type Site = 'chatgpt' | 'claude'

export interface Message {
  role: string
  content: string
}

export interface ChatContent {
  format: string
  content: string
}
