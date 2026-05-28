"use client";

import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SupportForm } from "@/components/support/support-form";

interface SupportDialogProps {
  /** Optional trigger element; rendered inside a DialogTrigger when provided. */
  trigger?: ReactNode;
  /** Controlled open state. Omit to let the dialog manage its own state. */
  open?: boolean;
  /** Controlled open-change handler, required when using controlled `open`. */
  onOpenChange?: (open: boolean) => void;
}

export function SupportDialog({
  trigger,
  open,
  onOpenChange,
}: SupportDialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : uncontrolledOpen;

  function setOpen(next: boolean) {
    if (isControlled) {
      onOpenChange?.(next);
    } else {
      setUncontrolledOpen(next);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Contact support</DialogTitle>
          <DialogDescription>
            Tell us what's going on and we'll reply to your account email.
          </DialogDescription>
        </DialogHeader>
        <SupportForm source="nav" onDone={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
