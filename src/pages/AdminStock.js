import React, { useState } from 'react';
import { inventoryApi } from '../services/inventoryApi';
import './Admin.css';

export default function AdminStock() {
  const [adminPassword, setAdminPassword] = useState('');
  const [sessionAdminPassword, setSessionAdminPassword] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [searchTerm, setSearchTerm] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!adminPassword.trim()) {
      setFeedback({ type: 'error', text: 'Ingresa la contraseña' });
      return;
    }

    try {
      setLoading(true);
      await inventoryApi.authenticateAdmin(adminPassword.trim());
      setSessionAdminPassword(adminPassword.trim());
      setIsAuthenticated(true);
      setFeedback(null);
      await loadInventory();
      setAdminPassword('');
    } catch (err) {
      setFeedback({ type: 'error', text: err.message || 'No se pudo iniciar sesión como admin' });
    } finally {
      setLoading(false);
    }
  };

  const loadInventory = async () => {
    try {
      setLoading(true);
      const data = await inventoryApi.getInventory();
      setInventory(data);
      setFeedback(null);
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error cargando inventario: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleEditStart = (item) => {
    setEditingId(item.CANDY_ID);
    setEditValues({
      quantity: item.QUANTITY,
      available: item.AVAILABLE,
    });
  };

  const handleEditCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleEditSave = async (id) => {
    try {
      setLoading(true);
      await inventoryApi.updateInventory(
        id,
        parseInt(editValues.quantity, 10),
        editValues.available,
        sessionAdminPassword
      );
      setFeedback({ type: 'success', text: 'Inventario actualizado correctamente' });
      setEditingId(null);
      setEditValues({});
      await loadInventory();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkRestock = async () => {
    if (!window.confirm('¿Restaurar cantidades a 100 para todos los dulces?')) return;

    try {
      setLoading(true);
      const updates = inventory.map((item) => ({
        id: item.CANDY_ID,
        quantity: 100,
        available: true,
      }));

      await inventoryApi.bulkUpdate(updates, sessionAdminPassword);
      setFeedback({ type: 'success', text: '✅ Todos los dulces restaurados a 100 unidades' });
      await loadInventory();
    } catch (err) {
      setFeedback({ type: 'error', text: 'Error: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const filteredInventory = inventory.filter((item) =>
    item.CANDY_NAME.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isAuthenticated) {
    return (
      <div className="admin-login-page">
        <div className="admin-login-container">
          <div className="admin-login-header">
            <h1>🔐 Admin Stock</h1>
            <p>Gestión de inventario de productos</p>
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
            <button type="submit" className="admin-btn btn-primary" disabled={loading}>
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
        <h1>📦 Gestión de Stock</h1>
        <div className="admin-actions">
          <button onClick={handleBulkRestock} className="admin-btn btn-restock" disabled={loading}>
            🔄 Restaurar a 100 Unidades
          </button>
          <button
            onClick={() => {
              setIsAuthenticated(false);
              setAdminPassword('');
              setSessionAdminPassword('');
              setInventory([]);
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

      <div className="admin-controls">
        <input
          type="text"
          placeholder="🔍 Buscar dulce..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="admin-search-input"
        />
        <button onClick={loadInventory} className="admin-btn btn-refresh" disabled={loading}>
          ⟳ Recargar Inventario
        </button>
      </div>

      {loading && <div className="admin-loading">Cargando...</div>}

      <div className="admin-inventory-table">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Nombre del Dulce</th>
              <th>Cantidad</th>
              <th>Disponible</th>
              <th>Precio</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item) => (
              <tr key={item.CANDY_ID} className={editingId === item.CANDY_ID ? 'editing' : ''}>
                <td>{item.CANDY_ID}</td>
                <td className="candy-name">{item.CANDY_NAME}</td>
                <td>
                  {editingId === item.CANDY_ID ? (
                    <input
                      type="number"
                      min="0"
                      value={editValues.quantity}
                      onChange={(e) => setEditValues({ ...editValues, quantity: e.target.value })}
                      className="admin-input-small"
                    />
                  ) : (
                    <span className={item.QUANTITY === 0 ? 'agotado' : ''}>{item.QUANTITY} unidades</span>
                  )}
                </td>
                <td>
                  {editingId === item.CANDY_ID ? (
                    <label className="checkbox-label">
                      <input
                        type="checkbox"
                        checked={Boolean(editValues.available)}
                        onChange={(e) => setEditValues({ ...editValues, available: e.target.checked })}
                      />
                      {editValues.available ? '✅' : '❌'}
                    </label>
                  ) : (
                    <span>{item.AVAILABLE ? '✅ Disponible' : '❌ No disponible'}</span>
                  )}
                </td>
                <td>${Number(item.PRICE || 0).toFixed(2)}</td>
                <td className="actions-cell">
                  {editingId === item.CANDY_ID ? (
                    <>
                      <button
                        onClick={() => handleEditSave(item.CANDY_ID)}
                        className="admin-btn btn-small btn-save"
                        disabled={loading}
                      >
                        ✓ Guardar
                      </button>
                      <button onClick={handleEditCancel} className="admin-btn btn-small btn-cancel" disabled={loading}>
                        ✕ Cancelar
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleEditStart(item)} className="admin-btn btn-small btn-edit">
                      ✏️ Editar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredInventory.length === 0 && (
          <div className="empty-state">
            <p>No hay dulces que coincidan con la búsqueda</p>
          </div>
        )}
      </div>

      <div className="admin-stats">
        <div className="stat">
          <strong>{inventory.filter((i) => i.AVAILABLE).length}</strong>
          <span>Disponibles</span>
        </div>
        <div className="stat">
          <strong>{inventory.filter((i) => i.QUANTITY === 0).length}</strong>
          <span>Agotados</span>
        </div>
        <div className="stat">
          <strong>{inventory.length}</strong>
          <span>Total Dulces</span>
        </div>
      </div>
    </div>
  );
}
