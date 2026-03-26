import React from 'react';
import { Link } from 'react-router-dom';
import './Admin.css';

export default function Admin() {
  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>🔐 Panel de Administración</h1>
      </div>

      <div className="admin-section-links">
        <Link to="/admin/stock" className="admin-section-card">
          <h2>📦 Gestión de Stock</h2>
          <p>Actualiza cantidad disponible y restablece inventario.</p>
        </Link>

        <Link to="/admin/pedidos" className="admin-section-card">
          <h2>🧾 Gestión de Pedidos</h2>
          <p>Revisa detalle del cliente y acepta pedidos pendientes.</p>
        </Link>
      </div>
    </div>
  );
}
