import { copyToClipboard, saveToFile } from '@/modules/file-operations';

import { detectSite } from './site-detection';

export function createExportButton(): HTMLElement {
  const site = detectSite();
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'relative';

  const button = document.createElement('button');

  if (site === 'claude') {
    // match Claude's button style
    button.className = `inline-flex items-center justify-center relative shrink-0 ring-offset-2 ring-offset-bg-300 
      ring-accent-main-100 focus-visible:outline-none focus-visible:ring-1 disabled:pointer-events-none 
      disabled:opFacity-50 disabled:shadow-none disabled:drop-shadow-none bg-[radial-gradient(ellipse,_var(--tw-gradient-stops))] 
      from-bg-500/10 from-50% to-bg-500/30 border-0.5 border-border-400 font-medium font-styrene text-text-100/90 
      transition-colors active:bg-bg-500/50 hover:text-text-000 hover:bg-bg-500/60 h-9 px-4 py-2 rounded-lg min-w-[5rem] 
      active:scale-[0.985] whitespace-nowrap`;
    buttonContainer.className = 'mr-1';
    buttonContainer.style.position = 'relative';
  } else if (site === 'gemini') {
    // match Gemini's Material Design button style
    button.className = 'ms-button-borderless ms-button-icon';
    button.setAttribute('ms-button', '');
    button.setAttribute('variant', 'icon-borderless');
    button.setAttribute('aria-label', 'Export chat');
    button.setAttribute('data-testid', 'export-chat-button');

    // Create icon span like other Gemini buttons
    const iconSpan = document.createElement('span');
    iconSpan.className =
      'material-symbols-outlined notranslate ms-button-icon-symbol ng-star-inserted';
    iconSpan.setAttribute('aria-hidden', 'true');
    iconSpan.textContent = 'download';
    button.appendChild(iconSpan);
  } else {
    // original ChatGPT style
    button.className = 'btn relative btn-secondary text-token-text-primary';
  }

  if (site !== 'gemini') {
    button.setAttribute('aria-label', 'Export');
    button.setAttribute('data-testid', 'export-chat-button');

    const buttonContent = document.createElement('div');
    buttonContent.className =
      site === 'claude' ? '' : 'flex w-full items-center justify-center gap-1.5';

    buttonContent.appendChild(document.createTextNode('Export'));
    button.appendChild(buttonContent);
  }
  buttonContainer.appendChild(button);

  // make dropdown
  const dropdown = document.createElement('div');
  if (site === 'gemini') {
    // match Geminis Material Design menu style
    dropdown.className = 'mat-mdc-menu-panel mat-menu-after mat-menu-below ng-star-inserted';
    dropdown.style.transformOrigin = 'right top 0px';
    dropdown.style.position = 'fixed';
    dropdown.style.zIndex = '99999';
    dropdown.style.display = 'none';
    dropdown.style.backgroundColor =
      'var(--mat-menu-container-color, var(--gm-colorfamily-white, #f9f9f9))';
    dropdown.style.color =
      'var(--mat-menu-item-label-text-color, var(--gm-colorfamily-grey900, #1a1a1a))';
    dropdown.style.borderRadius = '4px';
    dropdown.style.boxShadow =
      '0 2px 4px -1px rgba(0,0,0,.2), 0 4px 5px 0 rgba(0,0,0,.14), 0 1px 10px 0 rgba(0,0,0,.12)';
    dropdown.style.minWidth = '200px';
  } else {
    dropdown.className = 'absolute hidden rounded-md shadow-lg mt-3 py-2 w-48 z-50 text-zinc-100';
    dropdown.style.top = '100%';
    dropdown.style.left = '0';
    dropdown.style.backgroundColor = 'rgb(24 24 27)'; // zinc-900 approx
  }

  const options = [
    { text: 'Copy to Clipboard', action: copyToClipboard },
    { text: 'Save to File', action: saveToFile },
  ];

  options.forEach((option, index) => {
    const item = document.createElement('button');

    if (site === 'gemini') {
      // match Gemini's Material Design menu item style
      item.className = 'mat-mdc-menu-item mat-focus-indicator';
      item.setAttribute('mat-menu-item', '');
      item.setAttribute('role', 'menuitem');
      item.setAttribute('tabindex', '0');
      item.setAttribute('aria-disabled', 'false');

      const itemText = document.createElement('span');
      itemText.className = 'mat-mdc-menu-item-text';
      itemText.textContent = option.text;
      item.appendChild(itemText);

      const ripple = document.createElement('div');
      ripple.className = 'mat-ripple mat-mdc-menu-ripple';
      item.appendChild(ripple);
    } else {
      item.className = 'w-full text-left px-4 py-4 text-zinc-100';
      item.style.backgroundColor = 'rgb(24 24 27)'; // zinc-900
      item.addEventListener('mouseenter', () => {
        item.style.backgroundColor = 'rgb(39 39 42)'; // zinc-800
      });
      item.addEventListener('mouseleave', () => {
        item.style.backgroundColor = 'rgb(24 24 27)'; // zinc-900
      });
      item.textContent = option.text;
      if (index > 0) {
        item.style.marginTop = '4px';
      }
    }

    item.onclick = option.action;
    dropdown.appendChild(item);
  });

  if (site === 'gemini') {
    // append to body to avoid stacking context issues
    document.body.appendChild(dropdown);
  } else {
    buttonContainer.appendChild(dropdown);
  }

  // toggle dropdown
  button.onclick = (e) => {
    e.stopPropagation();
    if (site === 'gemini') {
      // position dropdown relative to button for Gemini
      const buttonRect = button.getBoundingClientRect();
      dropdown.style.top = `${buttonRect.bottom + window.scrollY}px`;
      dropdown.style.left = `${buttonRect.right - 200 + window.scrollX}px`; // 200px is dropdown width

      // toggle display for Gemini Material Design
      if (dropdown.style.display === 'none' || dropdown.style.display === '') {
        dropdown.style.display = 'block';
      } else {
        dropdown.style.display = 'none';
      }
    } else {
      dropdown.classList.toggle('hidden');
    }
  };

  // close dropdown when clicking outside
  document.addEventListener('click', () => {
    if (site === 'gemini') {
      dropdown.style.display = 'none';
    } else {
      dropdown.classList.add('hidden');
    }
  });

  return buttonContainer;
}
