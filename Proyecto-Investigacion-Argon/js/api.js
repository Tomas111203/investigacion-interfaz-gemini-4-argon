/**
 * Cliente HTTP para la API de Gestión de Equipos de Cómputo (/api/equipos).
 * Utiliza rutas relativas conforme al contrato OpenAPI 3.1.0.
 */
const EquiposAPI = (() => {
  const BASE_URL = 'https://backend-gemini-4-argon.fly.dev/api/equipos';

  /**
   * Traduce errores de validación de FastAPI (422) o errores de negocio (404, 409)
   * a mensajes claros en español.
   */
  function parseApiError(status, data) {
    if (!data) {
      if (status === 404) return 'El equipo solicitado no fue encontrado.';
      if (status === 409) return 'Conflicto: el número de inventario o de serie ya está registrado.';
      return `Error del servidor (código HTTP ${status}).`;
    }

    if (typeof data.detail === 'string') {
      return data.detail;
    }

    if (Array.isArray(data.detail)) {
      const fieldNames = {
        numero_inventario: 'Número de inventario',
        tipo_equipo: 'Tipo de equipo',
        marca: 'Marca',
        modelo: 'Modelo',
        numero_serie: 'Número de serie',
        procesador: 'Procesador',
        ram_gb: 'Memoria RAM (GB)',
        almacenamiento: 'Almacenamiento',
        sistema_operativo: 'Sistema operativo',
        estado: 'Estado',
        laboratorio: 'Laboratorio',
        ubicacion: 'Ubicación',
        responsable: 'Responsable',
        fecha_adquisicion: 'Fecha de adquisición',
        fecha_ultima_revision: 'Fecha de última revisión',
        observaciones: 'Observaciones',
        equipo_id: 'ID del equipo'
      };

      const messages = data.detail.map((err) => {
        const loc = Array.isArray(err.loc) ? err.loc[err.loc.length - 1] : '';
        const label = fieldNames[loc] || loc || 'Campo';
        return `${label}: ${err.msg}`;
      });
      return messages.join(' | ');
    }

    return `Error en la solicitud (HTTP ${status}).`;
  }

  /**
   * Ejecuta una petición fetch con manejo uniforme de estado de conexión y errores.
   */
  async function request(path, options = {}) {
    const url = `${BASE_URL}${path}`;
    const headers = {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    };

    let response;
    try {
      response = await fetch(url, {
        ...options,
        headers
      });
      updateConnectionIndicator(true);
    } catch (networkErr) {
      updateConnectionIndicator(false);
      const err = new Error('No se pudo conectar con el servidor (/api/equipos). Verifique que el backend esté en ejecución.');
      err.status = 0;
      throw err;
    }

    if (response.status === 204) {
      return null;
    }

    let payload = null;
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      try {
        payload = await response.json();
      } catch (_) {
        payload = null;
      }
    }

    if (!response.ok) {
      const errorMessage = parseApiError(response.status, payload);
      const err = new Error(errorMessage);
      err.status = response.status;
      err.payload = payload;
      throw err;
    }

    return payload;
  }

  function updateConnectionIndicator(isOnline) {
    const indicator = document.getElementById('api-status-indicator');
    if (!indicator) return;
    const dot = indicator.querySelector('.status-dot');
    const text = indicator.querySelector('.status-text');
    if (isOnline) {
      dot?.classList.remove('error');
      if (text) text.textContent = 'Conectado a /api/equipos';
    } else {
      dot?.classList.add('error');
      if (text) text.textContent = 'Sin conexión con /api/equipos';
    }
  }

  /**
   * GET /api/equipos/stats
   * Obtiene estadísticas generales del inventario.
   */
  async function getStats() {
    return request('/stats', { method: 'GET' });
  }

  /**
   * GET /api/equipos
   * Obtiene la lista paginada de equipos con filtros opcionales.
   * @param {Object} params - { page, page_size, estado, tipo_equipo, laboratorio, busqueda }
   */
  async function listEquipos(params = {}) {
    const searchParams = new URLSearchParams();
    const page = Number(params.page) >= 1 ? Number(params.page) : 1;
    const pageSize = Number(params.page_size) >= 1 && Number(params.page_size) <= 100
      ? Number(params.page_size)
      : 20;

    searchParams.set('page', String(page));
    searchParams.set('page_size', String(pageSize));

    if (params.estado) searchParams.set('estado', params.estado);
    if (params.tipo_equipo) searchParams.set('tipo_equipo', params.tipo_equipo);
    if (params.laboratorio && params.laboratorio.trim() !== '') {
      searchParams.set('laboratorio', params.laboratorio.trim());
    }
    if (params.busqueda && params.busqueda.trim() !== '') {
      searchParams.set('busqueda', params.busqueda.trim());
    }

    return request(`?${searchParams.toString()}`, { method: 'GET' });
  }

  /**
   * GET /api/equipos/{equipo_id}
   * Obtiene el detalle de un equipo por su UUID.
   */
  async function getEquipo(equipoId) {
    return request(`/${encodeURIComponent(equipoId)}`, { method: 'GET' });
  }

  /**
   * POST /api/equipos
   * Crea un equipo nuevo (responde 201).
   */
  async function createEquipo(payload) {
    return request('', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  /**
   * PUT /api/equipos/{equipo_id}
   * Actualiza un equipo existente.
   */
  async function updateEquipo(equipoId, payload) {
    return request(`/${encodeURIComponent(equipoId)}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }

  /**
   * DELETE /api/equipos/{equipo_id}
   * Elimina un equipo existente (responde 204).
   */
  async function deleteEquipo(equipoId) {
    return request(`/${encodeURIComponent(equipoId)}`, {
      method: 'DELETE'
    });
  }

  return {
    getStats,
    listEquipos,
    getEquipo,
    createEquipo,
    updateEquipo,
    deleteEquipo
  };
})();
