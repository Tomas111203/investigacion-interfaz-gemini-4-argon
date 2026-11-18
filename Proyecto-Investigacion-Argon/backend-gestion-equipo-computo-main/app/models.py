import uuid
from datetime import datetime, date

from sqlalchemy import Column, String, Integer, Text, Date, DateTime, Enum as SAEnum
from sqlalchemy.dialects.postgresql import UUID

from app.database import Base

import enum


class TipoEquipo(str, enum.Enum):
    desktop = "desktop"
    laptop = "laptop"
    monitor = "monitor"
    impresora = "impresora"
    servidor = "servidor"
    otro = "otro"


class EstadoEquipo(str, enum.Enum):
    activo = "activo"
    en_reparacion = "en_reparacion"
    baja = "baja"
    almacen = "almacen"


class Equipo(Base):
    __tablename__ = "equipos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    numero_inventario = Column(String(100), unique=True, nullable=False, index=True)
    tipo_equipo = Column(SAEnum(TipoEquipo), nullable=False, default=TipoEquipo.desktop)
    marca = Column(String(100), nullable=False)
    modelo = Column(String(150), nullable=False)
    numero_serie = Column(String(200), unique=True, nullable=False, index=True)
    procesador = Column(String(200), nullable=True)
    ram_gb = Column(Integer, nullable=True)
    almacenamiento = Column(String(200), nullable=True)
    sistema_operativo = Column(String(150), nullable=True)
    estado = Column(SAEnum(EstadoEquipo), nullable=False, default=EstadoEquipo.activo)
    laboratorio = Column(String(150), nullable=False)
    ubicacion = Column(String(200), nullable=True)
    responsable = Column(String(200), nullable=True)
    fecha_adquisicion = Column(Date, nullable=True)
    fecha_ultima_revision = Column(Date, nullable=True)
    observaciones = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
