import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import TipoEquipo, EstadoEquipo
from app.schemas import (
    EquipoCreate,
    EquipoUpdate,
    EquipoResponse,
    EquipoListResponse,
    StatsResponse,
)
from app import crud

router = APIRouter(prefix="/api/equipos", tags=["Equipos"])


@router.get("/stats", response_model=StatsResponse)
def obtener_estadisticas(db: Session = Depends(get_db)):
    """Obtener estadísticas generales del inventario."""
    return crud.get_stats(db)


@router.get("", response_model=EquipoListResponse)
def listar_equipos(
    page: int = Query(1, ge=1, description="Número de página"),
    page_size: int = Query(20, ge=1, le=100, description="Elementos por página"),
    estado: Optional[EstadoEquipo] = Query(None, description="Filtrar por estado"),
    tipo_equipo: Optional[TipoEquipo] = Query(None, description="Filtrar por tipo"),
    laboratorio: Optional[str] = Query(None, description="Filtrar por laboratorio"),
    busqueda: Optional[str] = Query(None, description="Búsqueda general"),
    db: Session = Depends(get_db),
):
    """Listar equipos con filtros y paginación."""
    skip = (page - 1) * page_size
    equipos, total = crud.get_equipos(
        db,
        skip=skip,
        limit=page_size,
        estado=estado,
        tipo_equipo=tipo_equipo,
        laboratorio=laboratorio,
        busqueda=busqueda,
    )
    return EquipoListResponse(
        total=total,
        page=page,
        page_size=page_size,
        equipos=equipos,
    )


@router.get("/{equipo_id}", response_model=EquipoResponse)
def obtener_equipo(equipo_id: uuid.UUID, db: Session = Depends(get_db)):
    """Obtener un equipo por su ID."""
    equipo = crud.get_equipo(db, equipo_id)
    if not equipo:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return equipo


@router.post("", response_model=EquipoResponse, status_code=201)
def crear_equipo(equipo: EquipoCreate, db: Session = Depends(get_db)):
    """Crear un nuevo equipo de cómputo."""
    # Verificar que el número de inventario no exista
    existente_inv = crud.get_equipo_by_inventario(db, equipo.numero_inventario)
    if existente_inv:
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe un equipo con el número de inventario '{equipo.numero_inventario}'",
        )

    # Verificar que el número de serie no exista
    existente = crud.get_equipo_by_serie(db, equipo.numero_serie)
    if existente:
        raise HTTPException(
            status_code=409,
            detail=f"Ya existe un equipo con el número de serie '{equipo.numero_serie}'",
        )

    return crud.create_equipo(db, equipo.model_dump())


@router.put("/{equipo_id}", response_model=EquipoResponse)
def actualizar_equipo(
    equipo_id: uuid.UUID, equipo: EquipoUpdate, db: Session = Depends(get_db)
):
    """Actualizar un equipo existente."""
    # Si se actualiza el número de inventario, verificar que no exista
    if equipo.numero_inventario:
        existente_inv = crud.get_equipo_by_inventario(db, equipo.numero_inventario)
        if existente_inv and existente_inv.id != equipo_id:
            raise HTTPException(
                status_code=409,
                detail=f"Ya existe otro equipo con el número de inventario '{equipo.numero_inventario}'",
            )

    # Si se actualiza el número de serie, verificar que no exista
    if equipo.numero_serie:
        existente = crud.get_equipo_by_serie(db, equipo.numero_serie)
        if existente and existente.id != equipo_id:
            raise HTTPException(
                status_code=409,
                detail=f"Ya existe otro equipo con el número de serie '{equipo.numero_serie}'",
            )

    actualizado = crud.update_equipo(db, equipo_id, equipo.model_dump(exclude_unset=True))
    if not actualizado:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return actualizado


@router.delete("/{equipo_id}", status_code=204)
def eliminar_equipo(equipo_id: uuid.UUID, db: Session = Depends(get_db)):
    """Eliminar un equipo del inventario."""
    eliminado = crud.delete_equipo(db, equipo_id)
    if not eliminado:
        raise HTTPException(status_code=404, detail="Equipo no encontrado")
    return None
