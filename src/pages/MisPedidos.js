import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCarrito } from '../context/CarritoContext';
import { getOrders, subscribeOrdersChanges } from '../services/ordersApi';
import './MisPedidos.css';

const STATUS_META = {
  pending: { label: '🕒 Pendiente', className: 'status-pending' },
  confirmed: { label: '✅ Aceptado', className: 'status-confirmed' },
  rejected: { label: '❌ Rechazado', className: 'status-rejected' },
  delivered: { label: '📦 Entregado', className: 'status-delivered' },
  cancelled: { label: '🚫 Cancelado', className: 'status-cancelled' },
};

function normalizeStatus(status) {
  const raw = String(status || '').trim().toLowerCase();
  const map = {
    pendiente: 'pending',
    aceptado: 'confirmed',
    rechazado: 'rejected',
    entregado: 'delivered',
    cancelado: 'cancelled',
  };
  return map[raw] || raw || 'pending';
}

function MisPedidos() {
  const { user, accountName } = useAuth();
  const { pedidosFinalizados } = useCarrito();
  const [dbOrders, setDbOrders] = useState([]);
  const [loadingDbOrders, setLoadingDbOrders] = useState(false);
  const [flash, setFlash] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [avatarError, setAvatarError] = useState('');
  const avatarInputRef = useRef(null);

  useEffect(() => {
    if (!user?.id) {
      setAvatarUrl('');
      setAvatarError('');
      return;
    }

    try {
      const stored = localStorage.getItem(`dulceria.profile.avatar.${user.id}`) || '';
      setAvatarUrl(stored);
      setAvatarError('');
    } catch (_err) {
      setAvatarUrl('');
      setAvatarError('');
    }
  }, [user?.id]);

  const handleAvatarClick = () => {
    if (avatarInputRef.current) {
      avatarInputRef.current.click();
    }
  };

  const handleAvatarChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setAvatarError('Selecciona una imagen valida.');
      return;
    }

    const maxBytes = 2 * 1024 * 1024;
    if (file.size > maxBytes) {
      setAvatarError('La imagen debe pesar menos de 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        setAvatarError('No se pudo leer la imagen. Intenta otra vez.');
        return;
      }

      setAvatarUrl(result);
      setAvatarError('');

      if (user?.id) {
        try {
          localStorage.setItem(`dulceria.profile.avatar.${user.id}`, result);
        } catch (_err) {
          setAvatarError('No se pudo guardar la foto en este navegador.');
        }
      }
    };

    reader.onerror = () => {
      setAvatarError('No se pudo cargar la imagen.');
    };

    reader.readAsDataURL(file);
  };

  useEffect(() => {
    let mounted = true;

    const msg = sessionStorage.getItem('pedidoFlash');
    if (msg) {
      setFlash(msg);
      sessionStorage.removeItem('pedidoFlash');
    }

    const loadDbOrders = async (silent = false) => {
      try {
        if (!silent) {
          setLoadingDbOrders(true);
        }
        const all = await getOrders({ userId: user?.id || '' });
        const filtered = all.length > 0
          ? all
          : pedidosFinalizados.filter((o) => String(o.userId || '') === String(user?.id || ''));
        if (mounted) {
          setDbOrders(filtered);
        }
      } catch (_err) {
        if (!silent) {
          if (mounted) {
            setDbOrders([]);
          }
        }
      } finally {
        if (!silent && mounted) {
          setLoadingDbOrders(false);
        }
      }
    };

    loadDbOrders();

    const syncTimer = setInterval(() => {
      loadDbOrders(true);
    }, 5000);

    const unsubscribeOrders = subscribeOrdersChanges(() => {
      loadDbOrders(true);
    });

    const handleFocus = () => {
      loadDbOrders(true);
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      mounted = false;
      clearInterval(syncTimer);
      unsubscribeOrders();
      window.removeEventListener('focus', handleFocus);
    };
  }, [user?.id, pedidosFinalizados]);

  const pedidosMostrar = dbOrders.length > 0 ? dbOrders : pedidosFinalizados;

  if (!loadingDbOrders && pedidosMostrar.length === 0) {
    return (
      <div className="mispedidos-dashboard">
        <aside className="mispedidos-aside">
          <div className="aside-profile">
            <div className="aside-avatar">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Foto de perfil" className="aside-avatar-img" />
              ) : (
                <span role="img" aria-label="avatar" style={{fontSize: '3rem'}}>👤</span>
              )}
            </div>
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="aside-avatar-input"
            />
            <button type="button" className="aside-avatar-btn" onClick={handleAvatarClick}>Cambiar foto</button>
            {avatarError && <div className="aside-avatar-error">{avatarError}</div>}
            <div className="aside-name">{accountName || 'Usuario'}</div>
            <div className="aside-role">USUARIO</div>
            <div className="aside-orders">{pedidosMostrar.length} pedidos</div>
          </div>
          <nav className="aside-menu">
            <ul>
              <li className="active"><span>Historial</span></li>
            </ul>
          </nav>
        </aside>
        <main className="mispedidos-main">
          <div className="mispedidos-header">
            <h1>📋 Mis Pedidos</h1>
            <p>Aquí aparecerán tus pedidos</p>
          </div>
          {flash && <div className="pedido-flash">{flash}</div>}
          <div className="empty-pedidos">
            <span>🛍️</span>
            <h3>No tienes pedidos aún</h3>
            <p>¡Arma tu primer pedido y endulza tu día!</p>
            <Link to="/armar-pedido" className="btn-primary">Armar pedido</Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="mispedidos-dashboard">
      <aside className="mispedidos-aside">
        <div className="aside-profile">
          <div className="aside-avatar">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Foto de perfil" className="aside-avatar-img" />
            ) : (
              <span role="img" aria-label="avatar" style={{fontSize: '3rem'}}>👤</span>
            )}
          </div>
          <input
            ref={avatarInputRef}
            type="file"
            accept="image/*"
            onChange={handleAvatarChange}
            className="aside-avatar-input"
          />
          <button type="button" className="aside-avatar-btn" onClick={handleAvatarClick}>Cambiar foto</button>
          {avatarError && <div className="aside-avatar-error">{avatarError}</div>}
          <div className="aside-name">{accountName || 'Usuario'}</div>
          <div className="aside-role">USUARIO</div>
          <div className="aside-orders">{pedidosMostrar.length} pedidos</div>
        </div>
        <nav className="aside-menu">
          <ul>
            <li className="active"><span>Historial</span></li>
          </ul>
        </nav>
      </aside>
      <main className="mispedidos-main">
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
            const displayDeliveryDate = p.deliveryDate || '';
            const displayDeliveryTime = p.deliveryTime || '';
            const displayContainerName = p.containerName || p.contenedor?.data?.nombre || 'Contenedor';
            const displayContainerEmoji = p.contenedor?.data?.emoji || '🧺';
            const displayContainerPrice = Number(p.containerPrice || p.contenedor?.data?.precio || 0);
            const displayItems = Array.isArray(p.items) ? p.items : [];
            const normalizedStatus = normalizeStatus(p.status);
            const statusMeta = STATUS_META[normalizedStatus] || STATUS_META.pending;

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
                {(displayDeliveryDate || displayDeliveryTime) && (
                  <small>
                    {displayDeliveryDate || 'Sin fecha'}
                    {displayDeliveryTime ? ` · ${displayDeliveryTime}` : ''}
                  </small>
                )}
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

              <div className={`pedido-badge ${statusMeta.className}`}>{statusMeta.label}</div>
            </div>
            );
          })}
        </div>

        <div className="mispedidos-footer">
          <Link to="/armar-pedido" className="btn-nuevo">+ Nuevo pedido</Link>
        </div>
      </main>
    </div>

  );
}

export default MisPedidos;
