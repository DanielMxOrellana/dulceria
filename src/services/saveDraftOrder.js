import { getSupabaseClient } from '../lib/supabaseClient';
import { createOrder } from './ordersApi';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:4000';
const ORDERS_PROVIDER = (process.env.REACT_APP_ORDERS_PROVIDER || 'api').toLowerCase();
const USE_SUPABASE = ORDERS_PROVIDER === 'supabase';

function getSupabase() {
  return getSupabaseClient();
}

function normalizeOrderRow(row) {
  return {
    id: row.order_id || row.id,
    customerId: row.customer_id || null,
    userId: row.user_id || null,
    orderCode: row.order_code || null,
    customerCedula: row.customer_cedula || '',
    customerName: row.customer_name || '',
    customerEmail: row.customer_email || '',
    customerPhone: row.customer_phone || '',
    customerAddress: row.customer_address || '',
    customerCity: row.customer_city || '',
    customerReference: row.customer_reference || '',
    deliveryDate: row.delivery_date || '',
    deliveryTime: row.delivery_time || '',
    deliveryType: row.delivery_type || 'domicilio',
    containerType: row.container_type || '',
    containerName: row.container_name || '',
    containerPrice: Number(row.container_price || 0),
    notes: row.notes || '',
    total: Number(row.total || 0),
    status: row.status || 'pending',
    createdAt: row.created_at || null,
    items: Array.isArray(row.items)
      ? row.items.map((item) => ({
          id: item.item_id || item.id || null,
          candyId: item.candy_id || item.candyId || null,
          candyName: item.candy_name || item.candyName || '',
          unitPrice: Number(item.unit_price || item.unitPrice || 0),
          quantity: Number(item.quantity || 0),
          subtotal: Number(item.subtotal || 0),
        }))
      : [],
    extras: Array.isArray(row.extras)
      ? row.extras.map((extra) => ({
          id: extra.extra_id || extra.id || null,
          name: extra.name || extra.extra_name || '',
          unitPrice: Number(extra.unit_price || extra.unitPrice || 0),
          quantity: Number(extra.quantity || 0),
          subtotal: Number(extra.subtotal || 0),
        }))
      : [],
  };
}

async function parseApiResponse(response) {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    return response.json();
  }

  const raw = await response.text();
  const snippet = raw.slice(0, 120).replace(/\s+/g, ' ');
  throw new Error(
    `Respuesta invalida del servidor (${response.status}). Revisa REACT_APP_API_URL (${API_BASE}). Detalle: ${snippet}`
  );
}

// Guarda o actualiza un pedido en estado borrador/pendiente.
export async function saveDraftOrder(orderPayload) {
  if (USE_SUPABASE) {
    const supabase = getSupabase();
    let orderId = orderPayload.id || null;
    let resultOrder = null;

    if (orderId) {
      const { error } = await supabase
        .from('orders')
        .update({
          ...orderPayload,
          status: orderPayload.status || 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId);

      if (error) throw new Error(error.message || 'No se pudo actualizar el pedido');
    } else {
      resultOrder = await createOrder(orderPayload);
      orderId = resultOrder.id;
    }

    if (!resultOrder) {
      const { data, error } = await supabase
        .from('vw_admin_orders_json')
        .select('*')
        .eq('order_id', orderId)
        .single();

      if (error) throw new Error(error.message || 'No se pudo obtener el pedido actualizado');
      resultOrder = normalizeOrderRow(data);
    }

    return resultOrder;
  }

  const url = orderPayload.id
    ? `${API_BASE}/api/orders/${orderPayload.id}`
    : `${API_BASE}/api/orders`;
  const method = orderPayload.id ? 'PUT' : 'POST';

  const response = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderPayload),
  });

  const data = await parseApiResponse(response);
  if (!response.ok || !data.ok) {
    throw new Error(data.error || 'No se pudo guardar el borrador de pedido');
  }

  return data.order;
}
