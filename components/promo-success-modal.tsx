"use client";

import { CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PromoSuccessModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  message?: string;
}

export function PromoSuccessModal({
  open,
  onOpenChange,
  message = "Your free forever access has been activated!",
}: PromoSuccessModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <div className="mx-auto mb-4 p-3 bg-green-100 dark:bg-green-900/20 rounded-full w-fit">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <DialogTitle className="text-center text-xl">
            Success! 🎉
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {message}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
            <p className="font-semibold mb-2">What happens next:</p>
            <ul className="space-y-1">
              <li>• Any active subscriptions have been cancelled</li>
              <li>• Your promotional access has been activated</li>
              <li>• No payment information required</li>
              <li>• Enjoy all premium features included in your plan</li>
            </ul>
          </div>
          
          <p className="text-center text-sm text-muted-foreground">
            Redirecting to your dashboard...
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}