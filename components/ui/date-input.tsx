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
    <div className="flex gap-2">
      <Input
        id={id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        disabled={disabled}
        className={className}
        placeholder={placeholder}
      />
      {showTodayButton && !disabled && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleSetToday}
          className="flex-shrink-0"
          aria-label="Set date to today"
        >
          <Calendar className="h-4 w-4 mr-1" />
          Today
        </Button>
      )}
    </div>
  );
}
