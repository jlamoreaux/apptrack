# Accessibility System Documentation

This directory contains the accessibility infrastructure for the AppTrack application, ensuring WCAG 2.1 AA compliance across all components and user interactions.

## Components

### ErrorBoundary (`error-boundary.tsx`)
Provides accessible error handling with screen reader announcements and keyboard navigation support.

**Usage:**
```tsx
import { AccessibleErrorBoundary, PageErrorBoundary } from '@/components/accessibility/error-boundary'

// Wrap entire pages
<PageErrorBoundary>
  <YourPageComponent />
</PageErrorBoundary>

// Wrap specific sections
<AccessibleErrorBoundary level="section" name="Applications List">
  <ApplicationsList />
</AccessibleErrorBoundary>
```

**Features:**
- ARIA live announcements for errors
- Automatic focus management
- Keyboard-accessible recovery options
- Different error levels (page, section, component)
- Custom error handlers

### SkipLink (`skip-link.tsx`)
Enables keyboard users to bypass repetitive navigation and jump to main content.

**Usage:**
```tsx
import { SkipNavigation } from '@/components/accessibility/skip-link'

// Add to app layout
<SkipNavigation />
<Navigation />
<main id="main-content">
  {children}
</main>
```

**Features:**
- Hidden by default, visible on focus
- WCAG 2.4.1 Bypass Blocks compliance
- High contrast focus indicators
- Keyboard accessible

## Hooks

### Focus Management (`/hooks/use-focus-management.ts`)
Comprehensive focus management utilities for complex UI components.

**Available Hooks:**

#### `useFocusTrap(isActive: boolean)`
Traps focus within a container for modals and dialogs.

```tsx
const containerRef = useFocusTrap(isModalOpen)

return (
  <div ref={containerRef} role="dialog">
    <button>First focusable</button>
    <button>Last focusable</button>
  </div>
)
```

#### `useFocusWithin()`
Manages focus within a specific container.

```tsx
const { containerRef, focusFirst, focusLast } = useFocusWithin()

return (
  <div ref={containerRef}>
    <button onClick={focusFirst}>Focus First</button>
    <button onClick={focusLast}>Focus Last</button>
  </div>
)
```

#### `useKeyboardNavigation(options)`
Handles arrow key navigation for lists and grids.

```tsx
const containerRef = useKeyboardNavigation({
  direction: 'vertical',
  loop: true,
  onEscape: () => closeMenu()
})
```

#### `useFocusRestore()`
Saves and restores focus when navigating between UI states.

```tsx
const { saveFocus, restoreFocus } = useFocusRestore()

const openModal = () => {
  saveFocus()
  setIsModalOpen(true)
}

const closeModal = () => {
  setIsModalOpen(false)
  restoreFocus()
}
```

#### `useRovingTabIndex(defaultIndex)`
Implements roving tabindex pattern for complex widgets.

```tsx
const { containerRef, focusItem, updateTabIndex } = useRovingTabIndex(0)
```

## Color System

### Accessible Colors (`/lib/constants/accessible-colors.ts`)
Centralized WCAG AA compliant color system.

**Key Functions:**

#### `getStatusColors(status: string)`
Returns WCAG compliant colors for status badges.

```tsx
const colors = getStatusColors("Applied")
// Returns: { bg: "#E3F2FD", text: "#0D47A1", border: "#1976D2", label: "Applied" }
```

#### `getStatusClasses(status: string)`
Generates Tailwind-compatible CSS classes.

```tsx
const { container, exactColors } = getStatusClasses("Applied")
// container: Tailwind utility classes
// exactColors: Exact hex values for fallback
```

#### `generateTailwindColors()`
Generates Tailwind configuration from accessible colors.

```tsx
// In tailwind.config.ts
import { generateTailwindColors } from './lib/constants/accessible-colors'

export default {
  theme: {
    extend: {
      colors: {
        ...generateTailwindColors()
      }
    }
  }
}
```

## Status System

### Application Status (`/lib/constants/application-status.ts`)
Type-safe status management with accessibility integration.

**Key Exports:**

#### `APPLICATION_STATUS`
Const enum with all valid status values.

```tsx
import { APPLICATION_STATUS } from '@/lib/constants/application-status'

const status = APPLICATION_STATUS.APPLIED // "Applied"
```

#### `ApplicationStatus` Type
TypeScript type for status values.

```tsx
import type { ApplicationStatus } from '@/lib/constants/application-status'

interface Props {
  status: ApplicationStatus
}
```

#### Type Guards
Runtime validation functions.

```tsx
import { isApplicationStatus, assertApplicationStatus } from '@/lib/constants/application-status'

// Type guard
if (isApplicationStatus(unknownValue)) {
  // unknownValue is now typed as ApplicationStatus
}

// Assertion (throws if invalid)
assertApplicationStatus(unknownValue) // throws if invalid
```

## Component Usage

### StatusBadge (`/components/status-badge.tsx`)
Accessible status badge with WCAG compliance.

```tsx
import { StatusBadge } from '@/components/status-badge'

<StatusBadge 
  status="Applied"
  className="mr-2"
  ariaLabel="Custom label"
/>
```

**Features:**
- WCAG AA color compliance
- Type-safe status validation
- Screen reader support
- Keyboard navigation
- Development warnings for invalid status

## Testing

### Accessibility Tests (`/__tests__/accessibility/`)
Comprehensive test suite for accessibility compliance.

**Run Tests:**
```bash
npm run test:a11y
```

**Test Coverage:**
- Component accessibility (41 tests)
- Page structure validation
- Keyboard navigation
- Screen reader compatibility
- Color contrast validation
- Focus management

## Best Practices

### Development Guidelines

1. **Always use status constants:**
   ```tsx
   // Good
   import { APPLICATION_STATUS } from '@/lib/constants/application-status'
   const status = APPLICATION_STATUS.APPLIED
   
   // Bad
   const status = "applied"
   ```

2. **Leverage type guards:**
   ```tsx
   // Good
   if (isApplicationStatus(userInput)) {
     return <StatusBadge status={userInput} />
   }
   
   // Bad
   return <StatusBadge status={userInput as ApplicationStatus} />
   ```

3. **Use error boundaries:**
   ```tsx
   // Good
   <PageErrorBoundary>
     <ComplexComponent />
   </PageErrorBoundary>
   
   // Bad
   <ComplexComponent /> // No error handling
   ```

4. **Implement focus management:**
   ```tsx
   // Good
   const trapRef = useFocusTrap(isModalOpen)
   
   // Bad
   // Manual focus management without accessibility considerations
   ```

### Accessibility Checklist

- [ ] All interactive elements have minimum 44px touch targets
- [ ] Focus indicators meet 3:1 contrast ratio
- [ ] Status changes are announced to screen readers
- [ ] Keyboard navigation works without mouse
- [ ] Error states are properly announced
- [ ] Skip links are provided for navigation
- [ ] Color is not the only way to convey information
- [ ] All form fields have labels
- [ ] Headings follow proper hierarchy (h1 → h2 → h3)

## Browser Support

The accessibility system supports:
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Screen readers: NVDA, JAWS, VoiceOver

## Contributing

When adding new accessibility features:

1. Follow WCAG 2.1 AA guidelines
2. Add comprehensive tests
3. Update documentation
4. Test with screen readers
5. Validate keyboard navigation
6. Check color contrast ratios

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- [axe DevTools](https://www.deque.com/axe/devtools/)