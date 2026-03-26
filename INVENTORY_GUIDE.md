# 📊 Sistema de Gestión de Inventario - Dulcería El Suspiro

## Descripción General

El sistema de inventario permite a los administradores:
- ✅ Ver cantidad disponible de cada dulce en tiempo real
- ✅ Actualizar cantidades manualmente cuando se agote un producto
- ✅ Marcar productos como disponibles o agotados
- ✅ Restaurar cantidades en lote a 100 unidades
- ✅ Los usuarios ven automáticamente las cantidades actualizadas en el catálogo

## Acceso al Panel de Administración

### 1. Navegar al Panel
- Abre la aplicación en [http://localhost:3000](http://localhost:3000)
- Busca el icono 🔐 en la navegación (arriba a la derecha)
- O accede directamente a [http://localhost:3000/admin](http://localhost:3000/admin)

### 2. Iniciar Sesión
- **Contraseña por defecto**: `admin123`
- Cambiar en el archivo `backend/.env`:
  ```bash
  ADMIN_PASSWORD=tu_nueva_contraseña
  ```

## Uso del Panel

### Ver Inventario
- Se carga automáticamente al ingresar al panel
- Muestra: ID, Nombre, Cantidad, Disponibilidad, Precio

### Buscar un Dulce
- Usa la barra de búsqueda (🔍) para filtrar dulces por nombre

### Actualizar Cantidad de un Dulce
1. Encuentra el dulce en la tabla
2. Haz clic en el botón **✏️ Editar**
3. Cambia la cantidad y disponibilidad
4. Haz clic en **✓ Guardar**
5. Recibirás confirmación ✅

### Actualizar en Lote
- Haz clic en **🔄 Restaurar a 100 Unidades**
- Confirma la acción
- Todos los dulces se restablecerán a 100 unidades

### Recargar Datos
- Haz clic en **⟳ Recargar** para sincronizar datos desde la BD

### Cerrar Sesión
- Haz clic en **🚪 Cerrar Sesión** para salir del panel

## Cómo Funciona Automáticamente

### Sincronización en Tiempo Real
- El catálogo se actualiza cada 30 segundos
- Los usuarios siempre ven cantidades actuales
- Si un producto llega a 0 unidades, se marca como "❌ Agotado"

### Gestión Automática
- **Al crear una orden**, el inventario se disminuye automáticamente
- **Al agotar productos**, se marcan como no disponibles
- **Historial**: Todos los cambios se guardan en la BD

## Variables de Entorno

En `backend/.env`:

```bash
# Puerto del backend
PORT=4000

# Conexión a DB2
DB2_HOST=host.docker.internal
DB2_PORT=50001
DB2_DATABASE=BLUDB
DB2_USER=db2inst1
DB2_PASSWORD=admin123

# Esquema (usar el mismo de ORDERS)
DB2_SCHEMA=DB2INST1

# Contraseña de administrador (CAMBIAR EN PRODUCCIÓN)
ADMIN_PASSWORD=admin123
```

## Estructura de BD

### Tabla: INVENTORY
```sql
CREATE TABLE DB2INST1.INVENTORY (
  candy_id INTEGER PRIMARY KEY,           -- ID del dulce
  candy_name VARCHAR(255) NOT NULL,       -- Nombre del dulce
  quantity INTEGER NOT NULL DEFAULT 100,  -- Cantidad disponible
  price DECIMAL(10, 2) NOT NULL,          -- Precio unitario
  available SMALLINT NOT NULL DEFAULT 1,  -- 1=disponible, 0=agotado
  updated_at TIMESTAMP DEFAULT NOW()      -- Última actualización
)
```

## API de Inventario

### GET /api/inventory
Obtener inventario completo (público)

**Respuesta:**
```json
{
  "ok": true,
  "inventory": [
    {
      "CANDY_ID": 1,
      "CANDY_NAME": "Galletas Con Mermelada",
      "QUANTITY": 50,
      "PRICE": 0.25,
      "AVAILABLE": 1,
      "UPDATED_AT": "2025-03-19 10:30:00"
    }
  ]
}
```

### GET /api/inventory/:id
Obtener un dulce específico (público)

**Ejemplo:** `GET /api/inventory/1`

### PUT /api/inventory/:id
Actualizar cantidad de un dulce (ADMIN)

**Headers:**
```bash
X-Admin-Password: admin123
```

**Body:**
```json
{
  "quantity": 75,
  "available": 1
}
```

### PUT /api/inventory/:id/decrease
Disminuir cantidad (automático al crear orden)

**Body:**
```json
{
  "amount": 5
}
```

### PUT /api/inventory/bulk/update
Actualizar múltiples (ADMIN)

**Headers:**
```bash
X-Admin-Password: admin123
```

**Body:**
```json
{
  "updates": [
    { "id": 1, "quantity": 100, "available": true },
    { "id": 2, "quantity": 50, "available": true }
  ]
}
```

## Seguridad

⚠️ **Importante en Producción:**

1. **Cambiar contraseña de admin** en `backend/.env`
2. **Usar HTTPS** (no HTTP)
3. **Proteger variables de entorno** con secretos seguros
4. **Habilitar autenticación adicional** (tokens JWT, etc.)
5. **Auditar cambios** de inventario
6. **Backup regular** de la BD

## Solución de Problemas

### "No se cargó inventario en tiempo real"
- Verificar que el backend esté corriendo: `npm run backend`
- Revisar conexión a DB2
- Ver consola del navegador (F12) para más detalles

### Tabla INVENTORY no se crea
- Asegúrate that backend esté conectado a DB2
- Verifica que `DB2_SCHEMA` sea correcto en `.env`
- Reinicia el backend: `npm run backend`

### Cantidades no se actualizan
- Espera 30 segundos (tiempo de sincronización)
- Haz clic en ⟳ Recargar
- Verifica que hayas guardado los cambios correctamente

## Flujo Completo de Ejemplo

1. **Admin abre panel** → Ingresa contraseña → Ve inventario
2. **Usuario abre catálogo** → Ve dulces con cantidades actuales
3. **Admin actualiza cantidad** → Ej: Galletas: 100 → 30
4. **Usuario recarga** → Ve nuevas cantidades (30 galletas)
5. **Usuario hace pedido** → Selecciona 5 galletas
6. **Sistema disminuye** → Galletas: 30 → 25 (automático)
7. **Admin ve actualización** → Presiona ⟳ Recargar

## Contacto & Soporte

Para preguntas o reportar bugs, contacta al equipo de desarrollo.

---

**Versión:** 1.0 | **Última actualización:** Marzo 2025
