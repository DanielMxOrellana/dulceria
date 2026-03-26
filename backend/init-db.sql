-- Script de inicializacion para DULCERIA PostgreSQL

CREATE TABLE IF NOT EXISTS customers (
  id SERIAL PRIMARY KEY,
  cedula VARCHAR(10) NOT NULL UNIQUE,
  full_name VARCHAR(100) NOT NULL,
  email VARCHAR(100),
  phone VARCHAR(20),
  address VARCHAR(200),
  city VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    order_code VARCHAR(24) UNIQUE,
  customer_id INT,
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
);

  ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS customer_id INT;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conname = 'fk_orders_customer_id'
    ) THEN
      ALTER TABLE orders
      ADD CONSTRAINT fk_orders_customer_id
      FOREIGN KEY (customer_id) REFERENCES customers(id);
    END IF;
  END $$;

  INSERT INTO customers (cedula, full_name, email, phone, address, city, last_seen_at)
  SELECT DISTINCT
    o.customer_cedula,
    COALESCE(NULLIF(o.customer_name, ''), CONCAT('Cliente ', RIGHT(o.customer_cedula, 4))),
    NULLIF(o.customer_email, ''),
    NULLIF(o.customer_phone, ''),
    NULLIF(o.customer_address, ''),
    NULLIF(o.customer_city, ''),
    COALESCE(o.created_at, CURRENT_TIMESTAMP)
  FROM orders o
  WHERE o.customer_cedula IS NOT NULL
    AND o.customer_cedula <> ''
  ON CONFLICT (cedula) DO UPDATE
  SET
    full_name = EXCLUDED.full_name,
    email = COALESCE(EXCLUDED.email, customers.email),
    phone = COALESCE(EXCLUDED.phone, customers.phone),
    address = COALESCE(EXCLUDED.address, customers.address),
    city = COALESCE(EXCLUDED.city, customers.city),
    last_seen_at = GREATEST(customers.last_seen_at, EXCLUDED.last_seen_at),
    updated_at = CURRENT_TIMESTAMP;

  UPDATE orders o
  SET customer_id = c.id
  FROM customers c
  WHERE o.customer_id IS NULL
    AND o.customer_cedula = c.cedula;

CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    candy_id INT,
    candy_name VARCHAR(100) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS order_extras (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    extra_name VARCHAR(120) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    subtotal DECIMAL(10, 2) NOT NULL
);

CREATE TABLE IF NOT EXISTS order_status_history (
    id SERIAL PRIMARY KEY,
    order_id INT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
CREATE INDEX IF NOT EXISTS idx_orders_customer_cedula ON orders(customer_cedula);
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_cedula ON customers(cedula);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_extras_order_id ON order_extras(order_id);

DROP VIEW IF EXISTS vw_admin_orders_full;
DROP VIEW IF EXISTS vw_admin_orders_summary;
DROP VIEW IF EXISTS vw_admin_orders_json;

CREATE OR REPLACE VIEW vw_admin_orders_full AS
SELECT
    o.id AS order_id,
    o.order_code,
  o.customer_id,
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
LEFT JOIN order_extras e ON e.order_id = o.id;

CREATE OR REPLACE VIEW vw_admin_orders_summary AS
SELECT
    o.id AS order_id,
    o.order_code,
  o.customer_id,
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
GROUP BY o.id;

CREATE OR REPLACE VIEW vw_admin_orders_json AS
SELECT
    o.id AS order_id,
    o.order_code,
  o.customer_id,
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
GROUP BY o.id;
