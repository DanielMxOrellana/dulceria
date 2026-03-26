# Backend simple (Node + Express + PostgreSQL)

Este backend esta pensado para pruebas rapidas de conexion con PostgreSQL desde API y desde DBeaver.

## 1) Configurar variables de entorno

1. Edita el archivo `.env` dentro de `backend`.
2. Ajusta los datos de PostgreSQL.

## 2) Levantar solo backend con Docker

Desde la raiz del proyecto:

```bash
docker compose up --build backend
```

API base: `http://localhost:4000`

## 3) Levantar backend + PostgreSQL local (opcional)

```bash
docker compose up --build
```

Notas:
- El contenedor PostgreSQL queda expuesto en el puerto `5432`.

## 4) Endpoints de prueba

- `GET /api/health`

Ejemplo body para `test-write`:

```json
{
  "customerName": "Prueba DBeaver",
  "amount": 12.5
}
```

## 5) Probar con DBeaver

Crear conexion PostgreSQL con:
- Host: `localhost`
- Port: `5432`
- Database: `dulceria`
- User: `postgres`
- Password: `postgres`

Si usas PostgreSQL externo, usa sus credenciales reales.

