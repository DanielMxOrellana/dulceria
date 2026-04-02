import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const location = useLocation();
  const { user, accountName, signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const isAdminRoute = location.pathname.startsWith('/admin');
  const isLocalhost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const showAdminLink = process.env.REACT_APP_SHOW_ADMIN_LINK === 'true' || isLocalhost;

  const links = [
    { to: '/', label: 'Inicio' },
    { to: '/catalogo', label: 'Catálogo' },
    { to: '/armar-pedido', label: 'Armar Pedido' },
    { to: '/mis-pedidos', label: 'Mis Pedidos' },
  ];

  const handleSignOut = async () => {
    try {
      await signOut();
      setMenuOpen(false);
    } catch (_err) {
      // no-op
    }
  };

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        {!logoError ? (
          <img
            src="/img/logo-el-suspiro-nuevo.svg"
            alt="Logo Dulcería El Suspiro"
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
        {showAdminLink && (
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
        )}
        <li>
          {user ? (
            <div className="account-box">
              <span className="account-label" title={`En tu cuenta: ${accountName}`}>
                En tu cuenta: {accountName}
              </span>
              <button className="auth-nav-btn" onClick={handleSignOut} title="Cerrar sesión">
                Salir
              </button>
            </div>
          ) : (
            <Link to="/login" onClick={() => setMenuOpen(false)}>
              Ingresar
            </Link>
          )}
        </li>
      </ul>
    </nav>
  );
}
