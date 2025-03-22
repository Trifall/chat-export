import { copyToClipboard, saveToFile } from '@/modules/file-operations'

import { detectSite } from './site-detection'

export function createExportButton(): HTMLElement {
  const site = detectSite()
  const buttonContainer = document.createElement('div')
  buttonContainer.className = 'relative'

  const button = document.createElement('button')

  if (site === 'claude') {
    // match Claude's button style
    button.className = `inline-flex items-center justify-center relative shrink-0 ring-offset-2 ring-offset-bg-300 
      ring-accent-main-100 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none 
      disabled:opacity-50 disabled:shadow-none disabled:drop-shadow-none bg-[radial-gradient(ellipse,_var(--tw-gradient-stops))] 
      from-bg-500/10 from-50% to-bg-500/30 border-0.5 border-border-400 font-medium font-styrene text-text-100/90 
      transition-colors active:bg-bg-500/50 hover:text-text-000 hover:bg-bg-500/60 h-9 px-4 py-2 rounded-lg min-w-[5rem] 
      active:scale-[0.985] whitespace-nowrap`
    buttonContainer.className = 'mr-1'
    buttonContainer.style.position = 'relative'
  } else {
    // original ChatGPT style
    button.className = 'btn relative btn-secondary text-token-text-primary'
  }

  button.setAttribute('aria-label', 'Export')
  button.setAttribute('data-testid', 'export-chat-button')

  const buttonContent = document.createElement('div')
  buttonContent.className =
    site === 'claude' ? '' : 'flex w-full items-center justify-center gap-1.5'

  buttonContent.appendChild(document.createTextNode('Export'))
  button.appendChild(buttonContent)
  buttonContainer.appendChild(button)

  // make dropdown
  const dropdown = document.createElement('div')
  dropdown.className = 'absolute hidden rounded-md shadow-lg mt-3 py-2 w-48 z-50 text-zinc-100'
  dropdown.style.top = '100%'
  dropdown.style.left = '0'
  dropdown.style.backgroundColor = 'rgb(24 24 27)' // zinc-900

  const options = [
    { text: 'Copy to Clipboard', action: copyToClipboard },
    { text: 'Save to File', action: saveToFile },
  ]

  options.forEach((option, index) => {
    const item = document.createElement('button')
    item.className = 'w-full text-left px-4 py-4 text-zinc-100'
    item.style.backgroundColor = 'rgb(24 24 27)' // zinc-900
    item.addEventListener('mouseenter', () => {
      item.style.backgroundColor = 'rgb(39 39 42)' // zinc-800
    })
    item.addEventListener('mouseleave', () => {
      item.style.backgroundColor = 'rgb(24 24 27)' // zinc-900
    })
    item.textContent = option.text
    item.onclick = option.action
    if (index > 0) {
      item.style.marginTop = '4px'
    }
    dropdown.appendChild(item)
  })

  buttonContainer.appendChild(dropdown)

  // toggle dropdown
  button.onclick = (e) => {
    e.stopPropagation()
    dropdown.classList.toggle('hidden')
  }

  // close dropdown when clicking outside
  document.addEventListener('click', () => {
    dropdown.classList.add('hidden')
  })

  return buttonContainer
}
