import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCarrito } from '../context/CarritoContext';
import { getOrders } from '../services/ordersApi';
import './MisPedidos.css';

export default function MisPedidos() {
  const { pedidosFinalizados } = useCarrito();
  const [dbOrders, setDbOrders] = useState([]);
  const [loadingDbOrders, setLoadingDbOrders] = useState(false);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    const msg = sessionStorage.getItem('pedidoFlash');
    if (msg) {
      setFlash(msg);
      sessionStorage.removeItem('pedidoFlash');
    }

    const loadDbOrders = async () => {
      try {
        setLoadingDbOrders(true);
        const all = await getOrders();
        const lastCedula = localStorage.getItem('lastCustomerCedula') || '';
        const filtered = lastCedula
          ? all.filter((o) => String(o.customerCedula || '') === String(lastCedula))
          : all;
        setDbOrders(filtered);
      } catch (_err) {
        setDbOrders([]);
      } finally {
        setLoadingDbOrders(false);
      }
    };

    loadDbOrders();
  }, []);

  const pedidosMostrar = dbOrders.length > 0 ? dbOrders : pedidosFinalizados;

  if (!loadingDbOrders && pedidosMostrar.length === 0) {
    return (
      <div className="mispedidos-page">
        <div className="mispedidos-header">
          <h1>📋 Mis Pedidos</h1>
          <p>Aquí aparecerán tus pedidos confirmados</p>
        </div>
        {flash && <div className="pedido-flash">{flash}</div>}
        <div className="empty-pedidos">
          <span>🛍️</span>
          <h3>No tienes pedidos aún</h3>
          <p>¡Arma tu primer pedido y endulza tu día!</p>
          <Link to="/armar-pedido" className="btn-primary">Armar pedido</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mispedidos-page">
      <div className="mispedidos-header">
        <h1>📋 Mis Pedidos</h1>
        <p>{pedidosMostrar.length} pedido(s) realizados</p>
      </div>

      {flash && <div className="pedido-flash">{flash}</div>}
      {loadingDbOrders && <div className="pedido-flash">Sincronizando pedidos...</div>}

      <div className="pedidos-lista">
        {pedidosMostrar.map((p, i) => {
          const displayFecha = p.fecha || (p.createdAt ? new Date(p.createdAt).toLocaleString('es-EC') : 'Sin fecha');
          const displayTotal = Number(p.total || 0);
          const displayDelivery = p.deliveryType || 'domicilio';
          const displayContainerName = p.containerName || p.contenedor?.data?.nombre || 'Contenedor';
          const displayContainerEmoji = p.contenedor?.data?.emoji || '🧺';
          const displayContainerPrice = Number(p.containerPrice || p.contenedor?.data?.precio || 0);
          const displayItems = Array.isArray(p.items) ? p.items : [];

          return (
          <div key={p.id} className="pedido-card">
            <div className="pedido-top">
              <div className="pedido-id">
                <span className="pedido-num">Pedido #{pedidosMostrar.length - i}</span>
                <span className="pedido-fecha">📅 {displayFecha}</span>
              </div>
              <div className="pedido-total">${displayTotal.toFixed(2)}</div>
            </div>

            <div className="pedido-contenedor">
              <span>{displayContainerEmoji}</span>
              <span>{displayContainerName}</span>
              <span className="pc-precio">${displayContainerPrice.toFixed(2)}</span>
            </div>

            <div className="pedido-entrega">
              {displayDelivery === 'retiro' ? '🏪 Para retiro' : '🚚 A domicilio'}
            </div>

            <div className="pedido-items">
              {displayItems.map((item, idx) => {
                const name = item?.dulce?.nombre || item?.candyName || 'Dulce';
                const qty = Number(item?.cantidad || item?.quantity || 0);
                const subtotal = Number(item?.subtotal || ((item?.dulce?.precio || item?.unitPrice || 0) * qty));
                const key = item?.dulce?.id || item?.id || `${p.id}-${idx}`;

                return (
                <div key={key} className="pi-row">
                  <span>{name}</span>
                  <div className="pi-right">
                    <span className="pi-qty">×{qty}</span>
                    <span className="pi-sub">${subtotal.toFixed(2)}</span>
                  </div>
                </div>
                );
              })}
            </div>

            {(p.nota || p.notes) && (
              <div className="pedido-nota">
                <strong>📝 Nota:</strong> {p.nota || p.notes}
              </div>
            )}

            <div className="pedido-badge">✅ Confirmado</div>
          </div>
          );
        })}
      </div>

      <div className="mispedidos-footer">
        <Link to="/armar-pedido" className="btn-nuevo">+ Nuevo pedido</Link>
      </div>
    </div>
  );
}
