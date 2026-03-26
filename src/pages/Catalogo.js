import React, { useState, useEffect } from 'react';
import { dulces } from '../data/productos';
import { inventoryApi } from '../services/inventoryApi';
import './Catalogo.css';

const categorias = [
  'todos',
  ...Array.from(new Set(dulces.map(d => d.categoria))).sort((a, b) => a.localeCompare(b)),
];

function DulceVisual({ dulce }) {
  const [falloImagen, setFalloImagen] = useState(false);

  if (dulce.imagen && !falloImagen) {
    return (
      <img
        src={dulce.imagen}
        alt={dulce.nombre}
        className="dulce-imagen"
        onError={() => setFalloImagen(true)}
        loading="lazy"
      />
    );
  }

  return <div className="dulce-placeholder">Imagen pendiente</div>;
}

export default function Catalogo() {
  const [cat, setCat] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [inventario, setInventario] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const cargarInventario = async () => {
      try {
        setLoading(true);
        const data = await inventoryApi.getInventory();
        // Convertir array a objeto para búsqueda rápida por ID
        const inventarioMap = {};
        data.forEach(item => {
          const id = Number(item.CANDY_ID ?? item.candy_id);
          inventarioMap[id] = {
            cantidad: Number(item.QUANTITY ?? item.quantity ?? 0),
            disponible: Boolean(item.AVAILABLE ?? item.available)
          };
        });
        setInventario(inventarioMap);
        setError(null);
      } catch (err) {
        console.error('Error cargando inventario:', err);
        // Usar valores por defecto si hay error
        setError('No se pudo cargar inventario en tiempo real');
      } finally {
        setLoading(false);
      }
    };

    cargarInventario();
    // Recargar cada 30 segundos para mostrar cambios en tiempo real
    const intervalo = setInterval(cargarInventario, 30000);
    return () => clearInterval(intervalo);
  }, []);

  const filtrados = dulces.filter(d => {
    const matchCat = cat === 'todos' || d.categoria === cat;
    const matchBusq = d.nombre.toLowerCase().includes(busqueda.toLowerCase());
    return matchCat && matchBusq;
  });

  // Obtener información de inventario para un dulce
  const getInventarioInfo = (dulceId) => {
    return inventario[dulceId] || { cantidad: 100, disponible: true };
  };

  return (
    <div className="catalogo-page">
      <div className="catalogo-header">
        <h1>📋 Catálogo de Dulces</h1>
        <p>Todos nuestros dulces con precios actualizados</p>
      </div>

      {error && (
        <div className="catalogo-warning">
          ⚠️ {error} (usando valores por defecto)
        </div>
      )}

      <div className="catalogo-controls">
        <input
          type="text"
          placeholder="🔍 Buscar dulce..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          className="busqueda-input"
        />
        <div className="cat-tabs">
          {categorias.map(c => (
            <button
              key={c}
              className={`cat-tab ${cat === c ? 'active' : ''}`}
              onClick={() => setCat(c)}
            >
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="dulces-grid">
        {filtrados.map(dulce => {
          const inventInfo = getInventarioInfo(dulce.id);
          const disponible = inventInfo.disponible && inventInfo.cantidad > 0;
          
          return (
            <div key={dulce.id} className={`dulce-card ${!disponible ? 'agotado' : ''}`}>
              <DulceVisual dulce={dulce} />
              <div className="dulce-info">
                <div className="dulce-nombre">{dulce.nombre}</div>
                <div className="dulce-desc">{dulce.descripcion}</div>
                <div className="dulce-footer">
                  <span className="dulce-precio">${dulce.precio.toFixed(2)}</span>
                  <span className={`dulce-stock ${disponible ? 'en-stock' : 'sin-stock'}`}>
                    {disponible ? `✅ ${inventInfo.cantidad} disp.` : '❌ Agotado'}
                  </span>
                </div>
                <div className="dulce-cat-badge">{dulce.categoria}</div>
              </div>
            </div>
          );
        })}
      </div>

      {filtrados.length === 0 && (
        <div className="empty-state">
          <span>🔍</span>
          <p>No encontramos dulces con ese criterio.</p>
        </div>
      )}

      <div className="catalogo-stats">
        <div className="stat">
          <strong>{filtrados.filter(d => {
            const inv = getInventarioInfo(d.id);
            return inv.disponible && inv.cantidad > 0;
          }).length}</strong>
          <span>Disponibles</span>
        </div>
        <div className="stat">
          <strong>{dulces.length}</strong>
          <span>Total productos</span>
        </div>
        {loading && <div className="stat"><span>⟳ Sincronizando...</span></div>}
        <div className="stat">
          <strong>${Math.min(...dulces.map(d => d.precio)).toFixed(2)}</strong>
          <span>Desde</span>
        </div>
      </div>
    </div>
  );
}
