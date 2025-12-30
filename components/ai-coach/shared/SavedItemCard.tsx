"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Eye, Copy, Trash2 } from "lucide-react";

interface SavedItemCardProps {
  id: string;
  title: string;
  subtitle?: string;
  timestamp: string | Date;
  badge?: React.ReactNode;
  onSelect: () => void;
  onDelete: () => void;
  onCopy?: () => void;
  actions?: React.ReactNode;
  className?: string;
}

export const SavedItemCard: React.FC<SavedItemCardProps> = ({
  id,
  title,
  subtitle,
  timestamp,
  badge,
  onSelect,
  onDelete,
  onCopy,
  actions,
  className = "",
}) => {
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete();
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    onCopy?.();
  };

  const formattedDate = typeof timestamp === 'string'
    ? new Date(timestamp)
    : timestamp;

  // Format date safely with fallback
  const getFormattedDate = () => {
    try {
      if (!formattedDate || isNaN(formattedDate.getTime())) {
        return 'Date unavailable';
      }
      return format(formattedDate, "MMM d, yyyy 'at' h:mm a");
    } catch (error) {
      return 'Date unavailable';
    }
  };

  return (
    <div
      className={`p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer ${className}`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="font-medium">{title}</div>
          {subtitle && (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          )}
          <div className="text-xs text-muted-foreground mt-1">
            {getFormattedDate()}
          </div>
          {badge && <div className="mt-2">{badge}</div>}
        </div>
        <div className="flex gap-2">
          {actions || (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={onSelect}
                title="View"
              >
                <Eye className="h-4 w-4" />
              </Button>
              {onCopy && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  title="Copy"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                title="Delete"
              >
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};