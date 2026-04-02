import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { CarritoProvider } from './context/CarritoContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Inicio from './pages/Inicio';
import Catalogo from './pages/Catalogo';
import ArmarPedido from './pages/ArmarPedido';
import MisPedidos from './pages/MisPedidos';
import AuthPage from './pages/Auth';
import Admin from './pages/Admin';
import AdminStock from './pages/AdminStock';
import AdminPedidos from './pages/AdminPedidos';
import './index.css';

function AdminGate({ children }) {
  const location = useLocation();
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);

  if (isLocalhost) {
    return children;
  }

  const requiredKey = process.env.REACT_APP_ADMIN_GATE_KEY || '';
  if (!requiredKey) {
    return <Navigate to="/" replace />;
  }

  const keyFromUrl = new URLSearchParams(location.search).get('k') || '';
  if (keyFromUrl !== requiredKey) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function UserGate({ children }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Cargando...</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <CarritoProvider>
        <BrowserRouter>
          <div className="page-wrapper">
            <Navbar />
            <main className="page-content">
              <Routes>
                <Route path="/" element={<Inicio />} />
                <Route path="/catalogo" element={<UserGate><Catalogo /></UserGate>} />
                <Route path="/login" element={<AuthPage />} />
                <Route path="/armar-pedido" element={<UserGate><ArmarPedido /></UserGate>} />
                <Route path="/mis-pedidos" element={<UserGate><MisPedidos /></UserGate>} />
                <Route path="/admin" element={<AdminGate><Admin /></AdminGate>} />
                <Route path="/admin/stock" element={<AdminGate><AdminStock /></AdminGate>} />
                <Route path="/admin/pedidos" element={<AdminGate><AdminPedidos /></AdminGate>} />
              </Routes>
            </main>
            <footer>
              🍬 El Suspiro © {new Date().getFullYear()} — Todos los derechos reservados
            </footer>
          </div>
        </BrowserRouter>
      </CarritoProvider>
    </AuthProvider>
  );
}
