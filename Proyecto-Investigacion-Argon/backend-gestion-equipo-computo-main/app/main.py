from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates

from app.config import settings
from app.database import engine, Base
from app.routers import equipos

# Crear tablas al iniciar (en producción usar Alembic)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description="API REST para la gestión de equipo de cómputo en laboratorios.",
)

# CORS - permitir todo para desarrollo
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Registrar routers
app.include_router(equipos.router)

# Templates para la interfaz simple
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
def frontend(request: Request):
    """Interfaz web simple para probar el CRUD."""
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/health")
def health_check():
    """Health check del servicio."""
    return {"status": "ok", "version": settings.APP_VERSION}
