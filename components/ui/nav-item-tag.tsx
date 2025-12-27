import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface NavItemTagProps {
  label: string;
  variant?: "new" | "pro" | "beta" | "experimental";
  expiresAt?: Date;
  className?: string;
}

export function NavItemTag({ label, variant = "new", expiresAt, className }: NavItemTagProps) {
  // Check if tag has expired
  if (expiresAt && new Date() > expiresAt) {
    return null;
  }

  const variantStyles = {
    new: "bg-green-500 text-white hover:bg-green-600",
    pro: "bg-purple-600 text-white hover:bg-purple-700",
    beta: "bg-blue-500 text-white hover:bg-blue-600",
    experimental: "bg-orange-500 text-white hover:bg-orange-600",
  };

  return (
    <Badge 
      className={cn(
        "ml-1.5 text-[10px] px-1 py-0 h-4 font-semibold uppercase tracking-wider",
        variantStyles[variant],
        className
      )}
    >
      {label}
    </Badge>
  );
}