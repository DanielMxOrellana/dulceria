import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { CarritoProvider } from './context/CarritoContext';
import Navbar from './components/Navbar';
import Inicio from './pages/Inicio';
import Catalogo from './pages/Catalogo';
import ArmarPedido from './pages/ArmarPedido';
import MisPedidos from './pages/MisPedidos';
import Admin from './pages/Admin';
import AdminStock from './pages/AdminStock';
import AdminPedidos from './pages/AdminPedidos';
import './index.css';

export default function App() {
  return (
    <CarritoProvider>
      <BrowserRouter>
        <div className="page-wrapper">
          <Navbar />
          <main className="page-content">
            <Routes>
              <Route path="/" element={<Inicio />} />
              <Route path="/catalogo" element={<Catalogo />} />
              <Route path="/armar-pedido" element={<ArmarPedido />} />
              <Route path="/mis-pedidos" element={<MisPedidos />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/stock" element={<AdminStock />} />
              <Route path="/admin/pedidos" element={<AdminPedidos />} />
            </Routes>
          </main>
          <footer>
            🍬 El Suspiro © {new Date().getFullYear()} — Todos los derechos reservados
          </footer>
        </div>
      </BrowserRouter>
    </CarritoProvider>
  );
}
