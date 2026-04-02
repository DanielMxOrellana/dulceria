import React, { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "./Auth.css";

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || "").trim());
}

function mapAuthError(error) {
  const message = String(error?.message || "");
  const lower = message.toLowerCase();

  const waitMatch = message.match(/after\s+(\d+)\s+seconds?/i);
  if (waitMatch) {
    const seconds = waitMatch[1];
    return `Por seguridad, espera ${seconds} segundos e intenta nuevamente.`;
  }

  if (lower.includes("invalid login credentials")) {
    return "Correo o contrasena incorrectos.";
  }

  if (lower.includes("email not confirmed")) {
    return "Tu correo aun no esta confirmado en Supabase. Si quieres entrar sin correo activo, desactiva Confirm email en Authentication > Providers > Email.";
  }

  if (lower.includes("user already registered")) {
    return "Este correo ya esta registrado. Inicia sesion.";
  }

  if (lower.includes("email rate limit exceeded")) {
    return "Se alcanzo el limite de correos por minuto. Espera 1-2 minutos e intenta nuevamente.";
  }

  if (lower.includes("security purposes") || lower.includes("too many requests")) {
    return "Demasiados intentos seguidos. Espera un momento y vuelve a intentar.";
  }

  return message || "No se pudo completar la operacion.";
}

function isRateLimitError(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("email rate limit exceeded") || message.includes("too many requests") || message.includes("security purposes");
}

function isInvalidCredentialsError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("invalid login credentials") ||
    message.includes("invalid credentials") ||
    message.includes("correo o contrasena incorrectos")
  );
}

export default function AuthPage() {
  const { user, signIn, signUp } = useAuth();
  const [mode, setMode] = useState("login");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [retryAt, setRetryAt] = useState(0);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const title = useMemo(
    () => (mode === "login" ? "Iniciar sesion" : "Crear cuenta"),
    [mode]
  );

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event) => {
        if (retryAt > Date.now()) {
          const waitSeconds = Math.ceil((retryAt - Date.now()) / 1000);
          setError(`Espera ${waitSeconds} segundos antes de volver a intentar.`);
          return;
        }

    event.preventDefault();
    setError("");
    setSuccess("");

    const cleanEmail = String(email || "").trim().toLowerCase();
    if (!isValidEmail(cleanEmail)) {
      setError("Ingresa un correo valido.");
      return;
    }

    if (String(password || "").length < 6) {
      setError("La contrasena debe tener al menos 6 caracteres.");
      return;
    }

    if (mode === "register" && !String(fullName || "").trim()) {
      setError("Ingresa tu nombre completo.");
      return;
    }

    try {
      setLoading(true);

      if (mode === "login") {
        await signIn({ email: cleanEmail, password });
        setSuccess("Sesion iniciada correctamente.");
      } else {
        try {
          await signIn({ email: cleanEmail, password });
          setSuccess("Esta cuenta ya existe. Sesion iniciada correctamente.");
          return;
        } catch (signInErr) {
          if (!isInvalidCredentialsError(signInErr)) {
            throw signInErr;
          }
        }

        const data = await signUp({
          email: cleanEmail,
          password,
          fullName: fullName.trim(),
          phone: phone.trim(),
        });

        if (data?.session) {
          setSuccess("Cuenta creada y sesion iniciada.");
        } else {
          try {
            await signIn({ email: cleanEmail, password });
            setSuccess("Cuenta creada y sesion iniciada.");
          } catch (_autoLoginErr) {
            setSuccess(
              "Cuenta creada. Si no inicia sesion automaticamente, desactiva Confirm email en Supabase para permitir acceso sin correo activo."
            );
          }
        }
      }
    } catch (err) {
      if (mode === "register" && isRateLimitError(err)) {
        try {
          await signIn({ email: cleanEmail, password });
          setSuccess("Tu cuenta ya estaba creada. Sesion iniciada correctamente.");
          setError("");
          return;
        } catch (_signInErr) {
          setRetryAt(Date.now() + 120000);
        }
      }

      setError(mapAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{title}</h1>
        <p className="auth-subtitle">Inicia sesion para entrar. Si aun no tienes cuenta, primero registrate con un correo valido.</p>

        {error && <div className="auth-feedback auth-error">{error}</div>}
        {success && <div className="auth-feedback auth-success">{success}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === "register" && (
            <>
              <label htmlFor="fullName">Nombre completo</label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ej: Juan Perez"
                required
              />

              <label htmlFor="phone">Telefono (opcional)</label>
              <input
                id="phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Ej: 0999888777"
              />
            </>
          )}

          <label htmlFor="email">Correo</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu-correo@ejemplo.com"
            required
          />

          <label htmlFor="password">Contrasena</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimo 6 caracteres"
            required
          />

          <button type="submit" disabled={loading || retryAt > Date.now()}>
            {loading ? "Procesando..." : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <div className="auth-footer">
          {mode === "login" ? (
            <p>
              No tienes cuenta?{" "}
              <button type="button" onClick={() => setMode("register")} className="auth-link-btn">
                Registrate
              </button>
            </p>
          ) : (
            <p>
              Ya tienes cuenta?{" "}
              <button type="button" onClick={() => setMode("login")} className="auth-link-btn">
                Inicia sesion
              </button>
            </p>
          )}

          <Link to="/" className="auth-back-link">Volver al inicio</Link>
        </div>
      </div>
    </div>
  );
}
