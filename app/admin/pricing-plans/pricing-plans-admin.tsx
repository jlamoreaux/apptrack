"use client";

import { useState, useTransition } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Save, Plus, Trash2, DollarSign, FileText, Crown } from "lucide-react";
import type { SubscriptionPlan } from "@/lib/supabase";

interface PricingPlansAdminProps {
  initialPlans: SubscriptionPlan[];
}

export function PricingPlansAdmin({ initialPlans }: PricingPlansAdminProps) {
  const [plans, setPlans] = useState(initialPlans);
  const [editingPlan, setEditingPlan] = useState<string | null>(null);
  const [editedData, setEditedData] = useState<Partial<SubscriptionPlan>>({});
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const handleEdit = (plan: SubscriptionPlan) => {
    setEditingPlan(plan.id);
    setEditedData({
      name: plan.name,
      description: plan.description,
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      features: plan.features || [],
      max_applications: plan.max_applications,
    });
  };

  const handleCancel = () => {
    setEditingPlan(null);
    setEditedData({});
  };

  const handleSave = async (planId: string) => {
    startTransition(async () => {
      try {
        const response = await fetch(`/api/admin/pricing-plans/${planId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(editedData),
        });

        if (!response.ok) {
          throw new Error("Failed to update plan");
        }

        const updatedPlan = await response.json();
        
        // Update local state
        setPlans(plans.map(p => p.id === planId ? updatedPlan : p));
        setEditingPlan(null);
        setEditedData({});
        
        toast({
          title: "Plan updated",
          description: "The pricing plan has been updated successfully.",
        });
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to update pricing plan. Please try again.",
          variant: "destructive",
        });
      }
    });
  };

  const handleFeatureChange = (index: number, value: string) => {
    const newFeatures = [...(editedData.features || [])];
    newFeatures[index] = value;
    setEditedData({ ...editedData, features: newFeatures });
  };

  const addFeature = () => {
    setEditedData({ 
      ...editedData, 
      features: [...(editedData.features || []), ""] 
    });
  };

  const removeFeature = (index: number) => {
    const newFeatures = [...(editedData.features || [])];
    newFeatures.splice(index, 1);
    setEditedData({ ...editedData, features: newFeatures });
  };

  const getPlanIcon = (planName: string) => {
    switch (planName) {
      case "Free":
        return <FileText className="h-5 w-5" />;
      case "AI Coach":
        return <Crown className="h-5 w-5 text-amber-600" />;
      case "Pro":
        return <DollarSign className="h-5 w-5 text-blue-600" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {plans.map((plan) => {
        const isEditing = editingPlan === plan.id;
        const data = isEditing ? editedData : plan;

        return (
          <Card key={plan.id} className={isEditing ? "ring-2 ring-primary" : ""}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getPlanIcon(plan.name)}
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <Badge variant={plan.is_active ? "default" : "secondary"}>
                    {plan.is_active ? "Active" : "Inactive"}
                  </Badge>
                  {plan.name === "Pro" && (
                    <Badge variant="outline">Grandfathered</Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {!isEditing && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(plan)}
                    >
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Description */}
              <div className="grid gap-2">
                <Label>Description</Label>
                {isEditing ? (
                  <Textarea
                    value={data.description || ""}
                    onChange={(e) => setEditedData({ ...editedData, description: e.target.value })}
                    rows={2}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                )}
              </div>

              {/* Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Monthly Price</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={data.price_monthly || 0}
                      onChange={(e) => setEditedData({ ...editedData, price_monthly: parseFloat(e.target.value) })}
                      disabled={plan.name === "Free"}
                    />
                  ) : (
                    <p className="text-sm font-medium">${plan.price_monthly}/month</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Yearly Price</Label>
                  {isEditing ? (
                    <Input
                      type="number"
                      value={data.price_yearly || 0}
                      onChange={(e) => setEditedData({ ...editedData, price_yearly: parseFloat(e.target.value) })}
                      disabled={plan.name === "Free"}
                    />
                  ) : (
                    <p className="text-sm font-medium">${plan.price_yearly}/year</p>
                  )}
                </div>
              </div>

              {/* Application Limit */}
              <div className="grid gap-2">
                <Label>Application Limit</Label>
                {isEditing ? (
                  <Input
                    type="number"
                    value={data.max_applications || -1}
                    onChange={(e) => setEditedData({ ...editedData, max_applications: parseInt(e.target.value) })}
                    placeholder="-1 for unlimited"
                  />
                ) : (
                  <p className="text-sm">
                    {plan.max_applications === -1 ? "Unlimited" : plan.max_applications}
                  </p>
                )}
              </div>

              {/* Features */}
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Features</Label>
                  {isEditing && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={addFeature}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add Feature
                    </Button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    {(data.features || []).map((feature, index) => (
                      <div key={index} className="flex items-center gap-2">
                        <Input
                          value={feature}
                          onChange={(e) => handleFeatureChange(index, e.target.value)}
                          placeholder="Enter feature description"
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          onClick={() => removeFeature(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {plan.features?.map((feature, index) => (
                      <li key={index} className="text-sm flex items-start gap-2">
                        <span className="text-muted-foreground">•</span>
                        <span className={feature.includes("(coming soon)") ? "text-muted-foreground" : ""}>
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Stripe IDs (read-only) */}
              {plan.name !== "Free" && (
                <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Stripe Monthly ID</Label>
                    <p className="text-xs font-mono bg-muted p-2 rounded">
                      {plan.stripe_monthly_price_id || "Not set"}
                    </p>
                  </div>
                  <div className="grid gap-2">
                    <Label className="text-xs text-muted-foreground">Stripe Yearly ID</Label>
                    <p className="text-xs font-mono bg-muted p-2 rounded">
                      {plan.stripe_yearly_price_id || "Not set"}
                    </p>
                  </div>
                </div>
              )}

              {/* Action buttons */}
              {isEditing && (
                <div className="flex items-center gap-2 pt-4">
                  <Button
                    onClick={() => handleSave(plan.id)}
                    disabled={isPending}
                  >
                    <Save className="h-4 w-4 mr-1" />
                    Save Changes
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isPending}
                  >
                    Cancel
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      <AlertDialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the pricing plan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // Handle delete
                setDeleteConfirmId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}