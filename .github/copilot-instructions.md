<!-- https://github.com/PatrickJS/awesome-cursorrules/tree/main/rules/chrome-extension-dev-js-typescript-cursorrules-pro -->

# Chrome Extension Development Guidelines

## Expertise Areas

- Chrome Extension Development
- Parcel
- JavaScript/TypeScript
- HTML/CSS
- Shadcn UI
- Radix UI
- Tailwind
- Web APIs
- Prettier
- ESLint
- Playwright

## Code Style and Structure

- Write concise, technical JavaScript/TypeScript code with accurate examples
- Use modern JavaScript features and best practices
- Prefer functional programming patterns; minimize use of classes
- Use descriptive variable names (e.g., isExtensionEnabled, hasPermission)
- Follow commitlint conventions for commit messages
- Structure files:
  - manifest.json
  - background scripts
  - content scripts
  - popup scripts
  - options page

## Naming Conventions

- Use lowercase with underscores for file names (e.g., content_script.js, background_worker.js)
- Use camelCase for function and variable names
- Use PascalCase for class names (if used)

## TypeScript Usage

- Encourage TypeScript for type safety and better developer experience
- Use interfaces for defining message structures and API responses
- Leverage TypeScript's union types and type guards for runtime checks

## Extension Architecture

- Implement a clear separation of concerns between different extension components
- Use message passing for communication between different parts of the extension
- Implement proper state management using chrome.storage API

## Manifest and Permissions

- Use the latest manifest version (v3) unless there's a specific need for v2
- Follow the principle of least privilege for permissions
- Implement optional permissions where possible

## Security and Privacy

- Implement Content Security Policy (CSP) in manifest.json
- Use HTTPS for all network requests
- Sanitize user inputs and validate data from external sources
- Implement proper error handling and logging

## UI and Styling

- Create responsive designs for popup and options pages
- Use CSS Grid or Flexbox for layouts
- Implement consistent styling across all extension UI elements

## Performance Optimization

- Minimize resource usage in background scripts
- Use event pages instead of persistent background pages when possible
- Implement lazy loading for non-critical extension features
- Optimize content scripts to minimize impact on web page performance

## Browser API Usage

- Utilize chrome.\* APIs effectively (e.g., chrome.tabs, chrome.storage, chrome.runtime)
- Implement proper error handling for all API calls
- Use chrome.alarms for scheduling tasks instead of setInterval

## Cross-browser Compatibility

- Use WebExtensions API for cross-browser support where possible
- Implement graceful degradation for browser-specific features

## Testing and Debugging

- Utilize Chrome DevTools for debugging
- Implement unit tests for core extension functionality
- Implement e2e tests for core extension functionality using Playwright
- Use Chrome's built-in extension loading for testing during development

## Context-Aware Development

- Always consider the whole project context when providing suggestions or generating code
- Avoid duplicating existing functionality or creating conflicting implementations
- Ensure that new code integrates seamlessly with the existing project structure and architecture
- Before adding new features or modifying existing ones, review the current project state
- Consider previously discussed or implemented features to prevent contradictions

## Code Output Guidelines

- Provide complete file content, not just new or modified parts
- Include all necessary imports, declarations, and surrounding code
- Add comments or explanations for significant changes
- For large files, provide relevant complete sections with clear context

## General Guidelines

- Follow Chrome Extension documentation for:
  - Best practices
  - Security guidelines
  - API usage
