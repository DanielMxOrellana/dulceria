import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { tiposFundas, tiposDesechables, tiposCanastos } from '../data/productos';
import './Inicio.css';

const pasos = [
  { num: '01', titulo: 'Elige tu empaque', desc: 'Funda, canasto o caja según la ocasión y tu presupuesto.' },
  { num: '02', titulo: 'Selecciona dulces', desc: 'Más de 50 clases de dulces de antaño y actuales para personalizar a tu gusto.' },
  { num: '03', titulo: 'Confirma el pedido', desc: 'Revisa tu pedido y recíbelo listo para entregar.' },
];

const gruposEmpaques = [
  {
    key: 'funda',
    titulo: 'Fundas',
    subtitulo: 'Opciones disponibles',
    items: tiposFundas,
  },
  {
    key: 'desechable',
    titulo: 'Desechables',
    subtitulo: 'Cajas por tamaño',
    items: tiposDesechables,
  },
  {
    key: 'canasto',
    titulo: 'Canastos',
    subtitulo: 'Canastos artesanales',
    items: tiposCanastos,
  },
];

export default function Inicio() {
  const [heroLogoError, setHeroLogoError] = useState(false);

  return (
    <div className="inicio">

      {/* HERO INFO */}
      <section className="hero-info">
        <div className="hi-visual">
          <div className="hi-blob">
            {!heroLogoError ? (
              <img
                src="/img/logo-el-suspiro-nuevo.svg"
                alt="Logo El Suspiro"
                className="hi-logo"
                onError={() => setHeroLogoError(true)}
              />
            ) : (
              <span className="hi-big-emoji">🍭</span>
            )}
          </div>
        </div>

        <div className="hero-info-inner">
          <p className="hi-eyebrow">🍭 Dulcería tradicional · más de 30 años</p>
          <h1 className="hi-title">
            Endulzando cada<br />
            <span className="hi-accent">momento desde 1994</span>
          </h1>
          <p className="hi-desc">
            Somos una dulcería familiar con más de <strong>50 clases de dulces</strong> de antaño y actuales.
            Atendemos todo el año y <strong>hacemos envíos a todo el país 🇪🇨</strong>.
          </p>

          <div className="hi-chips">
            <span className="hi-chip">📦 Envíos a todo Ecuador</span>
            <span className="hi-chip">🍬 50+ tipos de dulces</span>
            <span className="hi-chip">🤗 Negocio familiar</span>
          </div>

          <div className="hi-contacto">
            <a href="tel:+593997880280" className="hi-contact-link">
              <span className="hi-contact-icon">📞</span>
              <span>0997 880 280 &nbsp;·&nbsp; 2839541</span>
            </a>
            <a href="https://instagram.com/dulceriaelsuspiro" target="_blank" rel="noreferrer" className="hi-contact-link">
              <span className="hi-contact-icon">📸</span>
              <span>@dulceriaelsuspiro</span>
            </a>
          </div>

          <div className="hi-actions">
            <Link to="/armar-pedido" className="btn-primary">Armar mi pedido 🎁</Link>
            <Link to="/catalogo" className="btn-secondary">Ver catálogo</Link>
          </div>
        </div>
      </section>

      {/* PASOS */}
      <section className="steps-section">
        <h2 className="section-title">¿Cómo funciona?</h2>
        <div className="steps-row">
          {pasos.map((p, i) => (
            <React.Fragment key={i}>
              <div className="step-item">
                <div className="step-num">{p.num}</div>
                <h3 className="step-titulo">{p.titulo}</h3>
                <p className="step-desc">{p.desc}</p>
              </div>
              {i < pasos.length - 1 && <div className="step-arrow">→</div>}
            </React.Fragment>
          ))}
        </div>
      </section>

      {/* TIPOS */}
      <section className="tipos-section">
        <h2 className="section-title">Nuestros empaques</h2>
        <div className="empaques-stack">
          {gruposEmpaques.map(grupo => (
            <section key={grupo.key} className="empaque-grupo">
              <header className="empaque-grupo-header">
                <h3>{grupo.titulo}</h3>
                <span>{grupo.subtitulo}</span>
              </header>

              <div className="tipos-grid">
                {grupo.items.map(item => (
                  <div key={item.id} className="tipo-card">
                    <div className="tipo-emoji">{item.emoji}</div>
                    <h3>{item.nombre}</h3>
                    <p>{item.descripcion}</p>
                    <div className="tipo-footer">
                      <span className="tipo-precio">${item.precio.toFixed(2)}</span>
                      <Link to="/armar-pedido" className="tipo-link">Personalizar →</Link>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </section>

    </div>
  );
}