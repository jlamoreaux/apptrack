# Onboarding System Documentation

## Overview
The AppTrack onboarding system provides a flexible, reusable way to guide users through the application with:
- Initial onboarding flows for new users
- Feature announcements for existing users
- Multiple UI patterns (modals, spotlights, tooltips, banners)
- Progress tracking and persistence

## Setup

### 1. Database Setup
Run the onboarding schema to create the necessary tables:
```bash
./scripts/setup-onboarding.sh
```

Or manually:
```bash
npx supabase db push --file schemas/onboarding.sql
```

### 2. Install Dependencies
```bash
pnpm install
```

## How It Works

### Automatic Triggering
The onboarding automatically starts for new users when:
1. They log in for the first time
2. They have no existing applications
3. They haven't completed the onboarding flow

### Manual Testing
To test the onboarding flow as an existing user:
1. Delete your onboarding records from the `user_onboarding` table in Supabase
2. Delete all applications (or use a test account)
3. Refresh the dashboard

## Adding New Onboarding Flows

### 1. Define the Flow
Edit `/lib/onboarding/flows.ts`:

```typescript
export const MY_NEW_FLOW: OnboardingFlow = {
  id: 'my-new-feature',
  name: 'New Feature Introduction',
  version: 1,
  triggers: ['manual'],
  steps: [
    {
      id: 'intro',
      type: 'modal',
      title: 'Check out this new feature!',
      content: 'Description of the feature...',
      actions: [
        { label: 'Show Me', action: 'next' }
      ]
    },
    // Add more steps...
  ]
}

// Add to the flows array
export const ONBOARDING_FLOWS = [
  NEW_USER_FLOW,
  MY_NEW_FLOW, // Add here
  // ...
]
```

### 2. Add Target Elements
Add `data-onboarding` attributes to elements you want to highlight:

```tsx
<Button data-onboarding="my-feature-button">
  New Feature
</Button>
```

### 3. Trigger the Flow
Programmatically start a flow:

```tsx
const { startFlow } = useOnboarding()
startFlow('my-new-feature')
```

## Flow Types

### Modal
Full-screen or centered dialog boxes for important announcements:
```typescript
{
  type: 'modal',
  title: 'Welcome!',
  content: 'Introduction text...',
  image: '/images/welcome.svg' // Optional
}
```

### Spotlight
Highlights specific elements with an overlay:
```typescript
{
  type: 'spotlight',
  target: '[data-onboarding="element-id"]',
  title: 'Click here',
  position: 'bottom' // top, bottom, left, right
}
```

### Tooltip
Contextual help attached to elements:
```typescript
{
  type: 'tooltip',
  target: '[data-onboarding="element-id"]',
  title: 'Pro tip',
  content: 'Helpful information...'
}
```

### Banner
Top-of-page announcements:
```typescript
{
  type: 'banner',
  title: '🎉 New Feature!',
  content: 'Check out our latest update'
}
```

## Customization

### Styling
Onboarding styles are defined in `/app/globals.css`. Key classes:
- `.onboarding-highlight` - Pulsing animation for highlighted elements
- `.onboarding-overlay` - Background overlay
- `.onboarding-tooltip` - Tooltip positioning

### Conditions
Add conditions to show flows only to specific users:

```typescript
conditions: [
  {
    type: 'user_property',
    property: 'subscription_plan',
    value: 'pro'
  }
]
```

### Persistence
Control whether users can dismiss flows:
- `dismissible: true` - Users can skip the entire flow
- `skippable: true` - Users can skip individual steps
- `resetOnUpdate: true` - Reset progress when flow version changes

## Analytics Integration

Track onboarding events by extending the context:

```typescript
const { currentStep, nextStep } = useOnboarding()

const handleNext = async () => {
  // Track analytics event
  analytics.track('onboarding_step_completed', {
    step: currentStep.id,
    flow: currentFlow.id
  })
  
  await nextStep()
}
```

## Troubleshooting

### Onboarding Not Showing
1. Check browser console for errors
2. Verify database tables exist
3. Ensure user meets trigger conditions
4. Check that target elements have correct `data-onboarding` attributes

### Z-Index Issues
If onboarding elements appear behind other content:
1. Check z-index values in globals.css
2. Ensure no parent elements have conflicting z-index
3. Use the provided CSS classes for proper layering

### Performance
For better performance:
1. Lazy load images used in onboarding
2. Keep step content concise
3. Avoid complex animations in reduced-motion mode

## Best Practices

1. **Keep it Short**: Limit flows to 3-5 steps
2. **Be Contextual**: Show features when users need them
3. **Allow Skipping**: Always provide a way to exit
4. **Test Thoroughly**: Test on different screen sizes
5. **Track Completion**: Monitor analytics to improve flows
6. **Version Carefully**: Increment versions for major changes
7. **Document Changes**: Keep this documentation updated

## Future Enhancements

Potential improvements to consider:
- [ ] A/B testing different onboarding flows
- [ ] Video tutorials within onboarding
- [ ] Branching paths based on user choices
- [ ] Onboarding analytics dashboard
- [ ] Multi-language support
- [ ] Accessibility improvements (screen reader support)
- [ ] Mobile-specific onboarding flows