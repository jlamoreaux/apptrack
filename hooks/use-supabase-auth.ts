"use client";

import { useState, useEffect } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/lib/supabase";
import { dedupedGetJson, clearGetCache, getGetCacheEpoch } from "@/lib/utils/deduped-get";

export function useSupabaseAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        setUser(session?.user ?? null);

        if (session?.user) {
          await fetchProfile(session.user.id);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setUser(session?.user ?? null);

      if (session?.user) {
        await fetchProfile(session.user.id);
      } else {
        // Signed out: wipe the shared GET cache so a different user signing in
        // next can't be served this user's cached profile/onboarding data.
        clearGetCache();
        setProfile(null);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      // Deduped: many components mount this hook and Supabase fires an initial
      // auth event, so the raw fetch ran several times per load. See deduped-get.
      const startEpoch = getGetCacheEpoch();
      const { ok, body } = await dedupedGetJson("/api/auth/profile");
      // Auth turned over while this was in flight (sign-out, or a different user
      // signed in): the response belongs to the previous session — ignore it.
      if (getGetCacheEpoch() !== startEpoch) {
        return;
      }
      if (!ok) {
        return;
      }

      const profile = (body as { profile?: Profile } | null)?.profile;

      if (!profile) {
        return;
      }

      setProfile(profile);
    } catch (error) {
    }
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    try {
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
        return { success: false, error: error.message };
      }

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      setLoading(true);

      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: "An unexpected error occurred" };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setLoading(true);
      const { error } = await supabase.auth.signOut();
      if (error) {
      }
    } catch (error) {
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
  };
}
