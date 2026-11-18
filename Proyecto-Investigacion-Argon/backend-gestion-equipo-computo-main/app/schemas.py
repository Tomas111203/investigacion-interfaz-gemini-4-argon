import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.models import TipoEquipo, EstadoEquipo


# --- Schemas de entrada ---

class EquipoCreate(BaseModel):
    numero_inventario: str = Field(..., min_length=1, max_length=100, examples=["INV-2024-001"])
    tipo_equipo: TipoEquipo = Field(default=TipoEquipo.desktop)
    marca: str = Field(..., min_length=1, max_length=100, examples=["Dell"])
    modelo: str = Field(..., min_length=1, max_length=150, examples=["OptiPlex 7090"])
    numero_serie: str = Field(..., min_length=1, max_length=200, examples=["SN-ABC123456"])
    procesador: Optional[str] = Field(None, max_length=200, examples=["Intel Core i7-11700"])
    ram_gb: Optional[int] = Field(None, ge=1, le=1024, examples=[16])
    almacenamiento: Optional[str] = Field(None, max_length=200, examples=["512GB SSD"])
    sistema_operativo: Optional[str] = Field(None, max_length=150, examples=["Windows 11 Pro"])
    estado: EstadoEquipo = Field(default=EstadoEquipo.activo)
    laboratorio: str = Field(..., min_length=1, max_length=150, examples=["Laboratorio A"])
    ubicacion: Optional[str] = Field(None, max_length=200, examples=["Mesa 5, Fila 2"])
    responsable: Optional[str] = Field(None, max_length=200, examples=["Ing. Juan Pérez"])
    fecha_adquisicion: Optional[date] = None
    fecha_ultima_revision: Optional[date] = None
    observaciones: Optional[str] = None


class EquipoUpdate(BaseModel):
    numero_inventario: Optional[str] = Field(None, min_length=1, max_length=100)
    tipo_equipo: Optional[TipoEquipo] = None
    marca: Optional[str] = Field(None, min_length=1, max_length=100)
    modelo: Optional[str] = Field(None, min_length=1, max_length=150)
    numero_serie: Optional[str] = Field(None, min_length=1, max_length=200)
    procesador: Optional[str] = Field(None, max_length=200)
    ram_gb: Optional[int] = Field(None, ge=1, le=1024)
    almacenamiento: Optional[str] = Field(None, max_length=200)
    sistema_operativo: Optional[str] = Field(None, max_length=150)
    estado: Optional[EstadoEquipo] = None
    laboratorio: Optional[str] = Field(None, min_length=1, max_length=150)
    ubicacion: Optional[str] = Field(None, max_length=200)
    responsable: Optional[str] = Field(None, max_length=200)
    fecha_adquisicion: Optional[date] = None
    fecha_ultima_revision: Optional[date] = None
    observaciones: Optional[str] = None


# --- Schemas de salida ---

class EquipoResponse(BaseModel):
    id: uuid.UUID
    numero_inventario: str
    tipo_equipo: TipoEquipo
    marca: str
    modelo: str
    numero_serie: str
    procesador: Optional[str] = None
    ram_gb: Optional[int] = None
    almacenamiento: Optional[str] = None
    sistema_operativo: Optional[str] = None
    estado: EstadoEquipo
    laboratorio: str
    ubicacion: Optional[str] = None
    responsable: Optional[str] = None
    fecha_adquisicion: Optional[date] = None
    fecha_ultima_revision: Optional[date] = None
    observaciones: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EquipoListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    equipos: list[EquipoResponse]


class StatsResponse(BaseModel):
    total_equipos: int
    por_estado: dict[str, int]
    por_tipo: dict[str, int]
    por_laboratorio: dict[str, int]
