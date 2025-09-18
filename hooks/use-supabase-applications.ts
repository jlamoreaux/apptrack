"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Application, LinkedinProfile } from "@/lib/supabase";
import { trackStatusChange } from "@/lib/application-history";

export function useSupabaseApplications(userId: string | null) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchApplications = async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/applications?sortBy=created_at&sortOrder=desc", {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const { applications: data } = await response.json();
        setApplications(data || []);
      } else {
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [userId]);

  const addApplication = async (applicationData: {
    company: string;
    role: string;
    role_link?: string;
    date_applied: string;
    status?: string;
  }) => {
    if (!userId) return { success: false, error: "User not authenticated" };

    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          ...applicationData,
          status: applicationData.status || "Applied",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to add application" };
      }

      setApplications((prev) => [result.application, ...prev]);
      return { success: true, application: result.application };
    } catch (error) {
      return { success: false, error: "Failed to add application" };
    }
  };

  const updateApplication = async (
    id: string,
    updates: Partial<Application>
  ) => {
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to update application" };
      }

      setApplications((prev) =>
        prev.map((app) => (app.id === id ? result.application : app))
      );
      return { success: true, application: result.application };
    } catch (error) {
      return { success: false, error: "Failed to update application" };
    }
  };

  const deleteApplication = async (id: string) => {
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        return { success: false, error: result.error || "Failed to delete application" };
      }

      setApplications((prev) => prev.filter((app) => app.id !== id));
      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to delete application" };
    }
  };

  const getApplication = async (id: string): Promise<Application | null> => {
    try {
      const response = await fetch(`/api/applications/${id}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        return null;
      }

      const { application } = await response.json();
      return application;
    } catch (error) {
      return null;
    }
  };

  return {
    applications,
    loading,
    addApplication,
    updateApplication,
    deleteApplication,
    getApplication,
    refetch: fetchApplications,
  };
}

export function useLinkedinProfiles(applicationId: string | null) {
  const [profiles, setProfiles] = useState<LinkedinProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = async () => {
    if (!applicationId) {
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/applications/${applicationId}/linkedin`, {
        method: "GET",
        credentials: "include",
      });

      if (response.ok) {
        const { profiles } = await response.json();
        setProfiles(profiles || []);
      } else {
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfiles();
  }, [applicationId]);

  const addProfile = async (profileData: {
    profile_url: string;
    name?: string;
    title?: string;
  }) => {
    if (!applicationId)
      return { success: false, error: "Application ID required" };

    try {
      const response = await fetch(`/api/applications/${applicationId}/linkedin`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(profileData),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to add LinkedIn profile" };
      }

      setProfiles((prev) => [result.profile, ...prev]);
      return { success: true, profile: result.profile };
    } catch (error) {
      return { success: false, error: "Failed to add LinkedIn profile" };
    }
  };

  const deleteProfile = async (id: string) => {
    try {
      const response = await fetch(`/api/applications/${applicationId}/linkedin?profileId=${id}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!response.ok) {
        const result = await response.json();
        return { success: false, error: result.error || "Failed to delete LinkedIn profile" };
      }

      setProfiles((prev) => prev.filter((profile) => profile.id !== id));
      return { success: true };
    } catch (error) {
      return { success: false, error: "Failed to delete LinkedIn profile" };
    }
  };

  const updateProfile = async (id: string, updates: { notes?: string; name?: string; title?: string; company?: string }) => {
    try {
      const response = await fetch(`/api/applications/${applicationId}/linkedin?profileId=${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      const result = await response.json();

      if (!response.ok) {
        return { success: false, error: result.error || "Failed to update LinkedIn profile" };
      }

      setProfiles((prev) =>
        prev.map((profile) => (profile.id === id ? { ...profile, ...result.profile } : profile))
      );
      return { success: true, profile: result.profile };
    } catch (error) {
      return { success: false, error: "Failed to update LinkedIn profile" };
    }
  };

  return {
    profiles,
    loading,
    addProfile,
    deleteProfile,
    updateProfile,
    refetch: fetchProfiles,
  };
}
