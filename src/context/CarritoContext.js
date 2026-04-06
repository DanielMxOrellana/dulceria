import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { createOrder } from '../services/ordersApi';

const CarritoContext = createContext();
const DRAFT_STORAGE_KEY = 'dulceria_carrito_draft_v1';
const FINALIZED_STORAGE_KEY = 'dulceria_pedidos_finalizados_v1';

function getStoredValue(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (_err) {
    return fallback;
  }
}

function setStoredValue(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (_err) {
    // Si el storage no está disponible, seguimos solo con estado en memoria.
  }
}

function isPedidoVacio(pedidoData) {
  return !pedidoData?.items?.length && !pedidoData?.contenedor;
}

function pedidoFromOrder(order) {
  return {
    contenedor: order?.containerType
      ? {
          tipo: order.containerType,
          data: {
            nombre: order.containerName || '',
            precio: Number(order.containerPrice || 0),
          },
        }
      : null,
    items: Array.isArray(order?.items)
      ? order.items.map((item) => ({
          dulce: {
            id: item.candyId,
            nombre: item.candyName,
            precio: Number(item.unitPrice || 0),
          },
          cantidad: Number(item.quantity || 0),
        }))
      : [],
    nota: order?.notes || order?.nota || '',
    id: order?.id || null,
  };
}

