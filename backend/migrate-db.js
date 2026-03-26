#!/usr/bin/env node

const { Pool } = require("pg");
require("dotenv").config();

const pool = new Pool({
  host: process.env.PGHOST || "localhost",
  port: Number(process.env.PGPORT || 5432),
  database: process.env.PGDATABASE || "dulceria",
  user: process.env.PGUSER || "postgres",
  password: process.env.PGPASSWORD || "postgres",
  ssl: (process.env.PGSSLMODE || "disable") === "require" ? { rejectUnauthorized: false } : false,
});

async function migrateDatabase() {
  console.log("Conectando a PostgreSQL para migracion...");
  const client = await pool.connect();

  const alterQueries = [
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_code VARCHAR(24)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_cedula VARCHAR(10)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address VARCHAR(255)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_city VARCHAR(100)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_reference VARCHAR(250)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date VARCHAR(50)",
    "ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'domicilio'",
    "CREATE TABLE IF NOT EXISTS order_extras (id SERIAL PRIMARY KEY, order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE, extra_name VARCHAR(120) NOT NULL, unit_price DECIMAL(10,2) NOT NULL, quantity INT NOT NULL DEFAULT 1, subtotal DECIMAL(10,2) NOT NULL)",
    "CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code)",
    "CREATE INDEX IF NOT EXISTS idx_orders_customer_cedula ON orders(customer_cedula)",
    "CREATE INDEX IF NOT EXISTS idx_order_extras_order_id ON order_extras(order_id)",
    "UPDATE orders SET order_code = CONCAT('PED-', LPAD(id::text, 8, '0')) WHERE order_code IS NULL",
    "UPDATE orders SET status='pending' WHERE LOWER(status)='pendiente'",
    "UPDATE orders SET status='confirmed' WHERE LOWER(status)='aceptado'",
    "UPDATE orders SET status='rejected' WHERE LOWER(status)='rechazado'",
    "UPDATE orders SET status='delivered' WHERE LOWER(status)='entregado'",
    "UPDATE orders SET status='cancelled' WHERE LOWER(status)='cancelado'",
  ];

  try {
    for (const sql of alterQueries) {
      await client.query(sql);
    }
    console.log("Migracion completada - columnas verificadas en PostgreSQL");
  } finally {
    client.release();
    await pool.end();
  }
}

migrateDatabase()
  .then(() => {
    console.log("\nMigracion completada exitosamente");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nMigracion fallo:", err.message);
    process.exit(1);
  });
