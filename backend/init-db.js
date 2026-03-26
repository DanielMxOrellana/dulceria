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

async function initDatabase() {
  console.log("Conectando a PostgreSQL...");
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        order_code VARCHAR(24) UNIQUE,
        customer_cedula VARCHAR(10),
        customer_name VARCHAR(100) NOT NULL,
        customer_email VARCHAR(100),
        customer_phone VARCHAR(20),
        customer_address VARCHAR(200),
        customer_city VARCHAR(100),
        customer_reference VARCHAR(250),
        delivery_date VARCHAR(50),
        delivery_type VARCHAR(20) DEFAULT 'domicilio',
        container_type VARCHAR(50) NOT NULL,
        container_name VARCHAR(100) NOT NULL,
        container_price DECIMAL(10, 2),
        notes VARCHAR(500),
        total DECIMAL(10, 2) NOT NULL,
        status VARCHAR(20) DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        candy_id INT,
        candy_name VARCHAR(100) NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        subtotal DECIMAL(10, 2) NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_extras (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        extra_name VARCHAR(120) NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        quantity INT NOT NULL DEFAULT 1,
        subtotal DECIMAL(10, 2) NOT NULL
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS order_status_history (
        id SERIAL PRIMARY KEY,
        order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        status VARCHAR(20) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_code VARCHAR(24)");
    await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_cedula VARCHAR(10)");
    await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_reference VARCHAR(250)");
    await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_address VARCHAR(200)");
    await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_city VARCHAR(100)");
    await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date VARCHAR(50)");
    await client.query("ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_type VARCHAR(20) DEFAULT 'domicilio'");
    await client.query("UPDATE orders SET order_code = CONCAT('PED-', LPAD(id::text, 8, '0')) WHERE order_code IS NULL");

    await client.query("CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_orders_customer_cedula ON orders(customer_cedula)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id)");
    await client.query("CREATE INDEX IF NOT EXISTS idx_order_extras_order_id ON order_extras(order_id)");

    await client.query("DROP VIEW IF EXISTS vw_admin_orders_full");
    await client.query("DROP VIEW IF EXISTS vw_admin_orders_summary");
    await client.query("DROP VIEW IF EXISTS vw_admin_orders_json");

    await client.query(`
      CREATE OR REPLACE VIEW vw_admin_orders_full AS
      SELECT
        o.id AS order_id,
        o.order_code,
        o.customer_cedula,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.customer_address,
        o.customer_city,
        o.customer_reference,
        o.delivery_date,
        o.delivery_type,
        o.container_type,
        o.container_name,
        o.container_price,
        o.notes,
        o.total,
        o.status,
        o.created_at,
        i.id AS item_id,
        i.candy_id,
        i.candy_name,
        i.unit_price,
        i.quantity,
        i.subtotal,
        e.id AS extra_id,
        e.extra_name,
        e.unit_price AS extra_unit_price,
        e.quantity AS extra_quantity,
        e.subtotal AS extra_subtotal
      FROM orders o
      LEFT JOIN order_items i ON i.order_id = o.id
      LEFT JOIN order_extras e ON e.order_id = o.id
    `);

    await client.query(`
      CREATE OR REPLACE VIEW vw_admin_orders_summary AS
      SELECT
        o.id AS order_id,
        o.order_code,
        o.customer_cedula,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.customer_address,
        o.customer_city,
        o.customer_reference,
        o.delivery_date,
        o.delivery_type,
        o.container_type,
        o.container_name,
        o.container_price,
        o.notes,
        o.total,
        o.status,
        o.created_at,
        COUNT(DISTINCT i.id) AS items_count,
        COALESCE(SUM(i.quantity), 0) AS items_units,
        COUNT(DISTINCT e.id) AS extras_count,
        COALESCE(SUM(e.subtotal), 0) AS extras_total
      FROM orders o
      LEFT JOIN order_items i ON i.order_id = o.id
      LEFT JOIN order_extras e ON e.order_id = o.id
      GROUP BY o.id
    `);

    await client.query(`
      CREATE OR REPLACE VIEW vw_admin_orders_json AS
      SELECT
        o.id AS order_id,
        o.order_code,
        o.customer_cedula,
        o.customer_name,
        o.customer_email,
        o.customer_phone,
        o.customer_address,
        o.customer_city,
        o.customer_reference,
        o.delivery_date,
        o.delivery_type,
        o.container_type,
        o.container_name,
        o.container_price,
        o.notes,
        o.total,
        o.status,
        o.created_at,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'item_id', i.id,
              'candy_id', i.candy_id,
              'candy_name', i.candy_name,
              'unit_price', i.unit_price,
              'quantity', i.quantity,
              'subtotal', i.subtotal
            )
          ) FILTER (WHERE i.id IS NOT NULL),
          '[]'::json
        ) AS items,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'extra_id', e.id,
              'name', e.extra_name,
              'unit_price', e.unit_price,
              'quantity', e.quantity,
              'subtotal', e.subtotal
            )
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'::json
        ) AS extras
      FROM orders o
      LEFT JOIN order_items i ON i.order_id = o.id
      LEFT JOIN order_extras e ON e.order_id = o.id
      GROUP BY o.id
    `);

    await client.query("COMMIT");
    console.log("Base de datos PostgreSQL inicializada correctamente");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

initDatabase()
  .then(() => {
    console.log("\nInicializacion completada");
    process.exit(0);
  })
  .catch((err) => {
    console.error("\nInicializacion fallo:", err.message);
    process.exit(1);
  });
