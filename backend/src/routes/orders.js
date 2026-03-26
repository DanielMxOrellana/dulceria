const express = require("express");
const { withConnection, withTransaction, query } = require("../db");

const router = express.Router();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const schema = process.env.PGSCHEMA || "public";

const STATUS_MAP = {
  pendiente: "pending",
  aceptado: "confirmed",
  rechazado: "rejected",
  entregado: "delivered",
  cancelado: "cancelled",
};

const VALID_STATUSES = new Set(["pending", "confirmed", "rejected", "delivered", "cancelled"]);

function validateAdmin(req, res, next) {
  const password = req.headers["x-admin-password"] || req.body.adminPassword;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ ok: false, error: "Acceso denegado: contrasena de admin incorrecta" });
  }
  next();
}

function toNum(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeStatus(value, fallback = "pending") {
  const raw = String(value || "").trim().toLowerCase();
  const mapped = STATUS_MAP[raw] || raw || fallback;
  return VALID_STATUSES.has(mapped) ? mapped : fallback;
}

function normalizeItems(items = []) {
  return items
    .filter((item) => item && (item.candyId || item.candyName))
    .map((item) => {
      const quantity = Math.max(1, parseInt(item.quantity, 10) || 1);
      const unitPrice = toNum(item.unitPrice, 0);
      const subtotal = toNum(item.subtotal, unitPrice * quantity);

      return {
        candyId: Number(item.candyId),
        candyName: String(item.candyName || "Dulce"),
        unitPrice,
        quantity,
        subtotal,
      };
    });
}

function normalizeExtras(extras = []) {
  return extras
    .filter((x) => x && (x.name || x.extraName))
    .map((x) => {
      const quantity = Math.max(1, parseInt(x.quantity, 10) || 1);
      const name = String(x.name || x.extraName || "Extra");
      const unitPrice = toNum(x.unitPrice, 0);
      const subtotal = toNum(x.subtotal, unitPrice * quantity);
      return { name, quantity, unitPrice, subtotal };
    });
}

function buildOrderCode(orderId) {
  return `PED-${String(orderId).padStart(8, "0")}`;
}

router.post("/", async (req, res) => {
  const body = req.body || {};

  const customerCedula = String(body.customerCedula || "").trim();
  const customerName = String(body.customerName || "").trim();
  const customerEmail = String(body.customerEmail || "").trim();
  const customerPhone = String(body.customerPhone || "").trim();
  const customerAddress = String(body.customerAddress || "").trim();
  const customerCity = String(body.customerCity || "").trim();
  const customerReference = String(body.customerReference || "").trim();
  const deliveryDate = String(body.deliveryDate || "").trim();
  const deliveryType = String(body.deliveryType || "domicilio").trim();
  const containerType = String(body.containerType || "").trim();
  const containerName = String(body.containerName || "").trim();
  const containerPrice = toNum(body.containerPrice, 0);
  const notes = String(body.notes || "").trim();
  const status = normalizeStatus(body.status, "pending");

  const items = normalizeItems(body.items || []);
  const extras = normalizeExtras(body.extras || []);

  if (!/^\d{10}$/.test(customerCedula)) {
    return res.status(400).json({ ok: false, error: "customerCedula es requerido y debe tener 10 digitos" });
  }

  if (!customerName) {
    return res.status(400).json({ ok: false, error: "customerName es requerido" });
  }

  if (!customerPhone) {
    return res.status(400).json({ ok: false, error: "customerPhone es requerido" });
  }

  if (!/^[0-9-+\s()]{7,}$/.test(customerPhone)) {
    return res.status(400).json({ ok: false, error: "customerPhone es invalido" });
  }

  if (!customerAddress) {
    return res.status(400).json({ ok: false, error: "customerAddress es requerido" });
  }

  if (!customerCity) {
    return res.status(400).json({ ok: false, error: "customerCity es requerido" });
  }

  if (!containerType || !containerName) {
    return res.status(400).json({ ok: false, error: "containerType y containerName son requeridos" });
  }

  if (items.length === 0) {
    return res.status(400).json({ ok: false, error: "El pedido debe tener al menos un item" });
  }

  const itemTotalsByCandy = new Map();
  for (const item of items) {
    if (!Number.isInteger(item.candyId) || item.candyId <= 0) {
      return res.status(400).json({ ok: false, error: "Todos los items deben tener candyId valido" });
    }

    const prev = itemTotalsByCandy.get(item.candyId) || 0;
    itemTotalsByCandy.set(item.candyId, prev + item.quantity);
  }

  const itemsTotal = items.reduce((acc, it) => acc + it.subtotal, 0);
  const extrasTotal = extras.reduce((acc, ex) => acc + ex.subtotal, 0);
  const calculatedTotal = itemsTotal + extrasTotal + containerPrice;
  const total = toNum(body.total, calculatedTotal);

  try {
    const result = await withTransaction(async (conn) => {
      const candyIds = Array.from(itemTotalsByCandy.keys());
      const placeholders = candyIds.map(() => "?").join(",");

      const inventoryRows = await query(
        conn,
        `
          SELECT candy_id, quantity
          FROM ${schema}.inventory
          WHERE candy_id IN (${placeholders})
          FOR UPDATE
        `,
        candyIds
      );

      const inventoryById = new Map(
        inventoryRows.map((row) => [Number(row.CANDY_ID ?? row.candy_id), Number(row.QUANTITY ?? row.quantity)])
      );

      for (const [candyId, requestedQty] of itemTotalsByCandy.entries()) {
        if (!inventoryById.has(candyId)) {
          throw new Error(`Dulce ${candyId} no encontrado en inventario`);
        }

        const currentQty = inventoryById.get(candyId);
        if (currentQty < requestedQty) {
          throw new Error(`Stock insuficiente para dulce ${candyId}. Disponible: ${currentQty}`);
        }
      }

      for (const [candyId, requestedQty] of itemTotalsByCandy.entries()) {
        const currentQty = inventoryById.get(candyId);
        const nextQty = currentQty - requestedQty;

        await query(
          conn,
          `
            UPDATE ${schema}.inventory
            SET quantity = ?,
                available = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE candy_id = ?
          `,
          [nextQty, nextQty > 0, candyId]
        );
      }

      const customerRows = await query(
        conn,
        `
          INSERT INTO customers (
            cedula,
            full_name,
            email,
            phone,
            address,
            city,
            last_seen_at
          ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT (cedula) DO UPDATE
          SET
            full_name = EXCLUDED.full_name,
            email = EXCLUDED.email,
            phone = EXCLUDED.phone,
            address = EXCLUDED.address,
            city = EXCLUDED.city,
            last_seen_at = CURRENT_TIMESTAMP,
            updated_at = CURRENT_TIMESTAMP
          RETURNING id
        `,
        [
          customerCedula,
          customerName,
          customerEmail || null,
          customerPhone || null,
          customerAddress || null,
          customerCity || null,
        ]
      );

      const customerId = Number(customerRows?.[0]?.id || customerRows?.[0]?.ID);
      if (!customerId) {
        throw new Error("No se pudo recuperar el ID del cliente");
      }

      const inserted = await query(
        conn,
        `
          INSERT INTO orders (
            order_code,
            customer_id,
            customer_cedula,
            customer_name,
            customer_email,
            customer_phone,
            customer_address,
            customer_city,
            customer_reference,
            delivery_date,
            delivery_type,
            container_type,
            container_name,
            container_price,
            notes,
            total,
            status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING id
        `,
        [
          null,
          customerId,
          customerCedula,
          customerName,
          customerEmail,
          customerPhone,
          customerAddress,
          customerCity,
          customerReference,
          deliveryDate,
          deliveryType,
          containerType,
          containerName,
          containerPrice,
          notes,
          total,
          status,
        ]
      );

      const orderId = Number(inserted?.[0]?.id || inserted?.[0]?.ID);
      if (!orderId) {
        throw new Error("No se pudo recuperar el ID del pedido insertado");
      }

      const orderCode = buildOrderCode(orderId);
      await query(conn, "UPDATE orders SET order_code = ? WHERE id = ?", [orderCode, orderId]);

      const insertItemSql = `
        INSERT INTO order_items (
          order_id,
          candy_id,
          candy_name,
          unit_price,
          quantity,
          subtotal
        ) VALUES (?, ?, ?, ?, ?, ?)
      `;

      for (const item of items) {
        await query(conn, insertItemSql, [
          orderId,
          item.candyId,
          item.candyName,
          item.unitPrice,
          item.quantity,
          item.subtotal,
        ]);
      }

      const insertExtraSql = `
        INSERT INTO order_extras (
          order_id,
          extra_name,
          unit_price,
          quantity,
          subtotal
        ) VALUES (?, ?, ?, ?, ?)
      `;

      for (const ex of extras) {
        await query(conn, insertExtraSql, [
          orderId,
          ex.name,
          ex.unitPrice,
          ex.quantity,
          ex.subtotal,
        ]);
      }

      await query(
        conn,
        "INSERT INTO order_status_history (order_id, status) VALUES (?, ?)",
        [orderId, status]
      );

      return {
        id: orderId,
        orderCode,
        total,
        status,
        itemsCount: items.length,
        extrasCount: extras.length,
      };
    });

    return res.status(201).json({ ok: true, order: result });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/", async (_req, res) => {
  try {
    const data = await withConnection(async (conn) => {
      const orders = await query(
        conn,
        `
          SELECT
            id,
            order_code,
            customer_id,
            customer_cedula,
            customer_name,
            customer_email,
            customer_phone,
            customer_address,
            customer_city,
            customer_reference,
            delivery_date,
            delivery_type,
            container_type,
            container_name,
            container_price,
            notes,
            total,
            status,
            created_at
          FROM orders
          ORDER BY created_at DESC
          FETCH FIRST 200 ROWS ONLY
        `
      );

      if (orders.length === 0) {
        return [];
      }

      const orderIds = orders.map((o) => Number(o.ID ?? o.id));
      const placeholders = orderIds.map(() => "?").join(",");

      const items = await query(
        conn,
        `
          SELECT
            id,
            order_id,
            candy_id,
            candy_name,
            unit_price,
            quantity,
            subtotal
          FROM order_items
          WHERE order_id IN (${placeholders})
          ORDER BY id ASC
        `,
        orderIds
      );

      const extras = await query(
        conn,
        `
          SELECT
            id,
            order_id,
            extra_name,
            unit_price,
            quantity,
            subtotal
          FROM order_extras
          WHERE order_id IN (${placeholders})
          ORDER BY id ASC
        `,
        orderIds
      );

      return orders.map((order) => {
        const orderId = Number(order.ID ?? order.id);
        return {
          id: orderId,
          orderCode: order.ORDER_CODE ?? order.order_code,
          customerId: Number(order.CUSTOMER_ID ?? order.customer_id ?? 0) || null,
          customerCedula: order.CUSTOMER_CEDULA ?? order.customer_cedula,
          customerName: order.CUSTOMER_NAME ?? order.customer_name,
          customerEmail: order.CUSTOMER_EMAIL ?? order.customer_email,
          customerPhone: order.CUSTOMER_PHONE ?? order.customer_phone,
          customerAddress: order.CUSTOMER_ADDRESS ?? order.customer_address,
          customerCity: order.CUSTOMER_CITY ?? order.customer_city,
          customerReference: order.CUSTOMER_REFERENCE ?? order.customer_reference,
          deliveryDate: order.DELIVERY_DATE ?? order.delivery_date,
          deliveryType: order.DELIVERY_TYPE ?? order.delivery_type,
          containerType: order.CONTAINER_TYPE ?? order.container_type,
          containerName: order.CONTAINER_NAME ?? order.container_name,
          containerPrice: Number(order.CONTAINER_PRICE ?? order.container_price ?? 0),
          notes: order.NOTES ?? order.notes,
          total: Number(order.TOTAL ?? order.total ?? 0),
          status: order.STATUS ?? order.status,
          createdAt: order.CREATED_AT ?? order.created_at,
          items: items
            .filter((it) => Number(it.ORDER_ID ?? it.order_id) === orderId)
            .map((it) => ({
              id: it.ID ?? it.id,
              candyId: Number(it.CANDY_ID ?? it.candy_id),
              candyName: it.CANDY_NAME ?? it.candy_name,
              unitPrice: Number(it.UNIT_PRICE ?? it.unit_price ?? 0),
              quantity: Number(it.QUANTITY ?? it.quantity ?? 0),
              subtotal: Number(it.SUBTOTAL ?? it.subtotal ?? 0),
            })),
          extras: extras
            .filter((ex) => Number(ex.ORDER_ID ?? ex.order_id) === orderId)
            .map((ex) => ({
              id: ex.ID ?? ex.id,
              name: ex.EXTRA_NAME ?? ex.extra_name,
              unitPrice: Number(ex.UNIT_PRICE ?? ex.unit_price ?? 0),
              quantity: Number(ex.QUANTITY ?? ex.quantity ?? 0),
              subtotal: Number(ex.SUBTOTAL ?? ex.subtotal ?? 0),
            })),
        };
      });
    });

    return res.json({ ok: true, count: data.length, orders: data });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/validate-code/:code", async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  if (!code) {
    return res.status(400).json({ ok: false, error: "Codigo requerido" });
  }

  try {
    const rows = await withConnection((conn) =>
      query(
        conn,
        `
          SELECT id, order_code, status, customer_name, created_at
          FROM orders
          WHERE UPPER(order_code) = ?
          FETCH FIRST 1 ROWS ONLY
        `,
        [code]
      )
    );

    if (rows.length === 0) {
      return res.status(404).json({ ok: false, valid: false, error: "Codigo no encontrado" });
    }

    const row = rows[0];
    return res.json({
      ok: true,
      valid: true,
      order: {
        id: Number(row.ID ?? row.id),
        orderCode: row.ORDER_CODE ?? row.order_code,
        status: row.STATUS ?? row.status,
        customerName: row.CUSTOMER_NAME ?? row.customer_name,
        createdAt: row.CREATED_AT ?? row.created_at,
      },
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.get("/:id/history", validateAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ ok: false, error: "ID de pedido invalido" });
  }

  try {
    const rows = await withConnection((conn) =>
      query(
        conn,
        `
          SELECT id, order_id, status, created_at
          FROM order_status_history
          WHERE order_id = ?
          ORDER BY created_at ASC
        `,
        [orderId]
      )
    );

    return res.json({ ok: true, history: rows });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

router.put("/:id/status", validateAdmin, async (req, res) => {
  const orderId = Number(req.params.id);
  const nextStatus = normalizeStatus(req.body?.status, "");

  if (!Number.isInteger(orderId) || orderId <= 0) {
    return res.status(400).json({ ok: false, error: "ID de pedido invalido" });
  }

  if (!nextStatus) {
    return res.status(400).json({ ok: false, error: "status es requerido" });
  }

  try {
    const result = await withTransaction(async (conn) => {
      const existingRows = await query(
        conn,
        "SELECT id, status FROM orders WHERE id = ?",
        [orderId]
      );

      if (existingRows.length === 0) {
        throw new Error("Pedido no encontrado");
      }

      await query(conn, "UPDATE orders SET status = ? WHERE id = ?", [nextStatus, orderId]);
      await query(
        conn,
        "INSERT INTO order_status_history (order_id, status) VALUES (?, ?)",
        [orderId, nextStatus]
      );

      return {
        id: orderId,
        previousStatus: String(existingRows[0].STATUS || existingRows[0].status || ""),
        status: nextStatus,
      };
    });

    return res.json({ ok: true, order: result });
  } catch (error) {
    const message = String(error?.message || "");
    if (message === "Pedido no encontrado") {
      return res.status(404).json({ ok: false, error: message });
    }
    return res.status(500).json({ ok: false, error: message || "No se pudo actualizar el estado" });
  }
});

module.exports = router;
