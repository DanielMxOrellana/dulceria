import React, { createContext, useContext, useState } from 'react';
import { useAuth } from './AuthContext';
import { createOrder } from '../services/ordersApi';

const CarritoContext = createContext();

export const CarritoProvider = ({ children }) => {
  const { user } = useAuth();
  const [pedido, setPedido] = useState({
    contenedor: null, // { tipo, data }
    items: [],        // { dulce, cantidad }
    nota: '',
  });

  const [pedidosFinalizados, setPedidosFinalizados] = useState([]);

  const setContenedor = (tipo, data, options = {}) => {
    const { preserveItems = false } = options;
    setPedido(prev => ({
      ...prev,
      contenedor: { tipo, data },
      items: preserveItems ? prev.items : [],
    }));
  };

  const agregarDulce = (dulce, cantidad) => {
    setPedido(prev => {
      const existing = prev.items.find(i => i.dulce.id === dulce.id);
      if (existing) {
        return {
          ...prev,
          items: prev.items.map(i =>
            i.dulce.id === dulce.id ? { ...i, cantidad: i.cantidad + cantidad } : i
          )
        };
      }
      return { ...prev, items: [...prev.items, { dulce, cantidad }] };
    });
  };

  const quitarDulce = (dulceId) => {
    setPedido(prev => ({ ...prev, items: prev.items.filter(i => i.dulce.id !== dulceId) }));
  };

  const actualizarCantidad = (dulceId, cantidad) => {
    if (cantidad <= 0) {
      quitarDulce(dulceId);
      return;
    }
    setPedido(prev => ({
      ...prev,
      items: prev.items.map(i => i.dulce.id === dulceId ? { ...i, cantidad } : i)
    }));
  };

  const setNota = (nota) => setPedido(prev => ({ ...prev, nota }));

  const totalDulces = pedido.items.reduce((acc, i) => acc + i.cantidad, 0);
  const subtotalDulces = pedido.items.reduce((acc, i) => acc + i.dulce.precio * i.cantidad, 0);
  const costoContenedor = pedido.contenedor?.data?.precio || 0;
  const total = subtotalDulces + costoContenedor;

  const limpiarPedido = () => {
    setPedido({ contenedor: null, items: [], nota: '' });
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
