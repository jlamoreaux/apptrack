"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tag, Loader2 } from "lucide-react";

interface DiscountCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApply: (code: string, codeType?: string) => void;
}

export function DiscountCodeModal({
  open,
  onOpenChange,
  onApply,
}: DiscountCodeModalProps) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ code: string; description: string } | null>(null);

  const handleApply = async () => {
    if (!code.trim()) {
      setError("Please enter a discount code");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Validate the code with the API
      const response = await fetch("/api/stripe/validate-promo", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      });

      const data = await response.json();

      if (data.valid) {
        // Show success briefly
        setSuccess({ code: data.code, description: data.description });
        
        // Pass the code and type to parent component
        setTimeout(() => {
          onApply(data.code, data.type);
          onOpenChange(false);
          setCode("");
          setSuccess(null);
          setError(null);
        }, 1500);
      } else {
        setError(data.error || "Invalid discount code");
      }
    } catch (err) {
      setError("Failed to validate discount code");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            Have a Discount Code?
          </DialogTitle>
          <DialogDescription>
            Enter your discount code below to apply it to your subscription.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="discount-code">Discount Code</Label>
            <Input
              id="discount-code"
              placeholder="ENTER-CODE-HERE"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  handleApply();
                }
              }}
              disabled={loading}
              className="uppercase"
            />
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}
            {success && (
              <div className="p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
                <p className="text-sm text-green-700 dark:text-green-400 font-medium">
                  ✓ {success.description}
                </p>
              </div>
            )}
          </div>
          
          <div className="text-sm text-muted-foreground">
            <p>• Discount codes are case-insensitive</p>
            <p>• The discount will be applied at checkout</p>
            <p>• Some restrictions may apply</p>
          </div>
        </div>
        
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button onClick={handleApply} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Applying...
              </>
            ) : (
              "Apply Code"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}