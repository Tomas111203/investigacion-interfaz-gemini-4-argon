import uuid
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Equipo, TipoEquipo, EstadoEquipo


def get_equipos(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    estado: Optional[EstadoEquipo] = None,
    tipo_equipo: Optional[TipoEquipo] = None,
    laboratorio: Optional[str] = None,
    busqueda: Optional[str] = None,
) -> tuple[list[Equipo], int]:
    """Obtener lista de equipos con filtros y paginación."""
    query = db.query(Equipo)

    if estado:
        query = query.filter(Equipo.estado == estado)
    if tipo_equipo:
        query = query.filter(Equipo.tipo_equipo == tipo_equipo)
    if laboratorio:
        query = query.filter(Equipo.laboratorio.ilike(f"%{laboratorio}%"))
    if busqueda:
        search_term = f"%{busqueda}%"
        query = query.filter(
            Equipo.numero_inventario.ilike(search_term)
            | Equipo.marca.ilike(search_term)
            | Equipo.modelo.ilike(search_term)
            | Equipo.numero_serie.ilike(search_term)
            | Equipo.responsable.ilike(search_term)
        )

    total = query.count()
    equipos = query.order_by(Equipo.created_at.desc()).offset(skip).limit(limit).all()
    return equipos, total


def get_equipo(db: Session, equipo_id: uuid.UUID) -> Optional[Equipo]:
    """Obtener un equipo por su ID."""
    return db.query(Equipo).filter(Equipo.id == equipo_id).first()


def get_equipo_by_serie(db: Session, numero_serie: str) -> Optional[Equipo]:
    """Obtener un equipo por su número de serie."""
    return db.query(Equipo).filter(Equipo.numero_serie == numero_serie).first()


def get_equipo_by_inventario(db: Session, numero_inventario: str) -> Optional[Equipo]:
    """Obtener un equipo por su número de inventario."""
    return db.query(Equipo).filter(Equipo.numero_inventario == numero_inventario).first()


def create_equipo(db: Session, equipo_data: dict) -> Equipo:
    """Crear un nuevo equipo."""
    db_equipo = Equipo(**equipo_data)
    db.add(db_equipo)
    db.commit()
    db.refresh(db_equipo)
    return db_equipo


def update_equipo(db: Session, equipo_id: uuid.UUID, equipo_data: dict) -> Optional[Equipo]:
    """Actualizar un equipo existente."""
    db_equipo = db.query(Equipo).filter(Equipo.id == equipo_id).first()
    if not db_equipo:
        return None

    for key, value in equipo_data.items():
        if value is not None:
            setattr(db_equipo, key, value)

    db.commit()
    db.refresh(db_equipo)
    return db_equipo


def delete_equipo(db: Session, equipo_id: uuid.UUID) -> bool:
    """Eliminar un equipo."""
    db_equipo = db.query(Equipo).filter(Equipo.id == equipo_id).first()
    if not db_equipo:
        return False

    db.delete(db_equipo)
    db.commit()
    return True


def get_stats(db: Session) -> dict:
    """Obtener estadísticas generales."""
    total = db.query(Equipo).count()

    # Conteo por estado
    por_estado_rows = (
        db.query(Equipo.estado, func.count(Equipo.id))
        .group_by(Equipo.estado)
        .all()
    )
    por_estado = {row[0].value: row[1] for row in por_estado_rows}

    # Conteo por tipo
    por_tipo_rows = (
        db.query(Equipo.tipo_equipo, func.count(Equipo.id))
        .group_by(Equipo.tipo_equipo)
        .all()
    )
    por_tipo = {row[0].value: row[1] for row in por_tipo_rows}

    # Conteo por laboratorio
    por_lab_rows = (
        db.query(Equipo.laboratorio, func.count(Equipo.id))
        .group_by(Equipo.laboratorio)
        .all()
    )
    por_laboratorio = {row[0]: row[1] for row in por_lab_rows}

    return {
        "total_equipos": total,
        "por_estado": por_estado,
        "por_tipo": por_tipo,
        "por_laboratorio": por_laboratorio,
    }
