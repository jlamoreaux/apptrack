"use client";

import type React from "react";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { NavigationClient } from "@/components/navigation-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSupabaseAuth } from "@/hooks/use-supabase-auth";
import { useSupabaseApplications } from "@/hooks/use-supabase-applications";

export default function AddApplicationPage() {
  const { user, loading: authLoading } = useSupabaseAuth();
  const { addApplication } = useSupabaseApplications(user?.id || null);
  const [formData, setFormData] = useState({
    company: "",
    role: "",
    role_link: "",
    job_description: "",
    date_applied: "",
    status: "Applied",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await addApplication(formData);

    if (result.success) {
      router.push("/dashboard");
    } else {
      setError(result.error || "Failed to add application");
    }

    setLoading(false);
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <NavigationClient />
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center">
            <div className="text-center">Loading...</div>
          </div>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <NavigationClient />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Add New Application</CardTitle>
              <CardDescription>
                Track a new job application and its progress
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {error && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="company">Company Name</Label>
                    <Input
                      id="company"
                      value={formData.company}
                      onChange={(e) =>
                        setFormData({ ...formData, company: e.target.value })
                      }
                      placeholder="e.g. Google, Microsoft, Startup Inc"
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="role">Role Title</Label>
                    <Input
                      id="role"
                      value={formData.role}
                      onChange={(e) =>
                        setFormData({ ...formData, role: e.target.value })
                      }
                      placeholder="e.g. Senior Frontend Developer"
                      required
                      disabled={loading}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role_link">Job Posting Link</Label>
                  <Input
                    id="role_link"
                    type="url"
                    value={formData.role_link}
                    onChange={(e) =>
                      setFormData({ ...formData, role_link: e.target.value })
                    }
                    placeholder="https://company.com/careers/job-id"
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="job_description">
                    Job Description (Optional)
                    <span className="text-xs text-muted-foreground ml-2">
                      Save for AI features
                    </span>
                  </Label>
                  <Textarea
                    id="job_description"
                    value={formData.job_description}
                    onChange={(e) =>
                      setFormData({ ...formData, job_description: e.target.value })
                    }
                    placeholder="Paste the job description here to use with AI features like cover letter generation and interview prep..."
                    rows={6}
                    disabled={loading}
                    className="resize-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="date_applied">Date Applied</Label>
                    <Input
                      id="date_applied"
                      type="date"
                      value={formData.date_applied}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          date_applied: e.target.value,
                        })
                      }
                      required
                      disabled={loading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      value={formData.status}
                      onValueChange={(value) =>
                        setFormData({ ...formData, status: value })
                      }
                      disabled={loading}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Applied">Applied</SelectItem>
                        <SelectItem value="Interview Scheduled">
                          Interview Scheduled
                        </SelectItem>
                        <SelectItem value="Interviewed">Interviewed</SelectItem>
                        <SelectItem value="Offer">Offer</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button
                    type="submit"
                    className="w-full sm:flex-1 bg-secondary hover:bg-secondary/90"
                    disabled={loading}
                  >
                    {loading ? "Adding Application..." : "Add Application"}
                  </Button>
                  <Link href="/dashboard" className="w-full sm:w-auto">
                    <Button type="button" variant="outline" disabled={loading} className="w-full">
                      Cancel
                    </Button>
                  </Link>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
