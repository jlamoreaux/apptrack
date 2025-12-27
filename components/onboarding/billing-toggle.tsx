import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface BillingToggleProps {
  selectedBilling: "monthly" | "yearly";
  onToggle: (billing: "monthly" | "yearly") => void;
}

export function BillingToggle({ selectedBilling, onToggle }: BillingToggleProps) {
  return (
    <div className="flex justify-center mb-6 px-4 sm:px-0">
      <div className="bg-muted p-1 rounded-lg flex items-center">
        <Button
          variant={selectedBilling === "monthly" ? "default" : "ghost"}
          size="sm"
          onClick={() => onToggle("monthly")}
          className="text-xs sm:text-sm"
        >
          Monthly
        </Button>
        <Button
          variant={selectedBilling === "yearly" ? "default" : "ghost"}
          size="sm"
          onClick={() => onToggle("yearly")}
          className="text-xs sm:text-sm"
        >
          Yearly
          <Badge variant="secondary" className="ml-1 sm:ml-2 text-xs">
            Save 33%
          </Badge>
        </Button>
      </div>
    </div>
  );
}