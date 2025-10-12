# Button Link Fixes

## Pattern to fix:
```tsx
// BAD - Button inside Link
<Link href="/path">
  <Button>Text</Button>
</Link>

// GOOD - Using asChild prop
<Button asChild>
  <Link href="/path">Text</Link>
</Button>
```

## Files that need fixing:
1. app/not-found.tsx
2. app/auth/error/page.tsx
3. components/navigation-client.tsx
4. components/navigation-static.tsx
5. components/traffic-source-banner.tsx
6. components/home-final-cta.tsx
7. app/dashboard/upgrade/page.tsx
8. And many more...

## Also fix onClick navigation:
```tsx
// BAD
<Button onClick={() => router.push("/path")}>Text</Button>

// GOOD
<Button asChild>
  <Link href="/path">Text</Link>
</Button>
```