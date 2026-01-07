interface QuickTipsProps {
  tips: string[];
  show?: boolean;
}

/**
 * Mobile-only Quick Tips component for try pages.
 * Hidden on desktop where the "How It Works" section is visible.
 */
export function QuickTips({ tips, show = true }: QuickTipsProps) {
  if (!show) return null;

  return (
    <div className="sm:hidden mb-6 p-4 bg-muted/50 rounded-lg border">
      <p className="text-sm font-medium mb-2">Quick tips:</p>
      <ul className="text-sm text-muted-foreground space-y-1">
        {tips.map((tip, index) => (
          <li key={index}>{index + 1}. {tip}</li>
        ))}
      </ul>
    </div>
  );
}