export const CarritoProvider = ({ children }) => {
  const { user } = useAuth();
  const [pedido, setPedido] = useState({
    contenedor: null, // { tipo, data }
    items: [],        // { dulce, cantidad }
    nota: '',
    id: null, // id del pedido en backend si existe
  });

  const [pedidosFinalizados, setPedidosFinalizados] = useState([]);
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function cargarPedidoPendiente() {
      if (!user?.id) {
        if (!cancelled) {
          setStorageReady(true);
        }
        return;
      }

      const storedDraft = getStoredValue(DRAFT_STORAGE_KEY, null);
      const draftMatchesUser = storedDraft?.userId ? String(storedDraft.userId) === String(user.id) : true;

      if (storedDraft?.pedido && draftMatchesUser && !isPedidoVacio(storedDraft.pedido)) {
        setPedido(storedDraft.pedido);
      }

      const storedFinalizados = getStoredValue(FINALIZED_STORAGE_KEY, []);
      const finalizedMatchesUser = Array.isArray(storedFinalizados)
        ? storedFinalizados.filter((item) => !item?.userId || String(item.userId) === String(user.id))
        : [];

      if (finalizedMatchesUser.length > 0) {
        setPedidosFinalizados(finalizedMatchesUser);
      }

      if (storedDraft?.pedido && draftMatchesUser && !isPedidoVacio(storedDraft.pedido)) {
        if (!cancelled) {
          setStorageReady(true);
        }
        return;
      }

      try {
        const { getOrders } = await import('../services/ordersApi');
        const pedidos = await getOrders({ userId: user.id });
        const pendiente = pedidos.find(p => String(p.status || '').toLowerCase() === 'pending');

        if (!cancelled && pendiente) {
          setPedido(pedidoFromOrder(pendiente));
        }
      } catch (err) {
        // Si el backend no responde, mantenemos lo que haya en storage o en memoria.
      } finally {
        if (!cancelled) {
          setStorageReady(true);
        }
      }
    }

    cargarPedidoPendiente();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!storageReady) return;
    setStoredValue(DRAFT_STORAGE_KEY, {
      userId: user?.id || null,
      pedido,
      updatedAt: new Date().toISOString(),
    });
  }, [pedido, storageReady, user?.id]);

  useEffect(() => {
    if (!storageReady) return;
    setStoredValue(FINALIZED_STORAGE_KEY, pedidosFinalizados);
  }, [pedidosFinalizados, storageReady]);

  const setContenedor = (tipo, data, options = {}) => {
    const { preserveItems = false } = options;
    setPedido(prev => {
      const nextPedido = {
        ...prev,
        contenedor: { tipo, data },
        items: preserveItems ? prev.items : [],
      };
      return nextPedido;
    });
  };

  const agregarDulce = (dulce, cantidad) => {
    setPedido(prev => {
      const existing = prev.items.find(i => i.dulce.id === dulce.id);
      let nextPedido;
      if (existing) {
        nextPedido = {
          ...prev,
          items: prev.items.map(i =>
            i.dulce.id === dulce.id ? { ...i, cantidad: i.cantidad + cantidad } : i
          )
        };
      } else {
        nextPedido = { ...prev, items: [...prev.items, { dulce, cantidad }] };
      }
      return nextPedido;
    });
  };

  const quitarDulce = (dulceId) => {
    setPedido(prev => {
      const nextPedido = { ...prev, items: prev.items.filter(i => i.dulce.id !== dulceId) };
      return nextPedido;
    });
  };

  const actualizarCantidad = (dulceId, cantidad) => {
    if (cantidad <= 0) {
      quitarDulce(dulceId);
      return;
    }
    setPedido(prev => {
      const nextPedido = {
        ...prev,
        items: prev.items.map(i => i.dulce.id === dulceId ? { ...i, cantidad } : i)
      };
      return nextPedido;
    });
  };

  const setNota = (nota) => setPedido(prev => {
    const nextPedido = { ...prev, nota };
    return nextPedido;
  });

  const totalDulces = pedido.items.reduce((acc, i) => acc + i.cantidad, 0);
  const subtotalDulces = pedido.items.reduce((acc, i) => acc + i.dulce.precio * i.cantidad, 0);
  const costoContenedor = pedido.contenedor?.data?.precio || 0;
  const total = subtotalDulces + costoContenedor;

  const limpiarPedido = () => {
    setPedido({ contenedor: null, items: [], nota: '', id: null });
  };

  const finalizarPedido = async ({
    customerCedula,
    customerName,
    customerEmail,
    customerPhone,
    customerAddress,
    customerCity,
    customerReference,
    deliveryDate,
    deliveryTime,
    deliveryType,
    extras,
  } = {}) => {
    const payload = {
      customerCedula: customerCedula || '',
      customerName: customerName || 'Cliente Web',
      customerEmail: customerEmail || '',
      customerPhone: customerPhone || '',
      customerAddress: customerAddress || '',
      customerCity: customerCity || '',
      customerReference: customerReference || '',
      deliveryDate: deliveryDate || '',
      deliveryTime: deliveryTime || '',
      deliveryType: deliveryType || 'domicilio',
      userId: user?.id || '',
      containerType: pedido.contenedor?.tipo || '',
      containerName: pedido.contenedor?.data?.nombre || '',
      containerPrice: costoContenedor,
      notes: pedido.nota || '',
      total,
      status: 'pending',
      items: pedido.items.map((item) => ({
        candyId: item.dulce.id,
        candyName: item.dulce.nombre,
        unitPrice: item.dulce.precio,
        quantity: item.cantidad,
        subtotal: item.dulce.precio * item.cantidad,
      })),
      extras: Array.isArray(extras) ? extras : [],
    };

    let dbOrder = null;
    try {
      dbOrder = await createOrder(payload);
    } catch (err) {
      throw new Error(`No se pudo guardar en base de datos: ${err.message}`);
    }

    const nuevo = {
      id: dbOrder?.id || Date.now(),
      orderCode: dbOrder?.orderCode || null,
      fecha: new Date().toLocaleString('es-EC'),
      userId: user?.id || null,
      ...pedido,
      total,
      status: dbOrder?.status || 'pendiente',
      deliveryTime,
      deliveryType,
    };

    if (customerCedula && String(customerCedula).trim()) {
      const normalizedCedula = String(customerCedula).trim();
      localStorage.setItem('lastCustomerCedula', normalizedCedula);

      try {
        const rawKnown = localStorage.getItem('knownCustomerCedulas');
        const knownCedulas = rawKnown ? JSON.parse(rawKnown) : [];
        const nextCedulas = Array.isArray(knownCedulas)
          ? knownCedulas.map((v) => String(v || '').trim()).filter(Boolean)
          : [];

        if (!nextCedulas.includes(normalizedCedula)) {
          nextCedulas.push(normalizedCedula);
        }

        localStorage.setItem('knownCustomerCedulas', JSON.stringify(nextCedulas));
      } catch (_err) {
        localStorage.setItem('knownCustomerCedulas', JSON.stringify([normalizedCedula]));
      }
    }

    setPedidosFinalizados(prev => [nuevo, ...prev]);
    limpiarPedido();
    return nuevo;
  };

  return (
    <CarritoContext.Provider value={{
      pedido, setContenedor, agregarDulce, quitarDulce, actualizarCantidad,
      setNota, totalDulces, subtotalDulces, costoContenedor, total,
      limpiarPedido, finalizarPedido, pedidosFinalizados
    }}>
      {children}
    </CarritoContext.Provider>
  );
};

export const useCarrito = () => useContext(CarritoContext);
