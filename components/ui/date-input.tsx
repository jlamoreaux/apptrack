"use client";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";
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
  compact?: boolean; // Icon-only button for tight spaces
}

/**
 * Enhanced date input with "Set to Today" button
 * 
 * @param showTodayButton - Show the "Today" button (default: true)
 * @param defaultToToday - If value is empty, default to today's date (default: false)
 * @param compact - Show icon-only button for tight spaces (default: false)
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
  compact = false,
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
    <div className="flex gap-2 w-full">
      <div className="flex-1 min-w-0">
        <Input
          id={id}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          disabled={disabled}
          className={`${className || ''} [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-datetime-edit-fields-wrapper]:p-0`}
          placeholder={placeholder}
        />
      </div>
      {showTodayButton && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSetToday}
          className={`flex-shrink-0 whitespace-nowrap ${compact ? 'px-2' : 'px-3'}`}
          aria-label="Set date to today"
          title="Set to today"
        >
          <Calendar className={`h-4 w-4 ${!compact ? 'mr-1.5' : ''}`} />
          {!compact && 'Today'}
        </Button>
      )}
    </div>
  );
}
