const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const { withConnection, query } = require("../db");

const router = express.Router();
const schema = process.env.PGSCHEMA || "public";

let adminClient = null;

function getAdminClient() {
  if (adminClient) return adminClient;

  const supabaseUrl = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return adminClient;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

router.post("/register", async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const fullName = String(req.body?.fullName || "").trim();
  const phone = String(req.body?.phone || "").trim();

  if (!isValidEmail(email)) {
    return res.status(400).json({ ok: false, error: "Correo invalido." });
  }

  if (password.length < 6) {
    return res.status(400).json({ ok: false, error: "La contrasena debe tener al menos 6 caracteres." });
  }

  if (!fullName) {
    return res.status(400).json({ ok: false, error: "Nombre completo es requerido." });
  }

  const supabase = getAdminClient();
  if (!supabase) {
    return res.status(503).json({
      ok: false,
      error: "Backend auth no configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en backend/.env",
    });
  }

  try {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
        phone,
      },
    });

    if (error) {
      const lower = String(error.message || "").toLowerCase();
      if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
        return res.status(409).json({ ok: false, error: "Este correo ya esta registrado." });
      }

      return res.status(400).json({ ok: false, error: error.message || "No se pudo crear el usuario." });
    }

    const userId = data?.user?.id;
    if (!userId) {
      return res.status(500).json({ ok: false, error: "No se pudo recuperar el id de usuario." });
    }

    await withConnection(async (conn) => {
      await query(
        conn,
        `
          INSERT INTO ${schema}.user_profiles (id, email, full_name, phone, updated_at)
          VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE
          SET
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            phone = EXCLUDED.phone,
            updated_at = CURRENT_TIMESTAMP
        `,
        [userId, email, fullName, phone || null]
      );
    });

    return res.status(201).json({
      ok: true,
      user: {
        id: userId,
        email,
        fullName,
        phone,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || "Error interno registrando usuario." });
  }
});

module.exports = router;
