import { getSupabaseClient } from "../lib/supabaseClient";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:4000";
const ORDERS_PROVIDER = (process.env.REACT_APP_ORDERS_PROVIDER || "api").toLowerCase();
const USE_SUPABASE = ORDERS_PROVIDER === "supabase";

function normalizeOrderRow(row) {
  return {
    id: row.order_id || row.id,
    customerId: row.customer_id || null,
    orderCode: row.order_code || null,
    customerCedula: row.customer_cedula || "",
    customerName: row.customer_name || "",
    customerEmail: row.customer_email || "",
    customerPhone: row.customer_phone || "",
    customerAddress: row.customer_address || "",
    customerCity: row.customer_city || "",
    customerReference: row.customer_reference || "",
    deliveryDate: row.delivery_date || "",
    deliveryType: row.delivery_type || "domicilio",
    containerType: row.container_type || "",
    containerName: row.container_name || "",
    containerPrice: Number(row.container_price || 0),
    notes: row.notes || "",
    total: Number(row.total || 0),
    status: row.status || "pending",
    createdAt: row.created_at || null,
    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          id: item.item_id || item.id || null,
          candyId: item.candy_id || item.candyId || null,
          candyName: item.candy_name || item.candyName || "",
          unitPrice: Number(item.unit_price || item.unitPrice || 0),
          quantity: Number(item.quantity || 0),
          subtotal: Number(item.subtotal || 0),
        }))
      : [],
    extras: Array.isArray(row.extras)
      ? row.extras.map((extra) => ({
          id: extra.extra_id || extra.id || null,
          name: extra.name || extra.extra_name || "",
          unitPrice: Number(extra.unit_price || extra.unitPrice || 0),
          quantity: Number(extra.quantity || 0),
          subtotal: Number(extra.subtotal || 0),
        }))
      : [],
  };
}

function getSupabase() {
  return getSupabaseClient();
}

async function parseApiResponse(response) {
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    return response.json();
  }

  const raw = await response.text();
  const snippet = raw.slice(0, 120).replace(/\s+/g, " ");
  throw new Error(
    `Respuesta invalida del servidor (${response.status}). Revisa REACT_APP_API_URL (${API_BASE}). Detalle: ${snippet}`
  );
}

export async function createOrder(orderPayload) {
  if (USE_SUPABASE) {
    const supabase = getSupabase();
    let customerId = null;
    const requestedByCandyId = new Map();

    for (const item of orderPayload.items || []) {
      const candyId = Number(item.candyId);
      const qty = Number(item.quantity || 0);
      if (!candyId || qty <= 0) {
        continue;
      }

      requestedByCandyId.set(candyId, (requestedByCandyId.get(candyId) || 0) + qty);
    }

    const candyIds = Array.from(requestedByCandyId.keys());
    const stockSnapshot = new Map();

    if (candyIds.length > 0) {
      const { data: inventoryRows, error: inventoryError } = await supabase
        .from("inventory")
        .select("candy_id,quantity,available")
        .in("candy_id", candyIds);

      if (inventoryError) {
        throw new Error(inventoryError.message || "No se pudo verificar inventario");
      }

      for (const row of inventoryRows || []) {
        stockSnapshot.set(Number(row.candy_id), {
          quantity: Number(row.quantity || 0),
          available: Boolean(row.available),
        });
      }

      for (const candyId of candyIds) {
        const current = stockSnapshot.get(candyId);
        const requested = requestedByCandyId.get(candyId) || 0;

        if (!current) {
          throw new Error(`Inventario no encontrado para candyId ${candyId}`);
        }

        if (!current.available || current.quantity < requested) {
          throw new Error(`Stock insuficiente para candyId ${candyId}. Disponible: ${current.quantity}`);
        }
      }
    }

    if (orderPayload.customerCedula) {
      const customerInput = {
        cedula: String(orderPayload.customerCedula || "").trim(),
        full_name: String(orderPayload.customerName || "").trim(),
        email: orderPayload.customerEmail || null,
        phone: orderPayload.customerPhone || null,
        address: orderPayload.customerAddress || null,
        city: orderPayload.customerCity || null,
        updated_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      };

      const { data: customerRow, error: customerError } = await supabase
        .from("customers")
        .upsert(customerInput, { onConflict: "cedula" })
        .select("id")
        .single();

      if (customerError) {
        throw new Error(customerError.message || "No se pudo guardar el perfil del cliente");
      }

      customerId = customerRow?.id || null;
    }

    const orderInput = {
      customer_id: customerId,
      customer_cedula: orderPayload.customerCedula || null,
      customer_name: orderPayload.customerName,
      customer_email: orderPayload.customerEmail || null,
      customer_phone: orderPayload.customerPhone || null,
      customer_address: orderPayload.customerAddress || null,
      customer_city: orderPayload.customerCity || null,
      customer_reference: orderPayload.customerReference || null,
      delivery_date: orderPayload.deliveryDate || null,
      delivery_type: orderPayload.deliveryType || "domicilio",
      container_type: orderPayload.containerType,
      container_name: orderPayload.containerName,
      container_price: Number(orderPayload.containerPrice || 0),
      notes: orderPayload.notes || null,
      total: Number(orderPayload.total || 0),
      status: orderPayload.status || "pending",
    };

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .insert(orderInput)
      .select("id, status, order_code")
      .single();

    if (orderError) {
      throw new Error(orderError.message || "No se pudo guardar el pedido");
    }

    const orderId = orderData.id;

    const itemRows = (orderPayload.items || []).map((item) => ({
      order_id: orderId,
      candy_id: item.candyId,
      candy_name: item.candyName,
      unit_price: Number(item.unitPrice || 0),
      quantity: Number(item.quantity || 1),
      subtotal: Number(item.subtotal || 0),
    }));

    if (itemRows.length > 0) {
      const { error: itemsError } = await supabase.from("order_items").insert(itemRows);
      if (itemsError) {
        throw new Error(itemsError.message || "No se pudieron guardar los items del pedido");
      }
    }

    const extraRows = (orderPayload.extras || []).map((extra) => ({
      order_id: orderId,
      extra_name: extra.name,
      unit_price: Number(extra.unitPrice || 0),
      quantity: Number(extra.quantity || 1),
      subtotal: Number(extra.subtotal || 0),
    }));

    if (extraRows.length > 0) {
      const { error: extrasError } = await supabase.from("order_extras").insert(extraRows);
      if (extrasError) {
        throw new Error(extrasError.message || "No se pudieron guardar los extras del pedido");
      }
    }

    const { error: historyError } = await supabase.from("order_status_history").insert({
      order_id: orderId,
      status: orderData.status || "pending",
    });

    if (historyError) {
      throw new Error(historyError.message || "No se pudo registrar el historial del pedido");
    }

    for (const [candyId, requested] of requestedByCandyId.entries()) {
      const current = stockSnapshot.get(candyId);
      const nextQty = Math.max(0, Number(current.quantity || 0) - Number(requested || 0));
      const { error: updateStockError } = await supabase
        .from("inventory")
        .update({
          quantity: nextQty,
          available: nextQty > 0,
          updated_at: new Date().toISOString(),
        })
        .eq("candy_id", candyId);

      if (updateStockError) {
        throw new Error(updateStockError.message || `No se pudo actualizar inventario para candyId ${candyId}`);
      }
    }

    const { data: fullOrder, error: fullOrderError } = await supabase
      .from("vw_admin_orders_json")
      .select("*")
      .eq("order_id", orderId)
      .single();

    if (fullOrderError) {
      return {
        id: orderId,
        status: orderData.status || "pending",
        orderCode: orderData.order_code || null,
      };
    }

    return normalizeOrderRow(fullOrder);
  }

  const response = await fetch(`${API_BASE}/api/orders`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderPayload),
  });

  const data = await parseApiResponse(response);

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "No se pudo guardar el pedido");
  }

  return data.order;
}

