"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Info } from "lucide-react";

interface PromoCodeFormProps {
  onSuccess: () => void;
  setError: (error: string | null) => void;
  setSuccess: (success: string | null) => void;
  editingCode?: any;
  onCancel?: () => void;
}

export function PromoCodeForm({ onSuccess, setError, setSuccess, editingCode, onCancel }: PromoCodeFormProps) {
  const [newCode, setNewCode] = useState({
    code: editingCode?.code || "",
    description: editingCode?.description || "",
    codeType: (editingCode?.code_type || "trial") as "trial" | "discount" | "free_forever",
    trialDays: editingCode?.trial_days ?? 90,
    applicablePlans: editingCode?.applicable_plans || ["AI Coach"],
    maxUses: editingCode?.max_uses?.toString() || "",
    expiresAt: editingCode?.expires_at ? new Date(editingCode.expires_at).toISOString().slice(0, 16) : "",
    stripeCouponId: editingCode?.stripe_coupon_id || "",
    stripePromotionCodeId: editingCode?.stripe_promotion_code_id || "",
    discountPercent: editingCode?.discount_percent?.toString() || "",
    discountAmount: editingCode?.discount_amount?.toString() || "",
    discountDuration: (editingCode?.discount_duration || "once") as "once" | "repeating" | "forever",
    discountDurationMonths: editingCode?.discount_duration_months?.toString() || "",
  });

  const availablePlans = ["Pro", "AI Coach"];

  const handlePlanToggle = (plan: string) => {
    setNewCode(prev => ({
      ...prev,
      applicablePlans: prev.applicablePlans.includes(plan)
        ? prev.applicablePlans.filter(p => p !== plan)
        : [...prev.applicablePlans, plan]
    }));
  };

  const savePromoCode = async () => {
    try {
      setError(null);
      const isEditing = !!editingCode;
      
      const requestBody = {
        ...(isEditing && { id: editingCode.id }),
        code: newCode.code,
        description: newCode.description,
        code_type: newCode.codeType,
        trial_days: newCode.codeType === 'free_forever' ? 36500 : newCode.trialDays, // 100 years for free_forever
        applicable_plans: newCode.applicablePlans,
        max_uses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
        expires_at: newCode.expiresAt || null,
        stripe_coupon_id: newCode.stripeCouponId || null,
        stripe_promotion_code_id: newCode.stripePromotionCodeId || null,
        discount_percent: newCode.discountPercent ? parseInt(newCode.discountPercent) : null,
        discount_amount: newCode.discountAmount ? parseInt(newCode.discountAmount) : null,
        discount_duration: newCode.codeType === 'discount' ? newCode.discountDuration : null,
        discount_duration_months: newCode.discountDurationMonths ? parseInt(newCode.discountDurationMonths) : null,
        ...(isEditing && { active: editingCode.active }), // Preserve active status when editing
      };
      
      const response = await fetch("/api/admin/promo-codes", {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEditing ? 'update' : 'create'} promo code`);
      }

      setSuccess(data.message || `Promo code ${isEditing ? 'updated' : 'created'} successfully!`);
      
      if (!isEditing) {
        // Reset form only when creating new
        setNewCode({
          code: "",
          description: "",
          codeType: "trial",
          trialDays: 90,
          applicablePlans: ["AI Coach"],
          maxUses: "",
          expiresAt: "",
          stripeCouponId: "",
          stripePromotionCodeId: "",
          discountPercent: "",
          discountAmount: "",
          discountDuration: "once",
          discountDurationMonths: "",
        });
      }
      
      onSuccess();
      if (onCancel) onCancel();
    } catch (err) {
      setError(String(err));
    }
  };

  const isEditing = !!editingCode;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{isEditing ? 'Edit Promo Code' : 'Create New Promo Code'}</CardTitle>
        <CardDescription>
          {isEditing ? 'Update the promo code details' : 'Create discount codes for marketing campaigns and special promotions'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Basic Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="code">Promo Code *</Label>
              <Input
                id="code"
                value={newCode.code}
                onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                placeholder="SUMMER2024"
                required
              />
            </div>

            <div>
              <Label htmlFor="codeType">Code Type *</Label>
              <Select
                value={newCode.codeType}
                onValueChange={(value: "trial" | "discount" | "free_forever") => 
                  setNewCode({ ...newCode, codeType: value })
                }
              >
                <SelectTrigger id="codeType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="trial">Free Trial</SelectItem>
                  <SelectItem value="discount">Discount</SelectItem>
                  <SelectItem value="free_forever">Premium Free (No Payment)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={newCode.description}
                onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                placeholder="Summer promotion - 20% off for new users"
                rows={2}
              />
            </div>
          </div>
        </div>

        {/* Applicable Plans */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Applicable Plans</h3>
          <div className="space-y-2">
            {availablePlans.map((plan) => (
              <div key={plan} className="flex items-center space-x-2">
                <Checkbox
                  id={`plan-${plan}`}
                  checked={newCode.applicablePlans.includes(plan)}
                  onCheckedChange={() => handlePlanToggle(plan)}
                />
                <Label htmlFor={`plan-${plan}`} className="cursor-pointer">
                  {plan}
                </Label>
              </div>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            Select which plans this code applies to. Leave all unchecked for all plans.
          </p>
        </div>

        {/* Discount Details (only for discount type) */}
        {newCode.codeType === 'discount' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Discount Details</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="discountPercent">Discount Percent</Label>
                <Input
                  id="discountPercent"
                  type="number"
                  min="0"
                  max="100"
                  value={newCode.discountPercent}
                  onChange={(e) => setNewCode({ ...newCode, discountPercent: e.target.value })}
                  placeholder="20"
                />
              </div>

              <div>
                <Label htmlFor="discountAmount">Or Fixed Amount (cents)</Label>
                <Input
                  id="discountAmount"
                  type="number"
                  min="0"
                  value={newCode.discountAmount}
                  onChange={(e) => setNewCode({ ...newCode, discountAmount: e.target.value })}
                  placeholder="500 (for $5.00)"
                />
              </div>

              <div>
                <Label htmlFor="discountDuration">Duration</Label>
                <Select
                  value={newCode.discountDuration}
                  onValueChange={(value: "once" | "repeating" | "forever") => 
                    setNewCode({ ...newCode, discountDuration: value })
                  }
                >
                  <SelectTrigger id="discountDuration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="repeating">Repeating</SelectItem>
                    <SelectItem value="forever">Forever</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newCode.discountDuration === 'repeating' && (
                <div>
                  <Label htmlFor="discountDurationMonths">Months</Label>
                  <Input
                    id="discountDurationMonths"
                    type="number"
                    min="1"
                    value={newCode.discountDurationMonths}
                    onChange={(e) => setNewCode({ ...newCode, discountDurationMonths: e.target.value })}
                    placeholder="3"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trial Details (only for trial types) */}
        {newCode.codeType === 'trial' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Trial Details</h3>
            <div>
              <Label htmlFor="trialDays">Trial Days</Label>
              <Input
                id="trialDays"
                type="number"
                min="1"
                value={newCode.trialDays}
                onChange={(e) => setNewCode({ ...newCode, trialDays: parseInt(e.target.value) || 30 })}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Number of days the trial lasts
              </p>
            </div>
          </div>
        )}

        {/* Free Forever Details */}
        {newCode.codeType === 'free_forever' && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold">Free Forever Details</h3>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                This gives permanent premium access without requiring payment. Perfect for:
              </p>
              <ul className="list-disc list-inside text-sm text-blue-900 dark:text-blue-100 mt-2 space-y-1">
                <li>Beta testers and early adopters</li>
                <li>Partners and influencers</li>
                <li>Customer service compensations</li>
                <li>Internal team members</li>
              </ul>
              <p className="text-xs text-blue-800 dark:text-blue-200 mt-2">
                ⚠️ Users can apply this code without entering credit card details
              </p>
            </div>
          </div>
        )}

        {/* Stripe Integration */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Stripe Integration</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stripeCouponId">Stripe Coupon ID</Label>
              <Input
                id="stripeCouponId"
                value={newCode.stripeCouponId}
                onChange={(e) => setNewCode({ ...newCode, stripeCouponId: e.target.value })}
                placeholder="coupon_ABC123"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Create in Stripe Dashboard → Coupons
              </p>
            </div>

            <div>
              <Label htmlFor="stripePromotionCodeId">Stripe Promotion Code ID</Label>
              <Input
                id="stripePromotionCodeId"
                value={newCode.stripePromotionCodeId}
                onChange={(e) => setNewCode({ ...newCode, stripePromotionCodeId: e.target.value })}
                placeholder="promo_XYZ789"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Optional: For customer-facing codes
              </p>
            </div>
          </div>
        </div>

        {/* Usage Limits */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold">Usage Limits</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="maxUses">Max Uses (optional)</Label>
              <Input
                id="maxUses"
                type="number"
                min="1"
                value={newCode.maxUses}
                onChange={(e) => setNewCode({ ...newCode, maxUses: e.target.value })}
                placeholder="100 (leave empty for unlimited)"
              />
            </div>

            <div>
              <Label htmlFor="expiresAt">Expiration Date (optional)</Label>
              <Input
                id="expiresAt"
                type="datetime-local"
                value={newCode.expiresAt}
                onChange={(e) => setNewCode({ ...newCode, expiresAt: e.target.value })}
              />
            </div>
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg flex gap-3">
          <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-900 dark:text-blue-100 space-y-1">
            <p className="font-semibold">Stripe Setup Required for Discounts:</p>
            <ol className="list-decimal list-inside space-y-1 text-xs">
              <li>Create coupon in Stripe Dashboard → Products → Coupons</li>
              <li>Copy the Coupon ID and paste above</li>
              <li>Optionally create a Promotion Code for customer-facing use</li>
            </ol>
          </div>
        </div>

        <div className="flex gap-4">
          <Button onClick={savePromoCode} className={isEditing ? "flex-1" : "w-full"}>
            {isEditing ? 'Update Promo Code' : 'Create Promo Code'}
          </Button>
          {isEditing && onCancel && (
            <Button onClick={onCancel} variant="outline" className="flex-1">
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}