import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const isAdminRoute = location.pathname.startsWith('/admin');

  const links = [
    { to: '/', label: 'Inicio' },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/armar-pedido', label: 'Armar Pedido' },
    { to: '/mis-pedidos', label: 'Mis Pedidos' },
  ];

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        {!logoError ? (
          <img
            src="/img/logo-el-suspiro.jpg"
            alt="Logo Dulceria El Suspiro"
            className="brand-logo"
            onError={() => setLogoError(true)}
          />
        ) : (
          <span className="brand-icon">🍬</span>
        )}
        <span className="brand-text">El Suspiro</span>
      </Link>

      <button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)}>
        <span /><span /><span />
      </button>

      <ul className={`navbar-links ${menuOpen ? 'open' : ''}`}>
        {links.map(l => (
          <li key={l.to}>
            <Link
              to={l.to}
              className={location.pathname === l.to ? 'active' : ''}
              onClick={() => setMenuOpen(false)}
            >
              {l.label}
            </Link>
          </li>
        ))}
        <li className="admin-link">
          <Link
            to="/admin"
            className={`admin-nav-link ${isAdminRoute ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
            title="Panel de administración"
          >
            🔐
          </Link>
        </li>
      </ul>
    </nav>
  );
}
