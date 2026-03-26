const express = require("express");
const { withConnection, query } = require("../db");

const router = express.Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const schema = process.env.PGSCHEMA || "public";

// Middleware para validar contraseña de admin
const validateAdmin = (req, res, next) => {
  const password = req.headers["x-admin-password"] || req.body.adminPassword;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Acceso denegado: contraseña de admin incorrecta" });
  }
  next();
};

// POST /api/inventory/auth - Validar contraseña de admin
router.post("/auth", (req, res) => {
  const password = req.headers["x-admin-password"] || req.body.adminPassword;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Contraseña de admin incorrecta" });
  }

  return res.json({ ok: true, message: "Autenticacion correcta" });
});

// GET /api/inventory - Obtener inventario actual (público)
router.get("/", async (req, res) => {
  try {
    await withConnection(async (conn) => {
      const rows = await query(
        conn,
        `SELECT * FROM ${schema}.inventory ORDER BY candy_id`
      );
      res.json({ ok: true, inventory: rows });
    });
  } catch (err) {
    console.error("Error obteniendo inventario:", err);
    res.status(500).json({ ok: false, error: "Error obteniendo inventario" });
  }
});

// GET /api/inventory/:id - Obtener un dulce específico (público)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await withConnection(async (conn) => {
      const rows = await query(
        conn,
        `SELECT * FROM ${schema}.inventory WHERE candy_id = ?`,
        [id]
      );
      if (rows.length === 0) {
        return res.status(404).json({ ok: false, error: "Dulce no encontrado" });
      }
      res.json({ ok: true, item: rows[0] });
    });
  } catch (err) {
    console.error("Error obteniendo dulce:", err);
    res.status(500).json({ ok: false, error: "Error obteniendo dulce" });
  }
});

// PUT /api/inventory/bulk/update - Actualizar múltiples (ADMIN)
router.put("/bulk/update", validateAdmin, async (req, res) => {
  try {
    const { updates } = req.body; // Array de {id, quantity, available}

    if (!Array.isArray(updates)) {
      return res.status(400).json({ ok: false, error: "updates debe ser un array" });
    }

    const results = [];

    await withConnection(async (conn) => {
      for (const update of updates) {
        try {
          const { id, quantity, available } = update;

          if (!Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
            results.push({ id, ok: false, error: "Cantidad invalida" });
            continue;
          }

          const updateSQL = available !== undefined
            ? `UPDATE ${schema}.inventory SET quantity = ?, available = ?, updated_at = CURRENT_TIMESTAMP WHERE candy_id = ?`
            : `UPDATE ${schema}.inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE candy_id = ?`;

          const params = available !== undefined
            ? [Number(quantity), Boolean(available), id]
            : [Number(quantity), id];

          await query(conn, updateSQL, params);
          results.push({ id, ok: true });
        } catch (err) {
          results.push({ id: update.id, ok: false, error: err.message });
        }
      }
    });

    res.json({ ok: true, results });
  } catch (err) {
    console.error("Error actualizando inventario en lote:", err);
    res.status(500).json({ ok: false, error: "Error actualizando inventario en lote" });
  }
});

// PUT /api/inventory/:id - Actualizar cantidad (ADMIN)
router.put("/:id", validateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { quantity, available } = req.body;

    // Validación básica
    if (!Number.isInteger(Number(quantity)) || Number(quantity) < 0) {
      return res.status(400).json({ ok: false, error: "La cantidad no puede ser negativa" });
    }

    await withConnection(async (conn) => {
      // Verificar que existe
      const checkRows = await query(
        conn,
        `SELECT * FROM ${schema}.inventory WHERE candy_id = ?`,
        [id]
      );

      if (checkRows.length === 0) {
        return res.status(404).json({ ok: false, error: "Dulce no encontrado" });
      }

      // Actualizar
      const updateSQL = available !== undefined
        ? `UPDATE ${schema}.inventory SET quantity = ?, available = ?, updated_at = CURRENT_TIMESTAMP WHERE candy_id = ?`
        : `UPDATE ${schema}.inventory SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE candy_id = ?`;

      const params = available !== undefined
        ? [Number(quantity), Boolean(available), id]
        : [Number(quantity), id];

      await query(conn, updateSQL, params);

      res.json({ 
        ok: true, 
        message: `Cantidad actualizada: ${Number(quantity)} unidades`,
        item: { candy_id: id, quantity, available }
      });
    });
  } catch (err) {
    console.error("Error actualizando inventario:", err);
    res.status(500).json({ ok: false, error: "Error actualizando inventario" });
  }
});

module.exports = router;
