# Gestión de Equipo de Cómputo - Laboratorio

Backend CRUD con FastAPI + PostgreSQL containerizado con Docker.

## Requisitos

- Docker
- Docker Compose

## Levantar el sistema

```bash
docker-compose up --build
```

## Accesos

| Recurso | URL |
|---------|-----|
| **Interfaz de prueba** | http://localhost:8000/ |
| **Documentación API (Swagger)** | http://localhost:8000/docs |
| **Documentación API (Redoc)** | http://localhost:8000/redoc |
| **Health Check** | http://localhost:8000/health |

## API Endpoints

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/equipos` | Listar equipos (paginado, con filtros) |
| `GET` | `/api/equipos/{id}` | Obtener equipo por ID |
| `POST` | `/api/equipos` | Crear nuevo equipo |
| `PUT` | `/api/equipos/{id}` | Actualizar equipo |
| `DELETE` | `/api/equipos/{id}` | Eliminar equipo |
| `GET` | `/api/equipos/stats` | Estadísticas del inventario |

## Parámetros de búsqueda (GET /api/equipos)

- `page` - Número de página (default: 1)
- `page_size` - Elementos por página (default: 20, máx: 100)
- `estado` - Filtro: activo, en_reparacion, baja, almacen
- `tipo_equipo` - Filtro: desktop, laptop, monitor, impresora, servidor, otro
- `laboratorio` - Filtro por nombre de laboratorio
- `busqueda` - Búsqueda general en inventario, marca, modelo, serie, responsable

## Detener

```bash
docker-compose down
```

## Eliminar datos

```bash
docker-compose down -v
```
