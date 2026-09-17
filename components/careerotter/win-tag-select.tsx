"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { WIN_TAG_OPTIONS, type WinTag } from "@/lib/constants/careerotter";

// Radix Select items cannot carry an empty value, so "no area" is a sentinel
// that maps back to "" for callers.
const NO_TAG = "none";

const TAG_LABEL: Record<WinTag, string> = Object.fromEntries(
  WIN_TAG_OPTIONS.map((o) => [o.value, o.label])
) as Record<WinTag, string>;

/**
 * The impact-area picker, shared by the capture bar and the wins log. Each
 * area lists what it is evidence of, so "Delivery" or "Craft" is never a guess.
 * `value` is "" for no area; `onValueChange` receives "" when it is cleared.
 */
export function WinTagSelect({
  value,
  onValueChange,
  disabled,
  placeholder = "Area (optional)",
  ariaLabel = "Impact area (optional)",
  className,
}: {
  value: string;
  onValueChange: (tag: string) => void;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <Select
      value={value || NO_TAG}
      onValueChange={(v) => onValueChange(v === NO_TAG ? "" : v)}
      disabled={disabled}
    >
      <SelectTrigger className={className} aria-label={ariaLabel}>
        {/* The trigger shows the label alone; the hint belongs in the list. */}
        <SelectValue placeholder={placeholder}>
          {value ? TAG_LABEL[value as WinTag] : placeholder}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NO_TAG} className="min-h-[44px]">
          <span className="text-muted-foreground">No area</span>
        </SelectItem>
        {WIN_TAG_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={o.value} textValue={o.label} className="min-h-[44px]">
            <span className="block">{o.label}</span>
            <span className="block text-xs text-muted-foreground">{o.hint}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
