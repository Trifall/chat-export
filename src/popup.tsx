import { StrictMode } from 'react'

import { createRoot } from 'react-dom/client'

import PopupPage from './pages/popup-page'

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <PopupPage />
  </StrictMode>
)
