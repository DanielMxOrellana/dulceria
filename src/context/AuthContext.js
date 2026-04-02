import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { getSupabaseClient } from "../lib/supabaseClient";
import { authApi } from "../services/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let supabase = null;
    try {
      supabase = getSupabaseClient();
    } catch (_err) {
      supabase = null;
    }

    const loadProfileSafe = async (nextUser) => {
      if (!nextUser?.id || !mounted) {
        if (mounted) setProfile(null);
        return;
      }

      try {
        const ensured = await authApi.ensureProfile(nextUser);
        if (!mounted) return;
        if (ensured) {
          setProfile(ensured);
          return;
        }

        const fromDb = await authApi.getProfile(nextUser.id);
        if (mounted) {
          setProfile(fromDb || null);
        }
      } catch (_err) {
        if (mounted) {
          setProfile(null);
        }
      }
    };

    const init = async () => {
      try {
        const currentSession = await authApi.getSession();
        if (!mounted) return;
        setSession(currentSession);
        const nextUser = currentSession?.user || null;
        setUser(nextUser);
        setProfile(null);
        void loadProfileSafe(nextUser);
      } catch (_err) {
        if (mounted) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const subscription = supabase
      ? supabase.auth.onAuthStateChange(async (_event, nextSession) => {
          if (!mounted) return;
          setSession(nextSession);
          const nextUser = nextSession?.user || null;
          setUser(nextUser);
          setProfile(null);
          void loadProfileSafe(nextUser);
        })
      : null;

    return () => {
      mounted = false;
      if (subscription?.data?.subscription) {
        subscription.data.subscription.unsubscribe();
      }
    };
  }, []);

  const handleSignIn = async ({ email, password }) => {
    const data = await authApi.signIn({ email, password });
    const nextSession = data?.session || (await authApi.getSession()) || null;
    const nextUser = nextSession?.user || data?.user || null;

    setSession(nextSession);
    setUser(nextUser);

    setProfile(null);
    if (nextUser?.id) {
      try {
        const ensured = await authApi.ensureProfile(nextUser);
        setProfile(ensured || (await authApi.getProfile(nextUser.id)) || null);
      } catch (_err) {
        setProfile(null);
      }
    }

    return data;
  };

  const handleSignUp = async ({ email, password, fullName, phone }) => {
    const data = await authApi.signUp({ email, password, fullName, phone });
    const nextSession = data?.session || (await authApi.getSession()) || null;
    const nextUser = nextSession?.user || data?.user || null;

    setSession(nextSession);
    setUser(nextUser);

    setProfile(null);
    if (nextUser?.id) {
      try {
        const ensured = await authApi.ensureProfile(nextUser);
        setProfile(ensured || (await authApi.getProfile(nextUser.id)) || null);
      } catch (_err) {
        setProfile(null);
      }
    }

    return data;
  };

  const handleSignOut = async () => {
    try {
      await authApi.signOut();
    } finally {
      setSession(null);
      setUser(null);
      setProfile(null);
    }
  };

  const accountName = useMemo(() => {
    const fromProfile = String(profile?.full_name || "").trim();
    if (fromProfile) return fromProfile;

    const fromMetadata = String(user?.user_metadata?.full_name || "").trim();
    if (fromMetadata) return fromMetadata;

    const email = String(user?.email || "").trim();
    if (email.includes("@")) return email.split("@")[0];

    return "Usuario";
  }, [profile, user]);

  const value = useMemo(
    () => ({
      session,
      user,
      profile,
      accountName,
      loading,
      signIn: handleSignIn,
      signUp: handleSignUp,
      signOut: handleSignOut,
      refreshProfile: async () => {
        if (!user?.id) return null;
        const next = await authApi.getProfile(user.id);
        setProfile(next || null);
        return next;
      },
    }),
    [accountName, loading, profile, session, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de AuthProvider");
  }
  return ctx;
}
