const express = require("express");
const http = require("http");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const { withConnection, query } = require("./db");
const { loadDulcesSeed } = require("./utils/loadDulcesSeed");

const ordersRouter = require("./routes/orders");
const inventoryRouter = require("./routes/inventory");
const customersRouter = require("./routes/customers");

const app = express();
const PORT = process.env.PORT || 4000;

const corsOrigin = (process.env.CORS_ORIGIN || "").trim();
const corsOptions = corsOrigin
  ? { origin: corsOrigin.split(",").map((v) => v.trim()).filter(Boolean) }
  : undefined;

app.use(cors(corsOptions));
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, service: "dulceria-backend" });
});

app.use("/api/orders", ordersRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/customers", customersRouter);

app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ ok: false, error: "Internal server error" });
});

async function createInventoryTableIfNotExists() {
  const schema = process.env.PGSCHEMA || "public";
  
  try {
    await withConnection(async (conn) => {
      // Verificar si existe la tabla
      const checkRows = await query(
        conn,
        `SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname = ? AND tablename = 'inventory'`,
        [schema]
      );

      if (checkRows.length === 0) {
        const createTableSQL = `
          CREATE TABLE ${schema}.inventory (
            candy_id INTEGER NOT NULL PRIMARY KEY,
            candy_name VARCHAR(255) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 100,
            price DECIMAL(10, 2) NOT NULL,
            available BOOLEAN NOT NULL DEFAULT TRUE,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;

        await query(conn, createTableSQL);
        console.log("Tabla inventory creada exitosamente.");
      }

      const countRows = await query(conn, `SELECT COUNT(*) AS TOTAL FROM ${schema}.inventory`);
      const total = Number((countRows[0] && (countRows[0].TOTAL ?? countRows[0].total)) || 0);
      if (total > 0) {
        return;
      }

      const dulces = loadDulcesSeed();
      const insertSQL = `
        INSERT INTO ${schema}.inventory 
        (candy_id, candy_name, quantity, price, available) 
        VALUES (?, ?, ?, ?, ?)
      `;

      for (const dulce of dulces) {
        await query(conn, insertSQL, [
          dulce.id,
          dulce.nombre,
          dulce.cantidad,
          dulce.precio,
          Boolean(dulce.disponible),
        ]);
      }

      console.log(`Inventario inicial cargado con ${dulces.length} dulces.`);
    });
  } catch (err) {
    console.warn(`Aviso INVENTORY: ${err.message}`);
  }
}

async function checkDbAndSchema() {
  const schema = process.env.PGSCHEMA || "public";
  const tablesToCheck = ["orders", "order_items"];

  await withConnection(async (conn) => {
    await query(conn, "SELECT 1 AS ONE");

    const placeholders = tablesToCheck.map(() => "?").join(",");
    const rows = await query(
      conn,
      `
        SELECT tablename
        FROM pg_catalog.pg_tables
        WHERE schemaname = ?
          AND tablename IN (${placeholders})
      `,
      [schema, ...tablesToCheck]
    );

    const existing = new Set(rows.map((r) => String(r.tablename || r.TABLENAME || "").toLowerCase()));
    const missing = tablesToCheck.filter((t) => !existing.has(t));

    if (missing.length > 0) {
      throw new Error(`Faltan tablas en esquema ${schema}: ${missing.join(", ")}`);
    }
  });
}

async function startServer() {
  try {
    await checkDbAndSchema();
    console.log("Conexion PostgreSQL y esquema de pedidos listos.");
    
    // Crear tabla de inventario si no existe
    await createInventoryTableIfNotExists();
  } catch (error) {
    console.warn(`Aviso PostgreSQL: ${error.message}`);
  }

  const server = http.createServer(app);

  server.on("error", (err) => {
    if (err && err.code === "EADDRINUSE") {
      console.warn(`Backend ya esta ejecutandose en http://localhost:${PORT}`);
      process.exit(0);
      return;
    }

    console.error("Error al iniciar backend:", err);
  });

  server.listen(PORT, () => {
    console.log(`Backend escuchando en http://localhost:${PORT}`);
  });
}

startServer();
