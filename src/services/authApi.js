import { getSupabaseClient } from "../lib/supabaseClient";

function toMessage(error, fallback) {
  return error?.message || fallback;
}

const API_BASE_URL = String(process.env.REACT_APP_API_URL || "").trim();

function isSupabaseUnavailableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("supabase no esta configurado") || message.includes("failed to fetch") || message.includes("networkerror");
}


async function registerViaBackend({ email, password, fullName, phone }) {
  if (!API_BASE_URL) return null;

  const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, fullName, phone }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error || "No se pudo crear la cuenta";
    throw new Error(message);
  }

  return payload;
}

function getSupabaseClientSafe() {
  try {
    return getSupabaseClient();
  } catch (_err) {
    return null;
  }
}

function clearLocalSession() {
  localStorage.removeItem("dulceria_local_session_v1");
}

async function upsertUserProfile(user) {
  if (!user?.id) return null;

  const supabase = getSupabaseClientSafe();
  if (!supabase) return null;
  const payload = {
    id: user.id,
    email: user.email || "",
    full_name: String(user.user_metadata?.full_name || "").trim(),
    phone: String(user.user_metadata?.phone || "").trim(),
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from("user_profiles")
    .upsert(payload, { onConflict: "id" });

  if (upsertError) {
    // If user_profiles table is not ready yet, keep auth working and report setup need.
    if (String(upsertError.message || "").toLowerCase().includes("relation") || String(upsertError.code || "") === "42P01") {
      return null;
    }
    throw upsertError;
  }

  const { data, error: readError } = await supabase
    .from("user_profiles")
    .select("id,email,full_name,phone,created_at,updated_at")
    .eq("id", user.id)
    .maybeSingle();

  if (readError) {
    return null;
  }

  return data || null;
}

export const authApi = {
  async getSession() {
    const supabase = getSupabaseClientSafe();
    if (!supabase) {
      throw new Error("Supabase no esta configurado.");
    }

    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session || null;
    } catch (error) {
      throw new Error(toMessage(error, "No se pudo obtener la sesion"));
    }
  },

  async signUp({ email, password, fullName, phone }) {
    try {
      const registered = await registerViaBackend({ email, password, fullName, phone });
      if (registered?.ok) {
        return this.signIn({ email, password });
      }
    } catch (backendError) {
      const lower = String(backendError?.message || "").toLowerCase();
      if (lower.includes("ya esta registrado")) {
        throw new Error("Este correo ya esta registrado. Inicia sesion.");
      }
      if (!lower.includes("backend auth no configurado")) {
        throw backendError;
      }
    }

    const supabase = getSupabaseClientSafe();
    if (!supabase) {
      throw new Error("Supabase no esta configurado.");
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || "",
            phone: phone || "",
          },
        },
      });

      if (error) throw error;

      if (data.user) {
        await upsertUserProfile(data.user);
      }

      return data;
    } catch (error) {
      throw new Error(toMessage(error, "No se pudo crear la cuenta"));
    }
  },

  async signIn({ email, password }) {
    const supabase = getSupabaseClientSafe();
    if (!supabase) {
      throw new Error("Supabase no esta configurado.");
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      if (data.user) {
        await upsertUserProfile(data.user);
      }

      return data;
    } catch (error) {
      throw new Error(toMessage(error, "Correo o contrasena incorrectos"));
    }
  },

  async signOut() {
    const supabase = getSupabaseClientSafe();
    clearLocalSession();
    if (!supabase) return;

    // Local scope clears browser session immediately even with unstable network.
    const localResult = await supabase.auth.signOut({ scope: "local" });
    if (localResult?.error && !isSupabaseUnavailableError(localResult.error)) {
      throw new Error(toMessage(localResult.error, "No se pudo cerrar sesion"));
    }

    const globalResult = await supabase.auth.signOut();
    if (globalResult?.error && !isSupabaseUnavailableError(globalResult.error)) {
      throw new Error(toMessage(globalResult.error, "No se pudo cerrar sesion"));
    }
  },

  async getProfile(userId) {
    if (!userId) return null;
    const supabase = getSupabaseClientSafe();
    if (!supabase) {
      throw new Error("Supabase no esta configurado.");
    }

    const { data, error } = await supabase
      .from("user_profiles")
      .select("id,email,full_name,phone,created_at,updated_at")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      if (String(error.message || "").toLowerCase().includes("relation") || String(error.code || "") === "42P01") {
        return null;
      }
      throw new Error(toMessage(error, "No se pudo cargar el perfil"));
    }

    return data || null;
  },

  async ensureProfile(user) {
    return upsertUserProfile(user);
  },
};
