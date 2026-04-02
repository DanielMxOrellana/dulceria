import React, { useState } from 'react';
import { inventoryApi } from '../services/inventoryApi';
import { getOrders, updateOrderStatus } from '../services/ordersApi';
import './Admin.css';

export default function AdminPedidos() {
  const [adminPassword, setAdminPassword] = useState('');
  const [sessionAdminPassword, setSessionAdminPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [orders, setOrders] = useState([]);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const normalizeStatus = (status) => {
    const raw = String(status || '').trim().toLowerCase();
    const map = {
      pendiente: 'pending',
      aceptado: 'confirmed',
      rechazado: 'rejected',
      entregado: 'delivered',
      cancelado: 'cancelled',
    };
    return map[raw] || raw;
  };

  const loadOrders = async () => {
    try {
      setOrdersLoading(true);
      const data = await getOrders();
      setOrders(data);
      setFeedback(null);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error cargando pedidos: ' + err.message });
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setFeedback({ type: 'error', text: 'Ingresa la contraseña' });
      return;
    }

    try {
      setOrdersLoading(true);
      await inventoryApi.authenticateAdmin(adminPassword.trim());
      setSessionAdminPassword(adminPassword.trim());
      setIsAuthenticated(true);
      await loadOrders();
      setAdminPassword('');
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'No se pudo iniciar sesión como admin' });
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleAcceptOrder = async (orderId) => {
    try {
      setOrdersLoading(true);
      await updateOrderStatus(orderId, 'confirmed', sessionAdminPassword);
      setFeedback({ type: 'success', text: `Pedido #${orderId} aceptado correctamente` });
      await loadOrders();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error aceptando pedido: ' + err.message });
    } finally {
      setOrdersLoading(false);
    }
  };

  const pendingOrders = orders.filter((order) => normalizeStatus(order.status) === 'pending');
  const acceptedOrders = orders.filter((order) => normalizeStatus(order.status) === 'confirmed');

  if (!isAuthenticated) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-container">
          <div className="admin-login-header">
            <h1>🔐 Admin Pedidos</h1>
            <p>Aceptación y revisión de pedidos</p>
          </div>

          {feedback && (
            <div className={`admin-feedback ${feedback.type === 'error' ? 'is-error' : 'is-success'}`}>
              {feedback.text}
            </div>
          )}

          <form onSubmit={handleLogin} className="admin-login-form">
            <div className="form-group">
              <label htmlFor="password">Contraseña de Admin</label>
              <input
                type="password"
                id="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="Ingresa la contraseña"
                className="admin-input"
                autoFocus
              />
            </div>
            <button type="submit" className="admin-btn btn-primary" disabled={ordersLoading}>
              Acceder
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🧾 Gestión de Pedidos</h1>
        <div className="admin-actions">
          <button onClick={loadOrders} className="admin-btn btn-refresh" disabled={ordersLoading}>
            ⟳ Recargar Pedidos
          </button>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setAdminPassword('');
              setSessionAdminPassword('');
              setOrders([]);
            }}
            className="admin-btn btn-logout"
          >
            🚪 Cerrar Sesión
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`admin-feedback ${feedback.type === 'error' ? 'is-error' : 'is-success'}`}>
          {feedback.text}
        </div>
      )}

      {ordersLoading && <div className="admin-loading">Cargando pedidos...</div>}

      <div className="admin-stats">
        <div className="stat">
          <strong>{pendingOrders.length}</strong>
          <span>Pedidos Pendientes</span>
        </div>
        <div className="stat">
          <strong>{acceptedOrders.length}</strong>
          <span>Pedidos Aceptados</span>
        </div>
        <div className="stat">
          <strong>{orders.length}</strong>
          <span>Total Pedidos</span>
        </div>
      </div>

      <section className="admin-orders-section">
        <div className="admin-orders-header">
          <h2>Revisión de pedidos y datos del cliente</h2>
          <p>Desde aquí aceptas pedidos pendientes y revisas detalles completos.</p>
        </div>

        {!ordersLoading && orders.length === 0 && (
          <div className="empty-state">
            <p>No hay pedidos registrados por el momento.</p>
          </div>
        )}

        <div className="admin-orders-grid">
          {orders.map((order) => {
            const isPending = normalizeStatus(order.status) === 'pending';
            const isAcceptedNormalized = normalizeStatus(order.status) === 'confirmed';
            const statusTextMap = {
              pending: '🕒 Pending',
              confirmed: '✅ Confirmed',
              rejected: '❌ Rejected',
              delivered: '📦 Delivered',
              cancelled: '🚫 Cancelled',
            };
            const statusText = statusTextMap[normalizeStatus(order.status)] || String(order.status || 'N/A');

            return (
              <article key={order.id} className="admin-order-card">
                <div className="admin-order-top">
                  <div>
                    <h3>Pedido #{order.id}</h3>
                    <p className="order-date"><strong>Código:</strong> {order.orderCode || 'Sin código'}</p>
                    <p className="order-date">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`order-status ${isAcceptedNormalized ? 'accepted' : isPending ? 'pending' : 'other'}`}>
                    {statusText}
                  </span>
                </div>

                <div className="order-client-grid">
                  <p><strong>Cédula:</strong> {order.customerCedula || 'Sin cédula'}</p>
                  <p><strong>Cliente:</strong> {order.customerName || 'Sin nombre'}</p>
                  <p><strong>Teléfono:</strong> {order.customerPhone || 'Sin teléfono'}</p>
                  <p><strong>Email:</strong> {order.customerEmail || 'Sin email'}</p>
                  <p><strong>Ciudad:</strong> {order.customerCity || 'Sin ciudad'}</p>
                  <p><strong>Dirección:</strong> {order.customerAddress || 'Sin dirección'}</p>
                  <p><strong>Referencia:</strong> {order.customerReference || 'Sin referencia'}</p>
                  <p><strong>Entrega:</strong> {(order.deliveryDate || 'Sin fecha') + (order.deliveryTime ? ` · ${order.deliveryTime}` : '')}</p>
                </div>

                <div className="order-items-box">
                  <h4>Dulces del pedido</h4>
                  {order.items && order.items.length > 0 ? (
                    <ul>
                      {order.items.map((item) => (
                        <li key={item.id || `${order.id}-${item.candyId}`}>
                          <span>{item.candyName}</span>
                          <span>x{item.quantity}</span>
                          <span>${Number(item.subtotal || 0).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p>Sin ítems</p>
                  )}
                </div>

                <div className="order-summary">
                  <p><strong>Contenedor:</strong> {order.containerName || order.containerType || 'N/A'}</p>
                  <p><strong>Total:</strong> ${Number(order.total || 0).toFixed(2)}</p>
                </div>

                {order.notes ? <p className="order-note"><strong>Nota:</strong> {order.notes}</p> : null}

                <div className="order-actions">
                  <button
                    className="admin-btn btn-save"
                    disabled={!isPending || ordersLoading}
                    onClick={() => handleAcceptOrder(order.id)}
                  >
                    ✅ Aceptar Pedido
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
