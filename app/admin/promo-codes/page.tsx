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
import { Plus, Edit, Trash2, Copy, Users } from "lucide-react";

interface PromoCode {
  id: string;
  code: string;
  description: string;
  trial_days: number;
  plan_name: string;
  max_uses: number | null;
  used_count: number;
  active: boolean;
  expires_at: string | null;
  created_at: string;
}

export default function PromoCodesAdminPage() {
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingCode, setEditingCode] = useState<PromoCode | null>(null);

  // Form state for creating new promo codes
  const [newCode, setNewCode] = useState({
    code: "",
    description: "",
    trialDays: 90,
    planName: "AI Coach",
    maxUses: "",
    expiresAt: "",
  });

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

  const createPromoCode = async () => {
    try {
      setError(null);
      const response = await fetch("/api/admin/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: newCode.code,
          description: newCode.description,
          trialDays: newCode.trialDays,
          planName: newCode.planName,
          maxUses: newCode.maxUses ? parseInt(newCode.maxUses) : null,
          expiresAt: newCode.expiresAt || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to create promo code");
      }

      setSuccess(data.message);
      setNewCode({
        code: "",
        description: "",
        trialDays: 90,
        planName: "AI Coach",
        maxUses: "",
        expiresAt: "",
      });
      loadPromoCodes();
    } catch (err) {
      setError(String(err));
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

  if (loading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">Loading admin panel...</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Promo Codes Admin</h1>
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
                        {promo.expires_at && new Date(promo.expires_at) < new Date() && (
                          <Badge variant="destructive">Expired</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        {promo.description || "No description"}
                      </p>
                      
                      <div className="text-xs text-muted-foreground grid grid-cols-2 md:grid-cols-4 gap-2">
                        <span><strong>Plan:</strong> {promo.plan_name}</span>
                        <span><strong>Days:</strong> {promo.trial_days}</span>
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
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
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
          <Card>
            <CardHeader>
              <CardTitle>Create New Promo Code</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="code">Promo Code *</Label>
                  <Input
                    id="code"
                    value={newCode.code}
                    onChange={(e) => setNewCode({ ...newCode, code: e.target.value.toUpperCase() })}
                    placeholder="BETA2024"
                  />
                </div>
                
                <div>
                  <Label htmlFor="trialDays">Trial Days *</Label>
                  <Input
                    id="trialDays"
                    type="number"
                    value={newCode.trialDays}
                    onChange={(e) => setNewCode({ ...newCode, trialDays: parseInt(e.target.value) || 90 })}
                  />
                </div>

                <div>
                  <Label htmlFor="planName">Plan Name *</Label>
                  <select
                    id="planName"
                    value={newCode.planName}
                    onChange={(e) => setNewCode({ ...newCode, planName: e.target.value })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="AI Coach">AI Coach</option>
                    <option value="Pro">Pro</option>
                  </select>
                </div>

                <div>
                  <Label htmlFor="maxUses">Max Uses (optional)</Label>
                  <Input
                    id="maxUses"
                    type="number"
                    value={newCode.maxUses}
                    onChange={(e) => setNewCode({ ...newCode, maxUses: e.target.value })}
                    placeholder="Leave empty for unlimited"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newCode.description}
                    onChange={(e) => setNewCode({ ...newCode, description: e.target.value })}
                    placeholder="Description of this promo code..."
                  />
                </div>

                <div>
                  <Label htmlFor="expiresAt">Expires At (optional)</Label>
                  <Input
                    id="expiresAt"
                    type="datetime-local"
                    value={newCode.expiresAt}
                    onChange={(e) => setNewCode({ ...newCode, expiresAt: e.target.value })}
                  />
                </div>
              </div>

              <Button onClick={createPromoCode} className="w-full">
                <Plus className="h-4 w-4 mr-2" />
                Create Promo Code
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}