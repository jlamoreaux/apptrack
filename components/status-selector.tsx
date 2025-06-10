"use client"

import { useState } from "react"
import { Check, ChevronDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"

const statusOptions = [
  { value: "Applied", label: "Applied", color: "bg-primary/20 text-primary border-primary/30" },
  {
    value: "Interview Scheduled",
    label: "Interview Scheduled",
    color: "bg-secondary/20 text-secondary border-secondary/30",
  },
  { value: "Interviewed", label: "Interviewed", color: "bg-secondary/30 text-secondary border-secondary/40" },
  { value: "Offer", label: "Offer", color: "bg-secondary/40 text-secondary-foreground border-secondary/50" },
  { value: "Rejected", label: "Rejected", color: "bg-accent/20 text-accent border-accent/30" },
]

interface StatusSelectorProps {
  currentStatus: string
  onStatusChange: (status: string) => void
  disabled?: boolean
}

export function StatusSelector({ currentStatus, onStatusChange, disabled }: StatusSelectorProps) {
  const [isUpdating, setIsUpdating] = useState(false)

  const handleStatusChange = async (newStatus: string) => {
    if (newStatus === currentStatus || disabled) return

    setIsUpdating(true)
    try {
      await onStatusChange(newStatus)
    } finally {
      setIsUpdating(false)
    }
  }

  const currentOption = statusOptions.find((option) => option.value === currentStatus)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-auto p-0 hover:bg-transparent" disabled={disabled || isUpdating}>
          <Badge
            className={`${currentOption?.color || "bg-muted text-muted-foreground"} cursor-pointer hover:opacity-80 flex items-center gap-1`}
          >
            {currentStatus}
            <ChevronDown className="h-3 w-3" />
          </Badge>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        {statusOptions.map((option) => (
          <DropdownMenuItem
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className="flex items-center justify-between"
          >
            <span>{option.label}</span>
            {currentStatus === option.value && <Check className="h-4 w-4" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
