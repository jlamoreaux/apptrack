"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDateAsLocal } from "@/lib/utils/date";

interface DateInputProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  showTodayButton?: boolean;
  defaultToToday?: boolean;
}

/**
 * Enhanced date input with "Set to Today" button
 *
 * @param showTodayButton - Show the "Today" button (default: true)
 * @param defaultToToday - If value is empty, default to today's date (default: false)
 */
export function DateInput({
  id,
  value,
  onChange,
  required,
  disabled,
  className,
  placeholder,
  showTodayButton = true,
  defaultToToday = false,
}: DateInputProps) {
  const handleSetToday = () => {
    const today = formatDateAsLocal(new Date());
    onChange(today);
  };

  // Auto-set to today if defaultToToday is true and value is empty
  if (defaultToToday && !value && !disabled) {
    const today = formatDateAsLocal(new Date());
    // Use setTimeout to avoid state update during render
    setTimeout(() => onChange(today), 0);
  }

  return (
    <div className="flex gap-2 w-full items-center">
      <div className="flex-1 min-w-0">
        <Input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={`${className || ""} [&::-webkit-calendar-picker-indicator]:ml-auto [&::-webkit-datetime-edit-fields-wrapper]:p-0 flex flex-col`}
          placeholder={placeholder}
        />
      </div>
      {showTodayButton && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="default"
          onClick={handleSetToday}
          className="flex-shrink-0 whitespace-nowrap px-3"
          aria-label="Set date to today"
          title="Set to today"
        >
          Today
        </Button>
      )}
    </div>
  );
}
