import Link from "next/link";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/status-badge";
import { ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { Application } from "@/types";

/**
 * Props for the presentation component
 */
interface ApplicationCardPresentationProps {
  /** Application data to display */
  application: Application;
  /** Formatted date string for accessibility */
  formattedDate: string;
  /** Number of days since application was submitted */
  daysSinceApplied: number;
  /** Whether the card is currently hovered */
  isHovered: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Whether edit functionality is available */
  showEdit: boolean;
  
  // Event handlers
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onClick: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onExternalLinkClick: (e: React.MouseEvent) => void;
  onEditClick: (e: React.MouseEvent) => void;
}

/**
 * Presentation component for ApplicationCard
 * Pure component responsible only for rendering UI
 */
export function ApplicationCardPresentation({
  application,
  formattedDate,
  daysSinceApplied,
  isHovered,
  className = '',
  showEdit,
  onMouseEnter,
  onMouseLeave,
  onClick,
  onKeyDown,
  onExternalLinkClick,
  onEditClick,
}: ApplicationCardPresentationProps) {
  return (
    <Link
      href={`/dashboard/application/${application.id}`}
      className={cn(
        // Base styles
        "block transition-all duration-200 rounded-lg border",
        
        // Interactive states
        "hover:border-primary/30 hover:bg-muted/30 hover:shadow-sm",
        "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        
        // Conditional styles
        isHovered 
          ? "border-primary/30 bg-muted/30 shadow-sm" 
          : "border-gray-200",
          
        // Additional classes
        className
      )}
      tabIndex={0}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={onClick}
      onKeyDown={onKeyDown}
      role="button"
      aria-label={`View details for ${application.role} position at ${application.company}. Status: ${application.status}. Applied ${daysSinceApplied} days ago.`}
      aria-describedby={`application-${application.id}-details`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 gap-3 sm:gap-4">
        <ApplicationCardContent
          application={application}
          formattedDate={formattedDate}
          onExternalLinkClick={onExternalLinkClick}
        />
        
        <ApplicationCardActions
          application={application}
          showEdit={showEdit}
          onEditClick={onEditClick}
        />
      </div>
    </Link>
  );
}

/**
 * Content section of the application card
 */
function ApplicationCardContent({
  application,
  formattedDate,
  onExternalLinkClick,
}: {
  application: Application;
  formattedDate: string;
  onExternalLinkClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div 
      className="space-y-1 flex-1 min-w-0"
      id={`application-${application.id}-details`}
    >
      <div className="flex items-center gap-2">
        <h3 
          className="font-semibold line-clamp-2 sm:truncate"
          id={`application-${application.id}-title`}
        >
          {application.role}
        </h3>
        {application.role_link && (
          <a
            href={application.role_link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1 rounded"
            onClick={onExternalLinkClick}
            aria-label={`Open external job posting for ${application.role} at ${application.company} in new tab`}
            tabIndex={0}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
      </div>
      <p 
        className="text-sm text-muted-foreground"
        aria-label={`Company: ${application.company}`}
      >
        {application.company}
      </p>
      <p 
        className="text-xs text-muted-foreground"
        aria-label={`Application date: ${formattedDate}`}
      >
        Applied: {application.date_applied
          ? new Date(application.date_applied).toLocaleDateString()
          : "Not specified"}
      </p>
    </div>
  );
}

/**
 * Actions section of the application card
 */
function ApplicationCardActions({
  application,
  showEdit,
  onEditClick,
}: {
  application: Application;
  showEdit: boolean;
  onEditClick: (e: React.MouseEvent) => void;
}) {
  return (
    <div 
      className="flex items-center justify-between sm:justify-end gap-2 sm:gap-3 w-full sm:w-auto sm:flex-shrink-0"
      role="group"
      aria-label="Application actions and status"
    >
      <div aria-label={`Application status: ${application.status}`}>
        <StatusBadge status={application.status} />
      </div>
      
      <div 
        className="flex space-x-2" 
        onClick={(e) => e.stopPropagation()}
        role="group"
        aria-label="Application actions"
      >
        {showEdit && (
          <Button
            size="sm"
            variant="outline"
            onClick={onEditClick}
            aria-label={`Edit application for ${application.role} at ${application.company}`}
            className="focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          >
            Edit
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          className="border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-1"
          aria-label={`View detailed information for ${application.role} at ${application.company}`}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            // This button is for visual consistency - the main navigation is handled by the Link
          }}
        >
          View
        </Button>
      </div>
    </div>
  );
}