import { Badge } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Applied":
        return "bg-primary text-white border-primary"
      case "Interview Scheduled":
        return "bg-secondary text-white border-secondary"
      case "Interviewed":
        return "bg-secondary text-white border-secondary"
      case "Offer":
        return "bg-green-600 text-white border-green-600"
      case "Rejected":
        return "bg-accent text-white border-accent"
      default:
        return "bg-muted text-foreground border-muted"
    }
  }

  return <Badge className={`${getStatusColor(status)} font-medium`}>{status}</Badge>
}
