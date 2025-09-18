"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Copy, Users, ArrowLeft, Ticket, Gift } from "lucide-react";
import Link from "next/link";
import { PromoCodeForm } from "./PromoCodeForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PromoCode {
  id: string;
  code: string;
  description: string;
  code_type: "trial" | "discount" | "free_forever";
  trial_days: number;
  plan_name: string;
  applicable_plans?: string[];
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
  stripe_coupon_id?: string | null;
  stripe_promotion_code_id?: string | null;
  discount_percent?: number | null;
  discount_amount?: number | null;
  discount_duration?: string | null;
  discount_duration_months?: number | null;
  is_welcome_offer?: boolean;
}

export default function PromoCodesAdminPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  useEffect(() => {
    loadPromoCodes();
  }, []);

  const loadPromoCodes = async () => {
    try {
      const response = await fetch("/api/admin/promo-codes");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to load promo codes");
      }

      setPromoCodes(data.promoCodes);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };


  const togglePromoCode = async (id: string, active: boolean) => {
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, active }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update promo code");
      }

      loadPromoCodes();
    } catch (err) {
      setError(String(err));
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess(`Copied "${text}" to clipboard`);
    setTimeout(() => setSuccess(null), 3000);
  };

  const handleEdit = (code: PromoCode) => {
    setEditingCode(code);
    setIsEditDialogOpen(true);
  };

  const handleCloseEdit = () => {
    setEditingCode(null);
    setIsEditDialogOpen(false);
  };

  const toggleWelcomeOffer = async (id: string, isWelcomeOffer: boolean) => {
    try {
      const response = await fetch("/api/admin/promo-codes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, is_welcome_offer: isWelcomeOffer }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update welcome offer");
      }

      setSuccess(isWelcomeOffer 
        ? "Promo code set as welcome offer" 
        : "Welcome offer designation removed");
      loadPromoCodes();
    } catch (err) {
      setError(String(err));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="text-lg text-muted-foreground">Loading promo codes...</div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-4 mb-4">
          <Link href="/admin">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin Dashboard
            </Button>
          </Link>
        </div>
        
        <div className="flex items-center gap-2 mb-2">
          <Ticket className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Promo Codes</h1>
        </div>
        <p className="text-muted-foreground">
          Manage trial promo codes for beta testing and promotions
        </p>
      </div>

      {error && (
        <Alert className="mb-6 border-red-200 bg-red-50">
          <AlertDescription className="text-red-800">{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="mb-6 border-green-200 bg-green-50">
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="list" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="list">Manage Codes</TabsTrigger>
          <TabsTrigger value="create">Create New</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="space-y-4">
          <div className="grid gap-4">
            {promoCodes.map((promo) => (
              <Card key={promo.id}>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="text-lg font-mono font-bold bg-muted px-2 py-1 rounded">
                          {promo.code}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(promo.code)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Badge variant={promo.active ? "default" : "secondary"}>
                          {promo.active ? "Active" : "Inactive"}
                        </Badge>
                        {promo.is_welcome_offer && (
                          <Badge variant="default" className="bg-green-600">
                            Welcome Offer
                          </Badge>
                        )}
                        {promo.expires_at && new Date(promo.expires_at) < new Date() && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {promo.description || "No description"}
                      </p>
                      
                      <div className="text-xs text-muted-foreground space-y-1">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          <span><strong>Type:</strong> {promo.code_type}</span>
                          <span><strong>Plans:</strong> {promo.applicable_plans?.join(", ") || promo.plan_name}</span>
                          <span>
                            <strong>Usage:</strong> {promo.used_count}
                            {promo.max_uses ? `/${promo.max_uses}` : " (unlimited)"}
                          </span>
                          <span>
                            <strong>Expires:</strong>{" "}
                            {promo.expires_at
                              ? new Date(promo.expires_at).toLocaleDateString()
                              : "Never"}
                          </span>
                        </div>
                        {promo.code_type === 'discount' && (
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {promo.discount_percent && (
                              <span><strong>Discount:</strong> {promo.discount_percent}%</span>
                            )}
                            {promo.discount_duration && (
                              <span><strong>Duration:</strong> {promo.discount_duration} 
                                {promo.discount_duration_months ? ` (${promo.discount_duration_months} months)` : ''}
                              </span>
                            )}
                          </div>
                        )}
                        {promo.code_type === 'trial' && (
                          <div>
                            <span><strong>Trial Days:</strong> {promo.trial_days}</span>
                          </div>
                        )}
                        {(promo.stripe_coupon_id || promo.stripe_promotion_code_id) && (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-1 p-2 bg-muted/50 rounded">
                            {promo.stripe_coupon_id && (
                              <span className="font-mono text-xs">
                                <strong>Stripe Coupon:</strong> {promo.stripe_coupon_id}
                              </span>
                            )}
                            {promo.stripe_promotion_code_id && (
                              <span className="font-mono text-xs">
                                <strong>Stripe Promo:</strong> {promo.stripe_promotion_code_id}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      {promo.code_type === "discount" && promo.active && (
                        <Button
                          variant={promo.is_welcome_offer ? "secondary" : "outline"}
                          size="sm"
                          onClick={() => toggleWelcomeOffer(promo.id, !promo.is_welcome_offer)}
                          title={promo.is_welcome_offer ? "Remove as welcome offer" : "Set as welcome offer"}
                        >
                          <Gift className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(promo)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={promo.active}
                        onCheckedChange={(checked) => togglePromoCode(promo.id, checked)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {promoCodes.length === 0 && (
              <Card>
                <CardContent className="pt-6 text-center text-muted-foreground">
                  No promo codes found. Create your first one using the "Create New" tab.
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="create" className="space-y-4">
          <PromoCodeForm 
            onSuccess={loadPromoCodes}
            setError={setError}
            setSuccess={setSuccess}
          />
        </TabsContent>
      </Tabs>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Promo Code</DialogTitle>
            <DialogDescription>
              Update the promo code details below
            </DialogDescription>
          </DialogHeader>
          {editingCode && (
            <PromoCodeForm
              editingCode={editingCode}
              onSuccess={() => {
                loadPromoCodes();
                handleCloseEdit();
              }}
              onCancel={handleCloseEdit}
              setError={setError}
              setSuccess={setSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}