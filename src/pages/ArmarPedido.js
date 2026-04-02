import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCarrito } from '../context/CarritoContext';
import { dulces, tiposFundas, tiposDesechables, tiposCanastos } from '../data/productos';
import { inventoryApi } from '../services/inventoryApi';
import { lookupCustomerByCedula } from '../services/ordersApi';
import './ArmarPedido.css';

const PASO_CONTENEDOR = 1;
const PASO_DULCES = 2;
const PASO_RESUMEN = 3;
const ORDERS_PROVIDER = (process.env.REACT_APP_ORDERS_PROVIDER || 'api').toLowerCase();

export default function ArmarPedido() {
  const navigate = useNavigate();
  const { pedido, setContenedor, agregarDulce, actualizarCantidad, quitarDulce, setNota, total, totalDulces, subtotalDulces, costoContenedor, finalizarPedido } = useCarrito();
  const [paso, setPaso] = useState(PASO_CONTENEDOR);
  const [tipoPrincipal, setTipoPrincipal] = useState('');
  const [fallosImagen, setFallosImagen] = useState({});
  const [cantTemp, setCantTemp] = useState({});
  const [customerCedula, setCustomerCedula] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerReference, setCustomerReference] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [deliveryType, setDeliveryType] = useState('domicilio');
  const [inventario, setInventario] = useState({});
  const [consultandoCedula, setConsultandoCedula] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);

  useEffect(() => {
    const cargarInventario = async () => {
      try {
        const data = await inventoryApi.getInventory();
        const inventarioMap = {};
        data.forEach((item) => {
          const id = Number(item.CANDY_ID ?? item.candy_id);
          inventarioMap[id] = {
            cantidad: Number(item.QUANTITY ?? item.quantity ?? 0),
            disponible: Boolean(item.AVAILABLE ?? item.available),
          };
        });
        setInventario(inventarioMap);
      } catch (_err) {
        // Si falla inventario en tiempo real, mantenemos valores del catalogo local.
      }
    };

    cargarInventario();
  }, []);

  const tipos = [
    { key: 'funda', label: 'Funda', emoji: '🛍️', desc: 'Automática según cantidad' },
    { key: 'desechable', label: 'Caja Desechable', emoji: '📦', desc: 'Automática desde $3.00 hasta $15.00' },
    { key: 'canasto', label: 'Canasto', emoji: '🧺', desc: 'Desde $3.00 (aparte)' },
  ];

  const getOpcionPorCantidad = (opciones, cantidadTotal) => {
    const cantidad = Math.max(1, Number(cantidadTotal) || 1);
    return opciones.find((opcion) => cantidad <= (opcion.capacidadMax || Infinity)) || opciones[opciones.length - 1];
  };

  const getFundaRecomendada = (cantidadTotal) => {
    return getOpcionPorCantidad(tiposFundas, cantidadTotal);
  };

  const getDesechableRecomendado = (cantidadTotal) => {
    return getOpcionPorCantidad(tiposDesechables, cantidadTotal);
  };

  useEffect(() => {
    const tipoContenedor = pedido.contenedor?.tipo;
    if (tipoContenedor !== 'funda' && tipoContenedor !== 'desechable') return;
    if (!pedido.items.length) return;

    const opcionRecomendada = tipoContenedor === 'funda'
      ? getFundaRecomendada(totalDulces)
      : getDesechableRecomendado(totalDulces);

    if (!opcionRecomendada) return;
    if (pedido.contenedor?.data?.id === opcionRecomendada.id) return;

    setContenedor(tipoContenedor, opcionRecomendada, { preserveItems: true });
  }, [pedido.contenedor?.tipo, pedido.contenedor?.data?.id, pedido.items.length, setContenedor, totalDulces]);

  const getOpciones = () => {
    if (tipoPrincipal === 'funda') return tiposFundas;
    if (tipoPrincipal === 'desechable') return tiposDesechables;
    if (tipoPrincipal === 'canasto') return tiposCanastos;
    return [];
  };

  const seleccionarContenedor = (op) => {
    setContenedor(tipoPrincipal, op);
    setPaso(PASO_DULCES);
  };

  const handleAgregar = (dulce) => {
    const cant = cantTemp[dulce.id] || 1;
    const maxDisponible = dulce.cantidad;
    const enPedido = getItemQty(dulce.id);
    const restante = Math.max(0, maxDisponible - enPedido);

    if (cant > restante) {
      setFeedback({
        type: 'error',
        text: `No hay suficiente stock de ${dulce.nombre}. Disponible: ${restante}`,
      });
      return;
    }

    agregarDulce(dulce, cant);
    setCantTemp(prev => ({ ...prev, [dulce.id]: 1 }));
  };

  const getItemQty = (id) => {
    const item = pedido.items.find(i => i.dulce.id === id);
    return item ? item.cantidad : 0;
  };

  const dulcesConStock = dulces.map((d) => {
    const inv = inventario[d.id];
    if (!inv) return d;
    return {
      ...d,
      cantidad: inv.cantidad,
      disponible: inv.disponible && inv.cantidad > 0,
    };
  });

  const disponibles = dulcesConStock.filter((d) => d.disponible);

  const getFriendlyErrorMessage = (rawMessage = '') => {
    const msg = String(rawMessage || '');

    if (msg.includes('Failed to fetch') || msg.includes('No se pudo conectar')) {
      if (ORDERS_PROVIDER === 'supabase') {
        return 'No se pudo conectar con Supabase. Revisa internet, URL y API key del proyecto.';
      }

      return 'No se pudo conectar con el backend. Verifica que el servidor esté encendido.';
    }

    if (msg.includes('Respuesta invalida del servidor')) {
      return msg;
    }

    if (msg.includes('containerType') || msg.includes('containerName') || msg.includes('al menos un item')) {
      return 'El pedido está incompleto. Revisa empaque y dulces seleccionados.';
    }

    if (msg.includes('Stock insuficiente') || msg.includes('inventario')) {
      return msg;
    }

    return msg || 'No se pudo guardar el pedido. Inténtalo nuevamente.';
  };

  const handleFinalizar = async () => {
    const newErrors = {};

    if (!/^\d{10}$/.test(customerCedula.trim())) {
      newErrors.customerCedula = 'La cédula es obligatoria y debe tener 10 dígitos';
    }

    // Validar nombre
    if (!customerName.trim()) {
      newErrors.customerName = 'El nombre es requerido';
    }

    // Validar teléfono
    if (!customerPhone.trim()) {
      newErrors.customerPhone = 'El teléfono es requerido';
    } else if (!/^[0-9-+\s()]{7,}$/.test(customerPhone)) {
      newErrors.customerPhone = 'Teléfono inválido';
    }

    // Validar email si se proporciona
    if (customerEmail.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
      newErrors.customerEmail = 'Email inválido';
    }

    // Validar dirección
    if (!customerAddress.trim()) {
      newErrors.customerAddress = 'La dirección es requerida';
    }

    // Validar ciudad
    if (!customerCity.trim()) {
      newErrors.customerCity = 'La ciudad es requerida';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setFeedback({
        type: 'error',
        text: 'Completa los campos obligatorios para confirmar el pedido.',
      });
      return;
    }

    setErrors({});
    setFeedback(null);
    setSaving(true);
    try {
      const pedidoCreado = await finalizarPedido({
        customerCedula,
        customerName,
        customerEmail,
        customerPhone,
        customerAddress,
        customerCity,
        customerReference,
        deliveryDate,
        deliveryType,
      });

      const pedidoId = pedidoCreado?.id ? ` #${pedidoCreado.id}` : '';
      sessionStorage.setItem('pedidoFlash', `Pedido${pedidoId} creado correctamente.`);
      navigate('/mis-pedidos');
    } catch (err) {
      setFeedback({
        type: 'error',
        text: getFriendlyErrorMessage(err?.message),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConsultarCedula = async () => {
    if (!/^\d{10}$/.test(customerCedula.trim())) {
      setErrors((prev) => ({ ...prev, customerCedula: 'Ingresa una cédula válida de 10 dígitos' }));
      return;
    }

    try {
      setConsultandoCedula(true);
      const customer = await lookupCustomerByCedula(customerCedula.trim());
      setCustomerName(customer.fullName || '');
      setErrors((prev) => ({ ...prev, customerCedula: '', customerName: '' }));
      setFeedback({ type: 'success', text: 'Nombre cargado desde cédula.' });
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'No se pudo consultar la cédula' });
    } finally {
      setConsultandoCedula(false);
    }
  };

  return (
    <div className="armar-page">
      {/* Stepper */}
      <div className="stepper">
        {[
          { n: 1, label: 'Elige empaque' },
          { n: 2, label: 'Elige dulces' },
          { n: 3, label: 'Confirma' },
        ].map(s => (
          <div key={s.n} className={`step ${paso >= s.n ? 'done' : ''} ${paso === s.n ? 'active' : ''}`}>
            <div className="step-circle">{paso > s.n ? '✓' : s.n}</div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      {/* PASO 1: Contenedor */}
      {paso === PASO_CONTENEDOR && (
        <div className="paso-section">
          <h2>¿Cómo quieres tu pedido?</h2>
          <p className="paso-desc">Elige el tipo de empaque para armar tu surtido</p>

          <div className="tipo-grid">
            {tipos.map(t => (
              <button
                key={t.key}
                className={`tipo-card ${tipoPrincipal === t.key ? 'selected' : ''}`}
                onClick={() => setTipoPrincipal(t.key)}
              >
                <span className="tipo-emoji">{t.emoji}</span>
                <strong>{t.label}</strong>
                <span className="tipo-desc">{t.desc}</span>
              </button>
            ))}
          </div>

          {tipoPrincipal && (
            <div className="opciones-section">
              <h3>Elige tu {tipoPrincipal === 'funda' ? 'funda' : tipoPrincipal === 'desechable' ? 'caja' : 'canasto'}:</h3>
              <div className="opciones-grid">
                {getOpciones().map(op => (
                  <button key={op.id} className="opcion-card" onClick={() => seleccionarContenedor(op)}>
                    <span className="opcion-emoji">{op.emoji}</span>
                    <div className="opcion-info">
                      <strong>{op.nombre}</strong>
                      <span>{op.descripcion}</span>
                    </div>
                    <div className="opcion-precio">
                      ${op.precio.toFixed(2)}
                      {tipoPrincipal === 'canasto' && <small> + dulces</small>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PASO 2: Dulces */}
      {paso === PASO_DULCES && (
        <div className="paso-section">
          <div className="paso2-header">
            <div>
              <h2>Elige tus dulces 🍬</h2>
              <p className="paso-desc">
                Empaque: <strong>{pedido.contenedor?.data?.nombre}</strong> — ${pedido.contenedor?.data?.precio?.toFixed(2)}
              </p>
              {(pedido.contenedor?.tipo === 'funda' || pedido.contenedor?.tipo === 'desechable') && pedido.items.length > 0 && (
                <p className="paso-desc funda-auto-note">
                  El empaque se ajusta solo segun la cantidad de dulces ({totalDulces} seleccionados).
                </p>
              )}
            </div>
            <div className="resumen-mini">
              <span>🛒 {pedido.items.length} tipos</span>
              <span>🍬 {totalDulces} dulces</span>
              <span>Empaque: ${costoContenedor.toFixed(2)}</span>
              <span>Dulces: ${subtotalDulces.toFixed(2)}</span>
              <span className="resumen-mini-total">Total: ${total.toFixed(2)}</span>
              <button className="btn-continuar" onClick={() => setPaso(PASO_RESUMEN)} disabled={pedido.items.length === 0}>
                Revisar pedido →
              </button>
            </div>
          </div>

          <div className="dulces-order-grid">
            {disponibles.map(dulce => {
              const enPedido = getItemQty(dulce.id);
              const imagenDisponible = Boolean(dulce.imagen) && !fallosImagen[dulce.id];
              return (
                <div key={dulce.id} className={`dulce-order-card ${enPedido > 0 ? 'en-pedido' : ''}`}>
                  {imagenDisponible && (
                    <div className="doc-image-preview" aria-hidden="true">
                      <img src={dulce.imagen} alt={dulce.nombre} loading="lazy" />
                    </div>
                  )}
                  <div className="doc-top">
                    {imagenDisponible ? (
                      <img
                        src={dulce.imagen}
                        alt={dulce.nombre}
                        className="doc-thumb"
                        loading="lazy"
                        onError={() => setFallosImagen(prev => ({ ...prev, [dulce.id]: true }))}
                      />
                    ) : (
                      <span className="doc-thumb-placeholder">IMG</span>
                    )}
                    <div className="doc-info">
                      <strong>{dulce.nombre}</strong>
                      <span className="doc-precio">${dulce.precio.toFixed(2)} c/u</span>
                    </div>
                    <span className="doc-stock">{dulce.cantidad} disp.</span>
                  </div>

                  {enPedido > 0 && (
                    <div className="doc-en-pedido">
                      <span>En pedido:</span>
                      <div className="qty-ctrl">
                        <button onClick={() => actualizarCantidad(dulce.id, enPedido - 1)}>−</button>
                        <strong>{enPedido}</strong>
                        <button onClick={() => actualizarCantidad(dulce.id, enPedido + 1)} disabled={enPedido >= dulce.cantidad}>+</button>
                      </div>
                      <button className="btn-quitar" onClick={() => quitarDulce(dulce.id)}>✕</button>
                    </div>
                  )}

                  <div className="doc-agregar">
                    <div className="qty-input-wrap">
                      <button onClick={() => setCantTemp(p => ({ ...p, [dulce.id]: Math.max(1, (p[dulce.id] || 1) - 1) }))}>−</button>
                      <input
                        type="number"
                        min="1"
                        max={dulce.cantidad}
                        value={cantTemp[dulce.id] || 1}
                        onChange={e => setCantTemp(p => ({ ...p, [dulce.id]: Math.max(1, parseInt(e.target.value) || 1) }))}
                      />
                      <button onClick={() => setCantTemp(p => ({ ...p, [dulce.id]: Math.min(dulce.cantidad, (p[dulce.id] || 1) + 1) }))}>+</button>
                    </div>
                    <button className="btn-add" onClick={() => handleAgregar(dulce)}>
                      + Agregar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="paso2-footer">
            <button className="btn-back" onClick={() => { setPaso(PASO_CONTENEDOR); }}>← Cambiar empaque</button>
            <button className="btn-continuar" onClick={() => setPaso(PASO_RESUMEN)} disabled={pedido.items.length === 0}>
              Continuar a resumen · ${total.toFixed(2)} →
            </button>
          </div>
        </div>
      )}

      {/* PASO 3: Resumen */}
      {paso === PASO_RESUMEN && (
        <div className="paso-section">
          <h2>Resumen de tu pedido 🎁</h2>

          {feedback && (
            <div className={`pedido-feedback ${feedback.type === 'error' ? 'is-error' : 'is-success'}`}>
              {feedback.text}
            </div>
          )}

          <div className="resumen-container">
            <div className="resumen-contenedor-box">
              <span className="rc-emoji">{pedido.contenedor?.data?.emoji}</span>
              <div>
                <strong>{pedido.contenedor?.data?.nombre}</strong>
                <span>Empaque seleccionado</span>
              </div>
              <div className="rc-precio">${pedido.contenedor?.data?.precio?.toFixed(2)}</div>
            </div>

            <div className="resumen-items">
              <h3>Dulces seleccionados:</h3>
              {pedido.items.map(item => (
                <div key={item.dulce.id} className="resumen-item">
                  <span>{item.dulce.nombre}</span>
                  <div className="ri-right">
                    <span className="ri-qty">×{item.cantidad}</span>
                    <span className="ri-sub">${(item.dulce.precio * item.cantidad).toFixed(2)}</span>
                    <button className="btn-quitar-sm" onClick={() => quitarDulce(item.dulce.id)}>✕</button>
                  </div>
                </div>
              ))}
            </div>

            <div className="resumen-totales">
              <div className="total-row">
                <span>Dulces</span>
                <span>${subtotalDulces.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Empaque ({pedido.contenedor?.data?.nombre})</span>
                <span>${costoContenedor.toFixed(2)}</span>
              </div>
              <div className="total-row total-final">
                <span>TOTAL</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </div>

            <textarea
              className="nota-input"
              placeholder="¿Tienes alguna nota o instrucción especial? (opcional)"
              value={pedido.nota}
              onChange={e => setNota(e.target.value)}
              rows={3}
            />

            <div className="cliente-section">
              <h3>📝 Datos de entrega</h3>
              <p className="cliente-section-desc">Completa tus datos para procesar el pedido</p>

              <div className="cliente-form">
                <div className="form-row">
                  <div className="form-group">
                    <label>Cédula *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={10}
                      className={`cliente-input ${errors.customerCedula ? 'input-error' : ''}`}
                      placeholder="ej: 0102030405"
                      value={customerCedula}
                      onChange={(e) => {
                        const value = e.target.value.replace(/\D/g, '').slice(0, 10);
                        setCustomerCedula(value);
                        if (errors.customerCedula) setErrors(prev => ({ ...prev, customerCedula: '' }));
                      }}
                    />
                    {errors.customerCedula && <span className="error-text">{errors.customerCedula}</span>}
                  </div>

                  <div className="form-group" style={{ justifyContent: 'flex-end' }}>
                    <label>&nbsp;</label>
                    <button
                      type="button"
                      className="btn-continuar"
                      style={{ width: '100%' }}
                      disabled={consultandoCedula}
                      onClick={handleConsultarCedula}
                    >
                      {consultandoCedula ? 'Consultando...' : 'Consultar cédula'}
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label>Nombre completo *</label>
                  <input
                    type="text"
                    className={`cliente-input ${errors.customerName ? 'input-error' : ''}`}
                    placeholder="ej: Juan Carlos Pérez"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      if (errors.customerName) setErrors(prev => ({ ...prev, customerName: '' }));
                    }}
                  />
                  {errors.customerName && <span className="error-text">{errors.customerName}</span>}
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Teléfono *</label>
                    <input
                      type="tel"
                      className={`cliente-input ${errors.customerPhone ? 'input-error' : ''}`}
                      placeholder="ej: +58 424-1234567"
                      value={customerPhone}
                      onChange={(e) => {
                        setCustomerPhone(e.target.value);
                        if (errors.customerPhone) setErrors(prev => ({ ...prev, customerPhone: '' }));
                      }}
                    />
                    {errors.customerPhone && <span className="error-text">{errors.customerPhone}</span>}
                  </div>

                  <div className="form-group">
                    <label>Email (opcional)</label>
                    <input
                      type="email"
                      className={`cliente-input ${errors.customerEmail ? 'input-error' : ''}`}
                      placeholder="ej: juan@example.com"
                      value={customerEmail}
                      onChange={(e) => {
                        setCustomerEmail(e.target.value);
                        if (errors.customerEmail) setErrors(prev => ({ ...prev, customerEmail: '' }));
                      }}
                    />
                    {errors.customerEmail && <span className="error-text">{errors.customerEmail}</span>}
                  </div>
                </div>

                <div className="form-group">
                  <label>Dirección *</label>
                  <input
                    type="text"
                    className={`cliente-input ${errors.customerAddress ? 'input-error' : ''}`}
                    placeholder="ej: Calle 5, Apto 2B, Edificio El Suspiro"
                    value={customerAddress}
                    onChange={(e) => {
                      setCustomerAddress(e.target.value);
                      if (errors.customerAddress) setErrors(prev => ({ ...prev, customerAddress: '' }));
                    }}
                  />
                  {errors.customerAddress && <span className="error-text">{errors.customerAddress}</span>}
                </div>

                <div className="form-group">
                  <label>Referencia (opcional)</label>
                  <input
                    type="text"
                    className="cliente-input"
                    placeholder="ej: Casa esquinera color blanco"
                    value={customerReference}
                    onChange={(e) => setCustomerReference(e.target.value)}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Ciudad/Localidad *</label>
                    <input
                      type="text"
                      className={`cliente-input ${errors.customerCity ? 'input-error' : ''}`}
                      placeholder="ej: Caracas, Los Teques"
                      value={customerCity}
                      onChange={(e) => {
                        setCustomerCity(e.target.value);
                        if (errors.customerCity) setErrors(prev => ({ ...prev, customerCity: '' }));
                      }}
                    />
                    {errors.customerCity && <span className="error-text">{errors.customerCity}</span>}
                  </div>

                  <div className="form-group">
                    <label>Tipo de entrega *</label>
                    <select
                      className="cliente-input"
                      value={deliveryType}
                      onChange={(e) => setDeliveryType(e.target.value)}
                    >
                      <option value="domicilio">🚚 A domicilio</option>
                      <option value="retiro">🏪 Para retiro</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Fecha de entrega (opcional)</label>
                    <input
                      type="date"
                      className="cliente-input"
                      value={deliveryDate}
                      onChange={(e) => setDeliveryDate(e.target.value)}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="resumen-actions">
              <button className="btn-back" onClick={() => setPaso(PASO_DULCES)}>← Editar dulces</button>
              <button className="btn-finalizar" onClick={handleFinalizar} disabled={saving}>
                {saving ? 'Guardando...' : `✅ Confirmar pedido · $${total.toFixed(2)}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
