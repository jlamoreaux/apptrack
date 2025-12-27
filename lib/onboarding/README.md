# Onboarding System Architecture

## Overview
A flexible, reusable onboarding system that can handle:
- Initial user onboarding flows
- Feature announcements for existing users
- Multiple UI patterns (tooltips, spotlights, modals)
- Progress tracking and persistence
- Easy configuration and updates

## Core Components

### 1. Flow Configuration (`flows.ts`)
Declarative configuration of onboarding flows with steps, triggers, and UI types.

### 2. Onboarding Context (`context.tsx`)
React context that manages:
- Current flow state
- Step navigation
- Progress tracking
- Flow completion

### 3. UI Components
- **Spotlight**: Highlights specific elements with overlay
- **Tooltip**: Contextual help attached to elements
- **Modal**: Full-screen or centered dialogs
- **Tour**: Multi-step guided walkthrough

### 4. Database Schema
Tracks user progress through flows:
- `user_onboarding`: Stores completion status per flow
- `user_onboarding_steps`: Detailed step progress

### 5. Hooks
- `useOnboarding`: Main hook for flow control
- `useOnboardingStep`: Hook for individual steps
- `useFeatureAnnouncement`: Hook for new feature notifications

## Usage Example

```tsx
// Define a flow
const NEW_USER_FLOW = {
  id: 'new-user',
  name: 'Welcome to AppTrack',
  triggers: ['first_login'],
  steps: [
    {
      id: 'welcome',
      type: 'modal',
      title: 'Welcome to AppTrack!',
      content: 'Let us show you around...',
      action: { label: 'Get Started', next: 'add-first-app' }
    },
    {
      id: 'add-first-app',
      type: 'spotlight',
      target: '[data-onboarding="add-application"]',
      title: 'Add Your First Application',
      content: 'Click here to track your first job application'
    }
  ]
}

// Use in component
function Dashboard() {
  const { currentStep, next, skip } = useOnboarding('new-user')
  
  return (
    <>
      {currentStep && <OnboardingStep step={currentStep} />}
      <YourContent />
    </>
  )
}
```

## Flow Types

### Initial Onboarding
For brand new users, showing core features.

### Feature Announcements
For existing users when new features are released.

### Re-engagement
For users who haven't completed certain actions.

## Configuration

Flows can be configured with:
- **Triggers**: When to show (first_login, feature_launch, etc.)
- **Conditions**: User properties or actions required
- **Persistence**: Whether to save progress
- **Dismissible**: Can user skip the flow
- **Priority**: Order when multiple flows are available