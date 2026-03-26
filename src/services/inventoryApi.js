import { getSupabaseClient } from "../lib/supabaseClient";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";
const ORDERS_PROVIDER = (process.env.REACT_APP_ORDERS_PROVIDER || "api").toLowerCase();
const USE_SUPABASE = ORDERS_PROVIDER === "supabase";

function normalizeInventoryRow(row = {}) {
  const candyId = Number(row.candy_id ?? row.CANDY_ID ?? 0);
  const candyName = row.candy_name ?? row.CANDY_NAME ?? "";
  const quantity = Number(row.quantity ?? row.QUANTITY ?? 0);
  const price = Number(row.price ?? row.PRICE ?? 0);
  const available = Boolean(row.available ?? row.AVAILABLE ?? false);

  return {
    candy_id: candyId,
    CANDY_ID: candyId,
    candy_name: candyName,
    CANDY_NAME: candyName,
    quantity,
    QUANTITY: quantity,
    price,
    PRICE: price,
    available,
    AVAILABLE: available,
    updated_at: row.updated_at ?? row.UPDATED_AT ?? null,
    UPDATED_AT: row.updated_at ?? row.UPDATED_AT ?? null,
  };
}

export const inventoryApi = {
  // Validar contraseña admin (solo backend)
  authenticateAdmin: async (adminPassword) => {
    const res = await fetch(`${API_URL}/api/inventory/auth`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Password": adminPassword
      },
      body: JSON.stringify({ adminPassword })
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "No se pudo autenticar admin");
    }

    return res.json();
  },

  // Obtener inventario completo
  getInventory: async () => {
    if (USE_SUPABASE) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("inventory")
        .select("candy_id,candy_name,quantity,price,available,updated_at")
        .order("candy_id", { ascending: true });

      if (error) {
        throw new Error(error.message || "Error obteniendo inventario");
      }

      return (data || []).map(normalizeInventoryRow);
    }

    const res = await fetch(`${API_URL}/api/inventory`);
    if (!res.ok) throw new Error("Error obteniendo inventario");
    const data = await res.json();
    return data.inventory;
  },

  // Obtener un dulce específico
  getItem: async (id) => {
    if (USE_SUPABASE) {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from("inventory")
        .select("candy_id,candy_name,quantity,price,available,updated_at")
        .eq("candy_id", Number(id))
        .single();

      if (error) {
        throw new Error(error.message || "Dulce no encontrado");
      }

      return normalizeInventoryRow(data);
    }

    const res = await fetch(`${API_URL}/api/inventory/${id}`);
    if (!res.ok) throw new Error("Dulce no encontrado");
    const data = await res.json();
    return data.item;
  },

  // Actualizar cantidad de un dulce (Admin, validado en backend)
  updateInventory: async (id, quantity, available, adminPassword) => {
    const res = await fetch(`${API_URL}/api/inventory/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Password": adminPassword
      },
      body: JSON.stringify({ quantity, available })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Error actualizando inventario");
    }
    
    return res.json();
  },

  // Actualizar múltiples elementos (Admin, validado en backend)
  bulkUpdate: async (updates, adminPassword) => {
    const res = await fetch(`${API_URL}/api/inventory/bulk/update`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Admin-Password": adminPassword
      },
      body: JSON.stringify({ updates })
    });
    
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Error en actualización en lote");
    }
    
    return res.json();
  }
};