export async function getOrders() {
  if (USE_SUPABASE) {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from("vw_admin_orders_json")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message || "No se pudieron obtener pedidos");
    }

    return (data || []).map(normalizeOrderRow);
  }

  const response = await fetch(`${API_BASE}/api/orders`);
  const data = await parseApiResponse(response);

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "No se pudieron obtener pedidos");
  }

  return data.orders || [];
}

export async function updateOrderStatus(orderId, status, adminPassword) {
  const response = await fetch(`${API_BASE}/api/orders/${orderId}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Password": adminPassword,
    },
    body: JSON.stringify({ status }),
  });

  const data = await parseApiResponse(response);

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "No se pudo actualizar el estado del pedido");
  }

  return data.order;
}

export async function lookupCustomerByCedula(cedula) {
  if (USE_SUPABASE) {
    const supabase = getSupabase();
    const normalizedCedula = String(cedula || "").trim();
    const { data: customerData, error: customerError } = await supabase
      .from("customers")
      .select("full_name, email, phone, address, city")
      .eq("cedula", normalizedCedula)
      .maybeSingle();

    if (customerError) {
      throw new Error(customerError.message || "No se pudo consultar la cedula");
    }

    if (customerData) {
      return {
        fullName: customerData.full_name || "",
        email: customerData.email || "",
        phone: customerData.phone || "",
        address: customerData.address || "",
        city: customerData.city || "",
      };
    }

    const { data, error } = await supabase
      .from("orders")
      .select("customer_name, customer_email, customer_phone, customer_address, customer_city")
      .eq("customer_cedula", normalizedCedula)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "No se pudo consultar la cedula");
    }

    if (!data) {
      throw new Error("No se encontro cliente para esa cedula");
    }

    return {
      fullName: data.customer_name || "",
      email: data.customer_email || "",
      phone: data.customer_phone || "",
      address: data.customer_address || "",
      city: data.customer_city || "",
    };
  }

  const response = await fetch(`${API_BASE}/api/customers/cedula/${encodeURIComponent(cedula)}`);
  const data = await parseApiResponse(response);

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "No se pudo consultar la cedula");
  }

  return data.customer;
}

export async function validateOrderCode(orderCode) {
  if (USE_SUPABASE) {
    const supabase = getSupabase();
    const normalizedCode = String(orderCode || "").trim().toUpperCase();

    const { data, error } = await supabase
      .from("vw_admin_orders_json")
      .select("*")
      .eq("order_code", normalizedCode)
      .maybeSingle();

    if (error) {
      throw new Error(error.message || "No se pudo validar el codigo del pedido");
    }

    if (!data) {
      throw new Error("Codigo de pedido no encontrado");
    }

    return normalizeOrderRow(data);
  }

  const response = await fetch(`${API_BASE}/api/orders/validate-code/${encodeURIComponent(orderCode)}`);
  const data = await parseApiResponse(response);

  if (!response.ok || !data.ok) {
    throw new Error(data.error || "No se pudo validar el codigo del pedido");
  }

  return data.order;
}
