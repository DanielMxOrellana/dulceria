const express = require("express");
const { withConnection, query } = require("../db");

const router = express.Router();

const simulatedCedulaDirectory = {
  "0102030405": "Juan Carlos Perez Mora",
  "1104680132": "Daniel Alejandro Orellana",
  "1717171717": "Maria Fernanda Castillo",
};

function buildFallbackName(cedula) {
  const suffix = cedula.slice(-4);
  return `Cliente ${suffix}`;
}

router.get("/cedula/:cedula", async (req, res) => {
  const cedula = String(req.params.cedula || "").trim();

  if (!/^\d{10}$/.test(cedula)) {
    return res.status(400).json({ ok: false, error: "Cedula invalida. Debe tener 10 digitos." });
  }

  try {
    const rows = await withConnection((conn) =>
      query(
        conn,
        `
          SELECT cedula, full_name, email, phone, address, city
          FROM customers
          WHERE cedula = ?
          FETCH FIRST 1 ROWS ONLY
        `,
        [cedula]
      )
    );

    if (rows.length > 0) {
      const row = rows[0];
      return res.json({
        ok: true,
        customer: {
          cedula: row.CEDULA ?? row.cedula,
          fullName: row.FULL_NAME ?? row.full_name,
          email: row.EMAIL ?? row.email,
          phone: row.PHONE ?? row.phone,
          address: row.ADDRESS ?? row.address,
          city: row.CITY ?? row.city,
          source: "database",
        },
      });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message || "No se pudo consultar clientes" });
  }

  // Fallback temporal si aun no existe perfil en la base.
  const fullName = simulatedCedulaDirectory[cedula] || buildFallbackName(cedula);

  return res.json({
    ok: true,
    customer: {
      cedula,
      fullName,
      source: simulatedCedulaDirectory[cedula] ? "directory" : "simulated",
    },
  });
});

module.exports = router;
