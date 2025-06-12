"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-client";
import type { Profile } from "@/lib/supabase";

export function useSupabaseAuthDebug() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);

  const addDebugLog = (message: string) => {
    const timestamp = new Date().toISOString();
    const logMessage = `${timestamp}: ${message}`;
    setDebugLogs((prev) => [...prev, logMessage]);
  };

  useEffect(() => {
    addDebugLog("Starting auth initialization...");

    // Get initial session
    const getInitialSession = async () => {
      try {
        addDebugLog("Getting initial session...");

        const {
          data: { session },
        } = await supabase.auth.getSession();

        addDebugLog(`Initial session result: ${session ? "Found" : "None"}`);

        setUser(session?.user ?? null);

        if (session?.user) {
          addDebugLog(`User found: ${session.user.id}`);
          await fetchProfile(session.user.id);
        } else {
          addDebugLog("No user in session");
        }
      } catch (error) {
        addDebugLog(`Error getting initial session: ${error}`);
      } finally {
        addDebugLog("Setting loading to false");
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    addDebugLog("Setting up auth state listener...");
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      addDebugLog(
        `Auth state changed: ${event}, User: ${session?.user?.id || "None"}`
      );

      setUser(session?.user ?? null);

      if (session?.user) {
        addDebugLog(`Fetching profile for user: ${session.user.id}`);
        await fetchProfile(session.user.id);
      } else {
        addDebugLog("Clearing profile");
        setProfile(null);
      }

      addDebugLog("Auth state change complete, setting loading to false");
      setLoading(false);
    });

    return () => {
      addDebugLog("Cleaning up auth listener");
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      addDebugLog(`Starting profile fetch for user: ${userId}`);

      // Simple query without timeout first
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (error) {
        addDebugLog(
          `Profile fetch error: ${error.message} (Code: ${error.code})`
        );

        // If profile doesn't exist, that's okay for new users
        if (error.code === "PGRST116") {
          addDebugLog("Profile not found - this might be a new user");
        }
        return;
      }

      addDebugLog(`Profile fetched successfully: ${data.email}`);
      setProfile(data);
    } catch (error) {
      addDebugLog(`Profile fetch exception: ${error}`);
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
      addDebugLog(`Starting signup for: ${email}`);
      setLoading(true);

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
        },
      });

      if (error) {
        addDebugLog(`Signup error: ${error.message}`);
        return { success: false, error: error.message };
      }

      addDebugLog(`Signup successful for: ${email}`);
      return { success: true, user: data.user };
    } catch (error) {
      addDebugLog(`Signup exception: ${error}`);
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      addDebugLog(`Starting signin for: ${email}`);
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        addDebugLog(`Signin error: ${error.message}`);
        return { success: false, error: error.message };
      }

      addDebugLog(`Signin successful for: ${email}`);
      return { success: true, user: data.user };
    } catch (error) {
      addDebugLog(`Signin exception: ${error}`);
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      addDebugLog("Signin complete, setting loading to false");
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      addDebugLog("Starting signout");
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
        addDebugLog(`Signout error: ${error.message}`);
      } else {
        addDebugLog("Signout successful");
      }
    } catch (error) {
      addDebugLog(`Signout exception: ${error}`);
    } finally {
      setLoading(false);
    }
  };

  return {
    user,
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    debugLogs,
  };
}
