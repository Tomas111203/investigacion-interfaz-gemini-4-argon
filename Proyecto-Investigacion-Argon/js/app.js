/**
 * Aplicación SPA en Vanilla JavaScript para la Gestión de Equipos de Cómputo.
 * Implementa enrutamiento por URL con History API:
 *  - / o /estadisticas        -> Estadísticas generales del inventario
 *  - /equipos                 -> Listado paginado y filtrado de equipos
 *  - /equipos/nuevo           -> Formulario de registro de nuevo equipo
 *  - /equipos/{id}            -> Consulta de detalle completo de un equipo
 *  - /equipos/{id}/editar     -> Formulario de edición de un equipo existente
 */
(() => {
  // Catálogos oficiales según el contrato OpenAPI
  const ESTADOS_EQUIPO = {
    activo: { label: 'Activo', badgeClass: 'badge-activo', barClass: 'estado-activo' },
    en_reparacion: { label: 'En reparación', badgeClass: 'badge-en_reparacion', barClass: 'estado-en_reparacion' },
    almacen: { label: 'En almacén', badgeClass: 'badge-almacen', barClass: 'estado-almacen' },
    baja: { label: 'De baja', badgeClass: 'badge-baja', barClass: 'estado-baja' }
  };

  const TIPOS_EQUIPO = {
    desktop: 'Computadora de escritorio (Desktop)',
    laptop: 'Computadora portátil (Laptop)',
    monitor: 'Monitor',
    impresora: 'Impresora',
    servidor: 'Servidor',
    otro: 'Otro equipo'
  };

  const TIPOS_EQUIPO_CORTO = {
    desktop: 'Escritorio',
    laptop: 'Portátil',
    monitor: 'Monitor',
    impresora: 'Impresora',
    servidor: 'Servidor',
    otro: 'Otro'
  };

  // Referencias del DOM principal
  const appContent = document.getElementById('app-content');
  const pageTitleEl = document.getElementById('page-title');
  const breadcrumbsEl = document.getElementById('breadcrumbs');
  const topbarActionsEl = document.getElementById('topbar-actions');

  // Referencias del modal de eliminación
  const deleteModal = document.getElementById('delete-modal');
  const deleteModalBody = document.getElementById('delete-modal-body');
  const cancelDeleteBtn = document.getElementById('cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

  let pendingDeleteContext = null;

  // Utilidades de formato y seguridad
  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(dateStr) {
    if (!dateStr) return null;
    const parts = String(dateStr).split('-');
    if (parts.length === 3) {
      const [year, month, day] = parts;
      return `${day}/${month}/${year}`;
    }
    return dateStr;
  }

  function formatDateTime(isoStr) {
    if (!isoStr) return '—';
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return isoStr;
    return new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(d);
  }

  function renderEstadoBadge(estado) {
    const info = ESTADOS_EQUIPO[estado] || {
      label: estado || 'Desconocido',
      badgeClass: 'badge-almacen'
    };
    return `
      <span class="badge ${info.badgeClass}">
        <span class="badge-dot"></span>
        ${escapeHtml(info.label)}
      </span>
    `;
  }

  function renderTipoPill(tipo) {
    const label = TIPOS_EQUIPO_CORTO[tipo] || tipo || 'Otro';
    return `<span class="type-pill">${escapeHtml(label)}</span>`;
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `
      <div class="toast-message">${escapeHtml(message)}</div>
      <button type="button" class="toast-close" aria-label="Cerrar notificación">&times;</button>
    `;

    const closeBtn = toast.querySelector('.toast-close');
    const removeToast = () => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    };
    closeBtn.addEventListener('click', removeToast);
    container.appendChild(toast);

    setTimeout(removeToast, 4500);
  }

  // Navegación SPA con History API
  function navigateTo(url, replace = false) {
    if (replace) {
      window.history.replaceState({}, '', url);
    } else {
      window.history.pushState({}, '', url);
    }
    router();
  }

  function updateHeader({ title, crumbs, actionsHtml }) {
    pageTitleEl.textContent = title;
    document.title = `${title} — Inventario de Laboratorios`;

    breadcrumbsEl.innerHTML = crumbs
      .map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        if (isLast || !crumb.href) {
          return `<span class="crumb-current">${escapeHtml(crumb.label)}</span>`;
        }
        return `<a href="${escapeHtml(crumb.href)}" data-link>${escapeHtml(crumb.label)}</a><span class="crumb-sep">/</span>`;
      })
      .join('');

    if (actionsHtml !== undefined) {
      topbarActionsEl.innerHTML = actionsHtml;
    }
  }

  function setActiveSidebarNav(activeId) {
    document.querySelectorAll('.sidebar-nav .nav-item').forEach((el) => {
      if (el.id === activeId) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  // Enrutador principal basado en window.location.pathname
  async function router() {
    let pathname = window.location.pathname;

    // Si se sirve como /index.html directamente, normalizar la ruta visual a /estadisticas
    if (pathname === '/index.html' || pathname === '/') {
      window.history.replaceState({}, '', '/estadisticas');
      pathname = '/estadisticas';
    }

    // Limpiar barra diagonal final salvo en raíz
    if (pathname.length > 1 && pathname.endsWith('/')) {
      pathname = pathname.slice(0, -1);
    }

    // 1. Vista de Estadísticas (/estadisticas)
    if (pathname === '/estadisticas') {
      setActiveSidebarNav('nav-stats');
      await renderStatsView();
      return;
    }

    // 2. Vista de Listado de Equipos (/equipos)
    if (pathname === '/equipos') {
      setActiveSidebarNav('nav-list');
      await renderEquiposListView();
      return;
    }

    // 3. Vista de Registro de Nuevo Equipo (/equipos/nuevo)
    if (pathname === '/equipos/nuevo') {
      setActiveSidebarNav('nav-new');
      await renderEquipoFormView({ mode: 'create' });
      return;
    }

    // 4. Vista de Edición de Equipo (/equipos/{id}/editar)
    const editMatch = pathname.match(/^\/equipos\/([^/]+)\/editar$/);
    if (editMatch) {
      const equipoId = decodeURIComponent(editMatch[1]);
      setActiveSidebarNav('nav-list');
      await renderEquipoFormView({ mode: 'edit', equipoId });
      return;
    }

    // 5. Vista de Detalle de Equipo (/equipos/{id})
    const detailMatch = pathname.match(/^\/equipos\/([^/]+)$/);
    if (detailMatch) {
      const equipoId = decodeURIComponent(detailMatch[1]);
      setActiveSidebarNav('nav-list');
      await renderEquipoDetailView(equipoId);
      return;
    }

    // Ruta no encontrada -> mostrar aviso con enlace a inicio
    setActiveSidebarNav('');
    updateHeader({
      title: 'Página no encontrada',
      crumbs: [
        { label: 'Inicio', href: '/estadisticas' },
        { label: 'No encontrado' }
      ],
      actionsHtml: `<a href="/equipos" data-link class="btn btn-primary">Ir al listado de equipos</a>`
    });
    appContent.innerHTML = `
      <div class="card">
        <div class="empty-state">
          <div class="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
          </div>
          <h2 class="empty-title">La dirección solicitada no existe</h2>
          <p class="empty-desc">La ruta <code>${escapeHtml(pathname)}</code> no corresponde a ninguna vista del sistema.</p>
          <div style="display:flex; gap:10px; margin-top:8px;">
            <a href="/estadisticas" data-link class="btn btn-secondary">Ver estadísticas</a>
            <a href="/equipos" data-link class="btn btn-primary">Ver listado de equipos</a>
          </div>
        </div>
      </div>
    `;
  }

  // =========================================================================
  // VISTA 1: ESTADÍSTICAS GENERALES (/estadisticas)
  // =========================================================================
  async function renderStatsView() {
    updateHeader({
      title: 'Estadísticas Generales del Inventario',
      crumbs: [
        { label: 'Inicio', href: '/estadisticas' },
        { label: 'Estadísticas Generales' }
      ],
      actionsHtml: `
        <button type="button" class="btn btn-secondary" id="refresh-stats-btn">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="23 4 23 10 17 10"></polyline>
            <polyline points="1 20 1 14 7 14"></polyline>
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
          </svg>
          Actualizar
        </button>
        <a href="/equipos" data-link class="btn btn-secondary">Ver Listado</a>
        <a href="/equipos/nuevo" data-link class="btn btn-primary">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Registrar Equipo
        </a>
      `
    });

    document.getElementById('refresh-stats-btn')?.addEventListener('click', () => renderStatsView());

    appContent.innerHTML = `
      <div class="card">
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Consultando estadísticas del inventario (/api/equipos/stats)...</p>
        </div>
      </div>
    `;

    try {
      const stats = await EquiposAPI.getStats();
      const total = Number(stats.total_equipos) || 0;
      const porEstado = stats.por_estado || {};
      const porTipo = stats.por_tipo || {};
      const porLab = stats.por_laboratorio || {};

      const activos = Number(porEstado.activo) || 0;
      const enReparacion = Number(porEstado.en_reparacion) || 0;
      const enAlmacen = Number(porEstado.almacen) || 0;
      const deBaja = Number(porEstado.baja) || 0;

      const pct = (count) => (total > 0 ? Math.round((count / total) * 100) : 0);

      // Construcción de filas de distribución por estado
      const estadoKeys = ['activo', 'en_reparacion', 'almacen', 'baja'];
      const estadosHtml = estadoKeys
        .map((key) => {
          const count = Number(porEstado[key]) || 0;
          const percentage = pct(count);
          const meta = ESTADOS_EQUIPO[key];
          return `
            <div class="dist-item">
              <div class="dist-item-header">
                <a href="/equipos?estado=${encodeURIComponent(key)}" data-link class="dist-label-link">
                  ${renderEstadoBadge(key)}
                </a>
                <span class="dist-count">${count} <span class="dist-pct">(${percentage}%)</span></span>
              </div>
              <div class="progress-track">
                <div class="progress-fill ${meta.barClass}" style="width: ${percentage}%"></div>
              </div>
            </div>
          `;
        })
        .join('');

      // Construcción de filas de distribución por tipo de equipo
      const tipoKeys = Object.keys(TIPOS_EQUIPO);
      const tiposHtml = tipoKeys
        .map((key) => {
          const count = Number(porTipo[key]) || 0;
          const percentage = pct(count);
          return `
            <div class="dist-item">
              <div class="dist-item-header">
                <a href="/equipos?tipo_equipo=${encodeURIComponent(key)}" data-link class="dist-label-link">
                  ${escapeHtml(TIPOS_EQUIPO[key])}
                </a>
                <span class="dist-count">${count} <span class="dist-pct">(${percentage}%)</span></span>
              </div>
              <div class="progress-track">
                <div class="progress-fill" style="width: ${percentage}%"></div>
              </div>
            </div>
          `;
        })
        .join('');

      // Construcción de filas de distribución por laboratorio
      const labEntries = Object.entries(porLab).sort((a, b) => b[1] - a[1]);
      const labsHtml =
        labEntries.length > 0
          ? labEntries
              .map(([labName, count]) => {
                const numericCount = Number(count) || 0;
                const percentage = pct(numericCount);
                return `
                  <div class="dist-item">
                    <div class="dist-item-header">
                      <a href="/equipos?laboratorio=${encodeURIComponent(labName)}" data-link class="dist-label-link">
                        ${escapeHtml(labName)}
                      </a>
                      <span class="dist-count">${numericCount} <span class="dist-pct">(${percentage}%)</span></span>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                  </div>
                `;
              })
              .join('')
          : `<p class="card-subtitle">No hay laboratorios con equipos registrados todavía.</p>`;

      appContent.innerHTML = `
        <!-- Tarjetas de resumen KPI -->
        <section class="kpi-grid" aria-label="Indicadores clave del inventario">
          <a href="/equipos" data-link class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Total de Equipos</span>
              <div class="kpi-icon total">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                  <line x1="8" y1="21" x2="16" y2="21"></line>
                  <line x1="12" y1="17" x2="12" y2="21"></line>
                </svg>
              </div>
            </div>
            <div class="kpi-value">${total}</div>
            <div class="kpi-subtext">${labEntries.length} laboratorio(s) registrado(s)</div>
          </a>

          <a href="/equipos?estado=activo" data-link class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Equipos Activos</span>
              <div class="kpi-icon activo">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                  <polyline points="22 4 12 14.01 9 11.01"></polyline>
                </svg>
              </div>
            </div>
            <div class="kpi-value">${activos}</div>
            <div class="kpi-subtext">${pct(activos)}% del inventario total</div>
          </a>

          <a href="/equipos?estado=en_reparacion" data-link class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">En Reparación</span>
              <div class="kpi-icon reparacion">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                </svg>
              </div>
            </div>
            <div class="kpi-value">${enReparacion}</div>
            <div class="kpi-subtext">${pct(enReparacion)}% en mantenimiento</div>
          </a>

          <a href="/equipos?estado=almacen" data-link class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">En Almacén</span>
              <div class="kpi-icon almacen">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                </svg>
              </div>
            </div>
            <div class="kpi-value">${enAlmacen}</div>
            <div class="kpi-subtext">${pct(enAlmacen)}% en resguardo</div>
          </a>

          <a href="/equipos?estado=baja" data-link class="kpi-card">
            <div class="kpi-header">
              <span class="kpi-label">Equipos de Baja</span>
              <div class="kpi-icon baja">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="12" r="10"></circle>
                  <line x1="15" y1="9" x2="9" y2="15"></line>
                  <line x1="9" y1="9" x2="15" y2="15"></line>
                </svg>
              </div>
            </div>
            <div class="kpi-value">${deBaja}</div>
            <div class="kpi-subtext">${pct(deBaja)}% fuera de operación</div>
          </a>
        </section>

        <!-- Paneles de desglose por Estado, Tipo y Laboratorio -->
        <section class="stats-panels-grid">
          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Equipos por Estado</h2>
                <p class="card-subtitle">Haga clic en un estado para filtrar el listado</p>
              </div>
            </div>
            <div class="card-body">
              <div class="dist-list">
                ${estadosHtml}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Equipos por Tipo</h2>
                <p class="card-subtitle">Distribución según categoría de hardware</p>
              </div>
            </div>
            <div class="card-body">
              <div class="dist-list">
                ${tiposHtml}
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header">
              <div>
                <h2 class="card-title">Equipos por Laboratorio</h2>
                <p class="card-subtitle">Inventario asignado a cada espacio físico</p>
              </div>
            </div>
            <div class="card-body">
              <div class="dist-list">
                ${labsHtml}
              </div>
            </div>
          </div>
        </section>
      `;
    } catch (err) {
      appContent.innerHTML = renderErrorState(
        'No se pudieron cargar las estadísticas',
        err.message,
        () => renderStatsView()
      );
      bindErrorRetry(() => renderStatsView());
    }
  }

  // =========================================================================
  // VISTA 2: LISTADO PAGINADO DE EQUIPOS (/equipos)
  // =========================================================================
  async function renderEquiposListView() {
    const urlParams = new URLSearchParams(window.location.search);
    const currentFilters = {
      page: Math.max(1, parseInt(urlParams.get('page') || '1', 10) || 1),
      page_size: Math.min(100, Math.max(1, parseInt(urlParams.get('page_size') || '20', 10) || 20)),
      estado: urlParams.get('estado') || '',
      tipo_equipo: urlParams.get('tipo_equipo') || '',
      laboratorio: urlParams.get('laboratorio') || '',
      busqueda: urlParams.get('busqueda') || ''
    };

    updateHeader({
      title: 'Listado de Equipos de Cómputo',
      crumbs: [
        { label: 'Inicio', href: '/estadisticas' },
        { label: 'Equipos' }
      ],
      actionsHtml: `
        <a href="/estadisticas" data-link class="btn btn-secondary">Ver Estadísticas</a>
        <a href="/equipos/nuevo" data-link class="btn btn-primary">
          <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="12" y1="5" x2="12" y2="19"></line>
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
          Nuevo Equipo
        </a>
      `
    });

    const estadoOptionsHtml = Object.entries(ESTADOS_EQUIPO)
      .map(
        ([value, meta]) =>
          `<option value="${escapeHtml(value)}" ${currentFilters.estado === value ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`
      )
      .join('');

    const tipoOptionsHtml = Object.entries(TIPOS_EQUIPO)
      .map(
        ([value, label]) =>
          `<option value="${escapeHtml(value)}" ${currentFilters.tipo_equipo === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
      )
      .join('');

    appContent.innerHTML = `
      <section class="filters-bar" aria-label="Filtros de búsqueda de equipos">
        <form id="filters-form" class="filters-form">
          <div class="filter-group">
            <label class="filter-label" for="filter-busqueda">Búsqueda general</label>
            <input
              type="search"
              id="filter-busqueda"
              name="busqueda"
              class="form-control"
              placeholder="No. inventario, marca, modelo, serie o responsable..."
              value="${escapeHtml(currentFilters.busqueda)}"
            />
          </div>

          <div class="filter-group">
            <label class="filter-label" for="filter-estado">Estado</label>
            <select id="filter-estado" name="estado" class="form-control">
              <option value="">Todos los estados</option>
              ${estadoOptionsHtml}
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label" for="filter-tipo">Tipo de equipo</label>
            <select id="filter-tipo" name="tipo_equipo" class="form-control">
              <option value="">Todos los tipos</option>
              ${tipoOptionsHtml}
            </select>
          </div>

          <div class="filter-group">
            <label class="filter-label" for="filter-laboratorio">Laboratorio</label>
            <input
              type="text"
              id="filter-laboratorio"
              name="laboratorio"
              list="laboratorios-datalist"
              class="form-control"
              placeholder="Ej. Laboratorio A"
              value="${escapeHtml(currentFilters.laboratorio)}"
            />
            <datalist id="laboratorios-datalist"></datalist>
          </div>

          <div class="filter-actions">
            <button type="submit" class="btn btn-primary">Filtrar</button>
            <button type="button" id="clear-filters-btn" class="btn btn-secondary">Limpiar</button>
          </div>
        </form>
      </section>

      <section class="card" id="equipos-table-card">
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Cargando listado de equipos (/api/equipos)...</p>
        </div>
      </section>
    `;

    // Poblar sugerencias de laboratorios desde stats en segundo plano
    EquiposAPI.getStats()
      .then((stats) => {
        const datalist = document.getElementById('laboratorios-datalist');
        if (!datalist || !stats || !stats.por_laboratorio) return;
        datalist.innerHTML = Object.keys(stats.por_laboratorio)
          .sort()
          .map((lab) => `<option value="${escapeHtml(lab)}"></option>`)
          .join('');
      })
      .catch(() => {});

    const filtersForm = document.getElementById('filters-form');
    const clearFiltersBtn = document.getElementById('clear-filters-btn');

    const applyFilters = (newPage = 1, customPageSize = currentFilters.page_size) => {
      const formData = new FormData(filtersForm);
      const nextParams = new URLSearchParams();

      const busqueda = (formData.get('busqueda') || '').toString().trim();
      const estado = (formData.get('estado') || '').toString().trim();
      const tipo_equipo = (formData.get('tipo_equipo') || '').toString().trim();
      const laboratorio = (formData.get('laboratorio') || '').toString().trim();

      if (newPage > 1) nextParams.set('page', String(newPage));
      if (customPageSize !== 20) nextParams.set('page_size', String(customPageSize));
      if (estado) nextParams.set('estado', estado);
      if (tipo_equipo) nextParams.set('tipo_equipo', tipo_equipo);
      if (laboratorio) nextParams.set('laboratorio', laboratorio);
      if (busqueda) nextParams.set('busqueda', busqueda);

      const qs = nextParams.toString();
      navigateTo(qs ? `/equipos?${qs}` : '/equipos');
    };

    filtersForm.addEventListener('submit', (e) => {
      e.preventDefault();
      applyFilters(1);
    });

    document.getElementById('filter-estado').addEventListener('change', () => applyFilters(1));
    document.getElementById('filter-tipo').addEventListener('change', () => applyFilters(1));

    clearFiltersBtn.addEventListener('click', () => {
      navigateTo('/equipos');
    });

    const tableCard = document.getElementById('equipos-table-card');

    try {
      const data = await EquiposAPI.listEquipos(currentFilters);
      const total = Number(data.total) || 0;
      const page = Number(data.page) || 1;
      const pageSize = Number(data.page_size) || 20;
      const equipos = Array.isArray(data.equipos) ? data.equipos : [];
      const totalPages = Math.max(1, Math.ceil(total / pageSize));

      const startIdx = total === 0 ? 0 : (page - 1) * pageSize + 1;
      const endIdx = Math.min(total, page * pageSize);

      if (equipos.length === 0) {
        const hasActiveFilters =
          currentFilters.busqueda ||
          currentFilters.estado ||
          currentFilters.tipo_equipo ||
          currentFilters.laboratorio;

        tableCard.innerHTML = `
          <div class="empty-state">
            <div class="empty-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                <line x1="8" y1="21" x2="16" y2="21"></line>
                <line x1="12" y1="17" x2="12" y2="21"></line>
              </svg>
            </div>
            <h2 class="empty-title">
              ${hasActiveFilters ? 'No se encontraron equipos con los filtros aplicados' : 'Aún no hay equipos registrados en el inventario'}
            </h2>
            <p class="empty-desc">
              ${
                hasActiveFilters
                  ? 'Intente ajustar o limpiar los criterios de búsqueda para ver más resultados.'
                  : 'Comience registrando el primer equipo de cómputo del laboratorio.'
              }
            </p>
            <div style="display:flex; gap:10px; margin-top:8px;">
              ${
                hasActiveFilters
                  ? `<a href="/equipos" data-link class="btn btn-secondary">Mostrar todos los equipos</a>`
                  : ''
              }
              <a href="/equipos/nuevo" data-link class="btn btn-primary">Registrar nuevo equipo</a>
            </div>
          </div>
        `;
        return;
      }

      const rowsHtml = equipos
        .map((eq) => {
          const specsParts = [];
          if (eq.procesador) specsParts.push(eq.procesador);
          if (eq.ram_gb) specsParts.push(`${eq.ram_gb} GB RAM`);
          if (eq.almacenamiento) specsParts.push(eq.almacenamiento);
          const specsText = specsParts.length > 0 ? specsParts.join(' · ') : 'Sin especificaciones registradas';

          return `
            <tr>
              <td>
                <a href="/equipos/${encodeURIComponent(eq.id)}" data-link class="cell-mono">
                  ${escapeHtml(eq.numero_inventario)}
                </a>
                <div class="cell-sub">Serie: ${escapeHtml(eq.numero_serie)}</div>
              </td>
              <td>
                ${renderTipoPill(eq.tipo_equipo)}
              </td>
              <td>
                <div class="cell-primary">${escapeHtml(eq.marca)} ${escapeHtml(eq.modelo)}</div>
                <div class="cell-sub">${escapeHtml(specsText)}</div>
              </td>
              <td>
                <div class="cell-primary">${escapeHtml(eq.laboratorio)}</div>
                <div class="cell-sub">${eq.ubicacion ? escapeHtml(eq.ubicacion) : 'Ubicación no especificada'}</div>
              </td>
              <td>
                ${eq.responsable ? escapeHtml(eq.responsable) : '<span style="color:#94a3b8;">No asignado</span>'}
              </td>
              <td>
                ${renderEstadoBadge(eq.estado)}
              </td>
              <td>
                <div class="row-actions">
                  <a href="/equipos/${encodeURIComponent(eq.id)}" data-link class="btn btn-secondary btn-sm" title="Consultar detalle">
                    Ver detalle
                  </a>
                  <a href="/equipos/${encodeURIComponent(eq.id)}/editar" data-link class="btn btn-secondary btn-sm" title="Editar equipo">
                    Editar
                  </a>
                  <button
                    type="button"
                    class="btn btn-danger-outline btn-sm btn-delete-row"
                    data-id="${escapeHtml(eq.id)}"
                    data-inventario="${escapeHtml(eq.numero_inventario)}"
                    data-marca="${escapeHtml(eq.marca)}"
                    data-modelo="${escapeHtml(eq.modelo)}"
                    data-serie="${escapeHtml(eq.numero_serie)}"
                    data-laboratorio="${escapeHtml(eq.laboratorio)}"
                    title="Eliminar equipo"
                  >
                    Eliminar
                  </button>
                </div>
              </td>
            </tr>
          `;
        })
        .join('');

      // Botones de paginación
      const pageButtons = [];
      const startPage = Math.max(1, page - 2);
      const endPage = Math.min(totalPages, page + 2);
      for (let p = startPage; p <= endPage; p++) {
        pageButtons.push(`
          <button type="button" class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">
            ${p}
          </button>
        `);
      }

      tableCard.innerHTML = `
        <div class="table-toolbar">
          <div>
            Mostrando <strong>${startIdx}–${endIdx}</strong> de <strong>${total}</strong> equipo(s)
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <label for="page-size-select">Mostrar por página:</label>
            <select id="page-size-select" class="form-control" style="width:auto; padding:4px 10px; font-size:12.5px;">
              ${[10, 20, 50, 100]
                .map((size) => `<option value="${size}" ${pageSize === size ? 'selected' : ''}>${size}</option>`)
                .join('')}
            </select>
          </div>
        </div>

        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>No. Inventario / Serie</th>
                <th>Tipo</th>
                <th>Equipo y Especificaciones</th>
                <th>Laboratorio / Ubicación</th>
                <th>Responsable</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>

        <div class="pagination-bar">
          <div style="font-size:13px; color:var(--text-muted);">
            Página <strong>${page}</strong> de <strong>${totalPages}</strong>
          </div>
          <div class="pagination-controls">
            <button type="button" class="page-btn" data-page="1" ${page <= 1 ? 'disabled' : ''} title="Primera página">
              &laquo; Primero
            </button>
            <button type="button" class="page-btn" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>
              Anterior
            </button>
            ${pageButtons.join('')}
            <button type="button" class="page-btn" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>
              Siguiente
            </button>
            <button type="button" class="page-btn" data-page="${totalPages}" ${page >= totalPages ? 'disabled' : ''} title="Última página">
              Último &raquo;
            </button>
          </div>
        </div>
      `;

      // Eventos de cambio de tamaño de página
      document.getElementById('page-size-select')?.addEventListener('change', (e) => {
        const newSize = parseInt(e.target.value, 10) || 20;
        applyFilters(1, newSize);
      });

      // Eventos de paginación
      tableCard.querySelectorAll('.page-btn[data-page]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (btn.disabled) return;
          const targetPage = parseInt(btn.getAttribute('data-page'), 10);
          if (targetPage && targetPage !== page) {
            applyFilters(targetPage, pageSize);
          }
        });
      });

      // Eventos de eliminación desde fila
      tableCard.querySelectorAll('.btn-delete-row').forEach((btn) => {
        btn.addEventListener('click', () => {
          openDeleteModal({
            id: btn.getAttribute('data-id'),
            numero_inventario: btn.getAttribute('data-inventario'),
            marca: btn.getAttribute('data-marca'),
            modelo: btn.getAttribute('data-modelo'),
            numero_serie: btn.getAttribute('data-serie'),
            laboratorio: btn.getAttribute('data-laboratorio'),
            onSuccess: () => renderEquiposListView()
          });
        });
      });
    } catch (err) {
      tableCard.innerHTML = renderErrorState(
        'No se pudo obtener el listado de equipos',
        err.message
      );
      bindErrorRetry(() => renderEquiposListView());
    }
  }

  // =========================================================================
  // VISTA 3: DETALLE DE UN EQUIPO (/equipos/{id})
  // =========================================================================
  async function renderEquipoDetailView(equipoId) {
    updateHeader({
      title: 'Detalle del Equipo',
      crumbs: [
        { label: 'Inicio', href: '/estadisticas' },
        { label: 'Equipos', href: '/equipos' },
        { label: `Equipo ${equipoId.slice(0, 8)}...` }
      ],
      actionsHtml: `
        <a href="/equipos" data-link class="btn btn-secondary">Volver al listado</a>
      `
    });

    appContent.innerHTML = `
      <div class="card">
        <div class="loading-state">
          <div class="spinner"></div>
          <p>Cargando información del equipo...</p>
        </div>
      </div>
    `;

    try {
      const eq = await EquiposAPI.getEquipo(equipoId);

      updateHeader({
        title: `${eq.marca} ${eq.modelo} (${eq.numero_inventario})`,
        crumbs: [
          { label: 'Inicio', href: '/estadisticas' },
          { label: 'Equipos', href: '/equipos' },
          { label: eq.numero_inventario }
        ],
        actionsHtml: `
          <a href="/equipos" data-link class="btn btn-secondary">Volver al listado</a>
          <a href="/equipos/${encodeURIComponent(eq.id)}/editar" data-link class="btn btn-primary">
            Editar Equipo
          </a>
          <button type="button" class="btn btn-danger" id="detail-delete-btn">
            Eliminar Equipo
          </button>
        `
      });

      const valOrEmpty = (val, suffix = '') => {
        if (val === null || val === undefined || String(val).trim() === '') {
          return `<span class="spec-value empty">No especificado</span>`;
        }
        return `<span class="spec-value">${escapeHtml(val)}${escapeHtml(suffix)}</span>`;
      };

      appContent.innerHTML = `
        <div class="detail-header-card">
          <div class="detail-title-group">
            <div class="detail-badges">
              ${renderEstadoBadge(eq.estado)}
              ${renderTipoPill(eq.tipo_equipo)}
              <span class="cell-mono" style="background:#f1f5f9; padding:3px 9px; border-radius:6px;">
                Inventario: ${escapeHtml(eq.numero_inventario)}
              </span>
            </div>
            <h2 class="detail-main-title">${escapeHtml(eq.marca)} ${escapeHtml(eq.modelo)}</h2>
            <div class="detail-meta-row">
              <span><strong>No. de Serie:</strong> <code>${escapeHtml(eq.numero_serie)}</code></span>
              <span><strong>Laboratorio:</strong> ${escapeHtml(eq.laboratorio)}</span>
              <span><strong>ID Único (UUID):</strong> <code>${escapeHtml(eq.id)}</code></span>
            </div>
          </div>
        </div>

        <div class="detail-grid">
          <!-- Tarjeta 1: Identificación y Clasificación -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Identificación Patrimonial</h3>
                <p class="card-subtitle">Datos oficiales de control e inventario</p>
              </div>
            </div>
            <div class="card-body">
              <div class="spec-list">
                <div class="spec-item">
                  <span class="spec-label">Número de Inventario</span>
                  ${valOrEmpty(eq.numero_inventario)}
                </div>
                <div class="spec-item">
                  <span class="spec-label">Número de Serie</span>
                  ${valOrEmpty(eq.numero_serie)}
                </div>
                <div class="spec-item">
                  <span class="spec-label">Tipo de Equipo</span>
                  <span class="spec-value">${escapeHtml(TIPOS_EQUIPO[eq.tipo_equipo] || eq.tipo_equipo)}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">Estado Operativo</span>
                  <div>${renderEstadoBadge(eq.estado)}</div>
                </div>
                <div class="spec-item">
                  <span class="spec-label">Marca</span>
                  ${valOrEmpty(eq.marca)}
                </div>
                <div class="spec-item">
                  <span class="spec-label">Modelo</span>
                  ${valOrEmpty(eq.modelo)}
                </div>
              </div>
            </div>
          </div>

          <!-- Tarjeta 2: Especificaciones Técnicas -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Especificaciones Técnicas</h3>
                <p class="card-subtitle">Características de hardware y sistema operativo</p>
              </div>
            </div>
            <div class="card-body">
              <div class="spec-list">
                <div class="spec-item">
                  <span class="spec-label">Procesador</span>
                  ${valOrEmpty(eq.procesador)}
                </div>
                <div class="spec-item">
                  <span class="spec-label">Memoria RAM</span>
                  ${eq.ram_gb ? valOrEmpty(eq.ram_gb, ' GB') : valOrEmpty(null)}
                </div>
                <div class="spec-item">
                  <span class="spec-label">Almacenamiento</span>
                  ${valOrEmpty(eq.almacenamiento)}
                </div>
                <div class="spec-item">
                  <span class="spec-label">Sistema Operativo</span>
                  ${valOrEmpty(eq.sistema_operativo)}
                </div>
              </div>
            </div>
          </div>

          <!-- Tarjeta 3: Ubicación y Resguardo -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Ubicación y Asignación</h3>
                <p class="card-subtitle">Adscripción física y personal responsable</p>
              </div>
            </div>
            <div class="card-body">
              <div class="spec-list">
                <div class="spec-item">
                  <span class="spec-label">Laboratorio</span>
                  ${valOrEmpty(eq.laboratorio)}
                </div>
                <div class="spec-item">
                  <span class="spec-label">Ubicación Específica</span>
                  ${valOrEmpty(eq.ubicacion)}
                </div>
                <div class="spec-item full-width">
                  <span class="spec-label">Responsable del Equipo</span>
                  ${valOrEmpty(eq.responsable)}
                </div>
              </div>
            </div>
          </div>

          <!-- Tarjeta 4: Fechas y Control de Mantenimiento -->
          <div class="card">
            <div class="card-header">
              <div>
                <h3 class="card-title">Fechas e Historial de Registro</h3>
                <p class="card-subtitle">Adquisición, revisiones y marcas de auditoría</p>
              </div>
            </div>
            <div class="card-body">
              <div class="spec-list">
                <div class="spec-item">
                  <span class="spec-label">Fecha de Adquisición</span>
                  ${valOrEmpty(formatDate(eq.fecha_adquisicion))}
                </div>
                <div class="spec-item">
                  <span class="spec-label">Fecha de Última Revisión</span>
                  ${valOrEmpty(formatDate(eq.fecha_ultima_revision))}
                </div>
                <div class="spec-item">
                  <span class="spec-label">Fecha de Alta en Sistema</span>
                  <span class="spec-value">${escapeHtml(formatDateTime(eq.created_at))}</span>
                </div>
                <div class="spec-item">
                  <span class="spec-label">Última Actualización</span>
                  <span class="spec-value">${escapeHtml(formatDateTime(eq.updated_at))}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Tarjeta 5: Observaciones -->
          <div class="card" style="grid-column: 1 / -1;">
            <div class="card-header">
              <div>
                <h3 class="card-title">Observaciones y Notas Técnicas</h3>
                <p class="card-subtitle">Comentarios adicionales sobre estado físico, garantías o incidencias</p>
              </div>
            </div>
            <div class="card-body">
              ${
                eq.observaciones && eq.observaciones.trim() !== ''
                  ? `<div class="observations-box">${escapeHtml(eq.observaciones)}</div>`
                  : `<p class="spec-value empty">Sin observaciones registradas para este equipo.</p>`
              }
            </div>
          </div>
        </div>
      `;

      document.getElementById('detail-delete-btn')?.addEventListener('click', () => {
        openDeleteModal({
          id: eq.id,
          numero_inventario: eq.numero_inventario,
          marca: eq.marca,
          modelo: eq.modelo,
          numero_serie: eq.numero_serie,
          laboratorio: eq.laboratorio,
          onSuccess: () => navigateTo('/equipos')
        });
      });
    } catch (err) {
      appContent.innerHTML = renderErrorState(
        'No se pudo cargar el detalle del equipo',
        err.message
      );
      bindErrorRetry(() => renderEquipoDetailView(equipoId));
    }
  }

  // =========================================================================
  // VISTA 4 y 5: CREAR (/equipos/nuevo) Y EDITAR (/equipos/{id}/editar)
  // =========================================================================
  async function renderEquipoFormView({ mode, equipoId = null }) {
    const isEdit = mode === 'edit';

    updateHeader({
      title: isEdit ? 'Editar Equipo de Cómputo' : 'Registrar Nuevo Equipo',
      crumbs: [
        { label: 'Inicio', href: '/estadisticas' },
        { label: 'Equipos', href: '/equipos' },
        ...(isEdit
          ? [
              { label: 'Detalle', href: `/equipos/${encodeURIComponent(equipoId)}` },
              { label: 'Editar' }
            ]
          : [{ label: 'Nuevo Equipo' }])
      ],
      actionsHtml: `
        <a href="${isEdit ? `/equipos/${encodeURIComponent(equipoId)}` : '/equipos'}" data-link class="btn btn-secondary">
          Cancelar y volver
        </a>
      `
    });

    let initialData = {
      numero_inventario: '',
      tipo_equipo: 'desktop',
      marca: '',
      modelo: '',
      numero_serie: '',
      procesador: '',
      ram_gb: '',
      almacenamiento: '',
      sistema_operativo: '',
      estado: 'activo',
      laboratorio: '',
      ubicacion: '',
      responsable: '',
      fecha_adquisicion: '',
      fecha_ultima_revision: '',
      observaciones: ''
    };

    if (isEdit) {
      appContent.innerHTML = `
        <div class="card">
          <div class="loading-state">
            <div class="spinner"></div>
            <p>Cargando datos actuales del equipo para edición...</p>
          </div>
        </div>
      `;

      try {
        const existing = await EquiposAPI.getEquipo(equipoId);
        initialData = {
          id: existing.id,
          numero_inventario: existing.numero_inventario || '',
          tipo_equipo: existing.tipo_equipo || 'desktop',
          marca: existing.marca || '',
          modelo: existing.modelo || '',
          numero_serie: existing.numero_serie || '',
          procesador: existing.procesador || '',
          ram_gb: existing.ram_gb !== null && existing.ram_gb !== undefined ? String(existing.ram_gb) : '',
          almacenamiento: existing.almacenamiento || '',
          sistema_operativo: existing.sistema_operativo || '',
          estado: existing.estado || 'activo',
          laboratorio: existing.laboratorio || '',
          ubicacion: existing.ubicacion || '',
          responsable: existing.responsable || '',
          fecha_adquisicion: existing.fecha_adquisicion || '',
          fecha_ultima_revision: existing.fecha_ultima_revision || '',
          observaciones: existing.observaciones || '',
          created_at: existing.created_at,
          updated_at: existing.updated_at
        };

        updateHeader({
          title: `Editar Equipo: ${existing.numero_inventario}`,
          crumbs: [
            { label: 'Inicio', href: '/estadisticas' },
            { label: 'Equipos', href: '/equipos' },
            { label: existing.numero_inventario, href: `/equipos/${encodeURIComponent(existing.id)}` },
            { label: 'Editar' }
          ],
          actionsHtml: `
            <a href="/equipos/${encodeURIComponent(existing.id)}" data-link class="btn btn-secondary">
              Ver detalle
            </a>
          `
        });
      } catch (err) {
        appContent.innerHTML = renderErrorState(
          'No se pudo cargar el equipo para editar',
          err.message
        );
        bindErrorRetry(() => renderEquipoFormView({ mode, equipoId }));
        return;
      }
    }

    const tipoOptionsHtml = Object.entries(TIPOS_EQUIPO)
      .map(
        ([value, label]) =>
          `<option value="${escapeHtml(value)}" ${initialData.tipo_equipo === value ? 'selected' : ''}>${escapeHtml(label)}</option>`
      )
      .join('');

    const estadoOptionsHtml = Object.entries(ESTADOS_EQUIPO)
      .map(
        ([value, meta]) =>
          `<option value="${escapeHtml(value)}" ${initialData.estado === value ? 'selected' : ''}>${escapeHtml(meta.label)}</option>`
      )
      .join('');

    appContent.innerHTML = `
      <form id="equipo-form" class="form-card" novalidate>
        <div id="form-error-banner" class="form-alert" style="display:none;" role="alert"></div>

        <!-- Sección 1: Identificación y Clasificación -->
        <div class="form-section">
          <div class="form-section-header">
            <h2 class="form-section-title">1. Identificación y Clasificación</h2>
            <p class="form-section-desc">
              Los campos marcados con <span class="req-star">*</span> son obligatorios. El número de inventario y el número de serie deben ser únicos.
            </p>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="numero_inventario">
                Número de inventario <span class="req-star">*</span>
              </label>
              <input
                type="text"
                id="numero_inventario"
                name="numero_inventario"
                class="form-control"
                required
                maxlength="100"
                placeholder="Ej. INV-2024-001"
                value="${escapeHtml(initialData.numero_inventario)}"
              />
              <span class="field-hint">Código único patrimonial (máx. 100 caracteres)</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="numero_serie">
                Número de serie <span class="req-star">*</span>
              </label>
              <input
                type="text"
                id="numero_serie"
                name="numero_serie"
                class="form-control"
                required
                maxlength="200"
                placeholder="Ej. SN-ABC123456"
                value="${escapeHtml(initialData.numero_serie)}"
              />
              <span class="field-hint">Serie única del fabricante (máx. 200 caracteres)</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="tipo_equipo">
                Tipo de equipo <span class="req-star">*</span>
              </label>
              <select id="tipo_equipo" name="tipo_equipo" class="form-control" required>
                ${tipoOptionsHtml}
              </select>
            </div>

            <div class="form-group">
              <label class="form-label" for="marca">
                Marca <span class="req-star">*</span>
              </label>
              <input
                type="text"
                id="marca"
                name="marca"
                class="form-control"
                required
                maxlength="100"
                placeholder="Ej. Dell, HP, Lenovo"
                value="${escapeHtml(initialData.marca)}"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="modelo">
                Modelo <span class="req-star">*</span>
              </label>
              <input
                type="text"
                id="modelo"
                name="modelo"
                class="form-control"
                required
                maxlength="150"
                placeholder="Ej. OptiPlex 7090"
                value="${escapeHtml(initialData.modelo)}"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="estado">
                Estado operativo <span class="req-star">*</span>
              </label>
              <select id="estado" name="estado" class="form-control" required>
                ${estadoOptionsHtml}
              </select>
            </div>
          </div>
        </div>

        <!-- Sección 2: Especificaciones Técnicas -->
        <div class="form-section">
          <div class="form-section-header">
            <h2 class="form-section-title">2. Especificaciones Técnicas</h2>
            <p class="form-section-desc">Información opcional de hardware y software del equipo.</p>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="procesador">Procesador</label>
              <input
                type="text"
                id="procesador"
                name="procesador"
                class="form-control"
                maxlength="200"
                placeholder="Ej. Intel Core i7-11700"
                value="${escapeHtml(initialData.procesador)}"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="ram_gb">Memoria RAM (GB)</label>
              <input
                type="number"
                id="ram_gb"
                name="ram_gb"
                class="form-control"
                min="1"
                max="1024"
                step="1"
                placeholder="Ej. 16"
                value="${escapeHtml(initialData.ram_gb)}"
              />
              <span class="field-hint">Valor entero entre 1 y 1024 GB</span>
            </div>

            <div class="form-group">
              <label class="form-label" for="almacenamiento">Almacenamiento</label>
              <input
                type="text"
                id="almacenamiento"
                name="almacenamiento"
                class="form-control"
                maxlength="200"
                placeholder="Ej. 512GB SSD NVMe"
                value="${escapeHtml(initialData.almacenamiento)}"
              />
            </div>

            <div class="form-group col-span-2">
              <label class="form-label" for="sistema_operativo">Sistema operativo</label>
              <input
                type="text"
                id="sistema_operativo"
                name="sistema_operativo"
                class="form-control"
                maxlength="150"
                placeholder="Ej. Windows 11 Pro / Ubuntu 24.04 LTS"
                value="${escapeHtml(initialData.sistema_operativo)}"
              />
            </div>
          </div>
        </div>

        <!-- Sección 3: Ubicación y Asignación -->
        <div class="form-section">
          <div class="form-section-header">
            <h2 class="form-section-title">3. Ubicación y Resguardo</h2>
            <p class="form-section-desc">Laboratorio al que pertenece el equipo y ubicación física dentro del mismo.</p>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="laboratorio">
                Laboratorio <span class="req-star">*</span>
              </label>
              <input
                type="text"
                id="laboratorio"
                name="laboratorio"
                list="form-laboratorios-list"
                class="form-control"
                required
                maxlength="150"
                placeholder="Ej. Laboratorio de Redes A"
                value="${escapeHtml(initialData.laboratorio)}"
              />
              <datalist id="form-laboratorios-list"></datalist>
            </div>

            <div class="form-group">
              <label class="form-label" for="ubicacion">Ubicación física</label>
              <input
                type="text"
                id="ubicacion"
                name="ubicacion"
                class="form-control"
                maxlength="200"
                placeholder="Ej. Mesa 5, Fila 2"
                value="${escapeHtml(initialData.ubicacion)}"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="responsable">Responsable asignado</label>
              <input
                type="text"
                id="responsable"
                name="responsable"
                class="form-control"
                maxlength="200"
                placeholder="Ej. Ing. Juan Pérez"
                value="${escapeHtml(initialData.responsable)}"
              />
            </div>
          </div>
        </div>

        <!-- Sección 4: Fechas y Observaciones -->
        <div class="form-section">
          <div class="form-section-header">
            <h2 class="form-section-title">4. Control de Fechas y Observaciones</h2>
            <p class="form-section-desc">Registro de adquisición, mantenimiento reciente y notas adicionales.</p>
          </div>

          <div class="form-grid">
            <div class="form-group">
              <label class="form-label" for="fecha_adquisicion">Fecha de adquisición</label>
              <input
                type="date"
                id="fecha_adquisicion"
                name="fecha_adquisicion"
                class="form-control"
                value="${escapeHtml(initialData.fecha_adquisicion)}"
              />
            </div>

            <div class="form-group">
              <label class="form-label" for="fecha_ultima_revision">Fecha de última revisión</label>
              <input
                type="date"
                id="fecha_ultima_revision"
                name="fecha_ultima_revision"
                class="form-control"
                value="${escapeHtml(initialData.fecha_ultima_revision)}"
              />
            </div>

            <div class="form-group col-span-3">
              <label class="form-label" for="observaciones">Observaciones</label>
              <textarea
                id="observaciones"
                name="observaciones"
                class="form-control"
                placeholder="Anote detalles sobre estado del equipo, periféricos incluidos, garantías o incidencias..."
              >${escapeHtml(initialData.observaciones)}</textarea>
            </div>
          </div>
        </div>

        <div class="form-footer">
          <div style="font-size:12.5px; color:var(--text-muted);">
            ${
              isEdit
                ? `ID del equipo: <code>${escapeHtml(initialData.id)}</code> · Última modificación: ${escapeHtml(formatDateTime(initialData.updated_at))}`
                : 'Al guardar, el equipo quedará disponible inmediatamente en el inventario del laboratorio.'
            }
          </div>
          <div style="display:flex; gap:10px;">
            <a
              href="${isEdit ? `/equipos/${encodeURIComponent(equipoId)}` : '/equipos'}"
              data-link
              class="btn btn-secondary"
            >
              Cancelar
            </a>
            <button type="submit" class="btn btn-primary" id="submit-equipo-btn">
              ${isEdit ? 'Guardar Cambios' : 'Registrar Equipo'}
            </button>
          </div>
        </div>
      </form>
    `;

    // Cargar sugerencias de laboratorios existentes
    EquiposAPI.getStats()
      .then((stats) => {
        const datalist = document.getElementById('form-laboratorios-list');
        if (!datalist || !stats || !stats.por_laboratorio) return;
        datalist.innerHTML = Object.keys(stats.por_laboratorio)
          .sort()
          .map((lab) => `<option value="${escapeHtml(lab)}"></option>`)
          .join('');
      })
      .catch(() => {});

    const form = document.getElementById('equipo-form');
    const errorBanner = document.getElementById('form-error-banner');
    const submitBtn = document.getElementById('submit-equipo-btn');

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      errorBanner.style.display = 'none';
      errorBanner.textContent = '';

      // Limpiar estados previos de validación
      form.querySelectorAll('.form-control.invalid').forEach((el) => el.classList.remove('invalid'));

      const formData = new FormData(form);
      const getTrimmed = (name) => (formData.get(name) || '').toString().trim();
      const getNullable = (name) => {
        const v = getTrimmed(name);
        return v === '' ? null : v;
      };

      const numero_inventario = getTrimmed('numero_inventario');
      const numero_serie = getTrimmed('numero_serie');
      const marca = getTrimmed('marca');
      const modelo = getTrimmed('modelo');
      const laboratorio = getTrimmed('laboratorio');
      const tipo_equipo = getTrimmed('tipo_equipo') || 'desktop';
      const estado = getTrimmed('estado') || 'activo';
      const ramRaw = getTrimmed('ram_gb');

      // Validación en cliente de campos obligatorios y rangos
      const missingFields = [];
      if (!numero_inventario) {
        missingFields.push('Número de inventario');
        document.getElementById('numero_inventario')?.classList.add('invalid');
      }
      if (!numero_serie) {
        missingFields.push('Número de serie');
        document.getElementById('numero_serie')?.classList.add('invalid');
      }
      if (!marca) {
        missingFields.push('Marca');
        document.getElementById('marca')?.classList.add('invalid');
      }
      if (!modelo) {
        missingFields.push('Modelo');
        document.getElementById('modelo')?.classList.add('invalid');
      }
      if (!laboratorio) {
        missingFields.push('Laboratorio');
        document.getElementById('laboratorio')?.classList.add('invalid');
      }

      if (missingFields.length > 0) {
        errorBanner.textContent = `Por favor complete los campos obligatorios: ${missingFields.join(', ')}.`;
        errorBanner.style.display = 'block';
        errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      let ram_gb = null;
      if (ramRaw !== '') {
        const parsedRam = Number(ramRaw);
        if (!Number.isInteger(parsedRam) || parsedRam < 1 || parsedRam > 1024) {
          document.getElementById('ram_gb')?.classList.add('invalid');
          errorBanner.textContent = 'La memoria RAM debe ser un número entero entre 1 y 1024 GB.';
          errorBanner.style.display = 'block';
          errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }
        ram_gb = parsedRam;
      }

      const payload = {
        numero_inventario,
        tipo_equipo,
        marca,
        modelo,
        numero_serie,
        procesador: getNullable('procesador'),
        ram_gb,
        almacenamiento: getNullable('almacenamiento'),
        sistema_operativo: getNullable('sistema_operativo'),
        estado,
        laboratorio,
        ubicacion: getNullable('ubicacion'),
        responsable: getNullable('responsable'),
        fecha_adquisicion: getNullable('fecha_adquisicion'),
        fecha_ultima_revision: getNullable('fecha_ultima_revision'),
        observaciones: getNullable('observaciones')
      };

      submitBtn.disabled = true;
      submitBtn.textContent = isEdit ? 'Guardando cambios...' : 'Registrando equipo...';

      try {
        if (isEdit) {
          const updated = await EquiposAPI.updateEquipo(equipoId, payload);
          showToast(`Equipo "${updated.numero_inventario}" actualizado correctamente.`, 'success');
          navigateTo(`/equipos/${encodeURIComponent(updated.id)}`);
        } else {
          const created = await EquiposAPI.createEquipo(payload);
          showToast(`Equipo "${created.numero_inventario}" registrado con éxito.`, 'success');
          navigateTo(`/equipos/${encodeURIComponent(created.id)}`);
        }
      } catch (err) {
        errorBanner.textContent = err.message;
        errorBanner.style.display = 'block';
        errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
        showToast(err.message, 'error');
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = isEdit ? 'Guardar Cambios' : 'Registrar Equipo';
      }
    });
  }

  // =========================================================================
  // MODAL DE CONFIRMACIÓN DE ELIMINACIÓN (DELETE /api/equipos/{id})
  // =========================================================================
  function openDeleteModal({ id, numero_inventario, marca, modelo, numero_serie, laboratorio, onSuccess }) {
    pendingDeleteContext = { id, numero_inventario, onSuccess };

    deleteModalBody.innerHTML = `
      <p>¿Está seguro de que desea eliminar del inventario el siguiente equipo?</p>
      <div class="modal-summary-box">
        <div><strong>No. de Inventario:</strong> <code>${escapeHtml(numero_inventario)}</code></div>
        <div><strong>Equipo:</strong> ${escapeHtml(marca)} ${escapeHtml(modelo)}</div>
        <div><strong>No. de Serie:</strong> <code>${escapeHtml(numero_serie)}</code></div>
        <div><strong>Laboratorio:</strong> ${escapeHtml(laboratorio)}</div>
      </div>
    `;

    confirmDeleteBtn.disabled = false;
    confirmDeleteBtn.textContent = 'Eliminar definitivamente';
    deleteModal.classList.remove('hidden');
  }

  function closeDeleteModal() {
    deleteModal.classList.add('hidden');
    pendingDeleteContext = null;
  }

  cancelDeleteBtn?.addEventListener('click', closeDeleteModal);
  deleteModal?.addEventListener('click', (e) => {
    if (e.target === deleteModal) closeDeleteModal();
  });

  confirmDeleteBtn?.addEventListener('click', async () => {
    if (!pendingDeleteContext) return;
    const { id, numero_inventario, onSuccess } = pendingDeleteContext;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Eliminando...';

    try {
      await EquiposAPI.deleteEquipo(id);
      closeDeleteModal();
      showToast(`El equipo "${numero_inventario}" fue eliminado del inventario.`, 'success');
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (err) {
      showToast(err.message, 'error');
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = 'Eliminar definitivamente';
    }
  });

  // =========================================================================
  // ESTADO DE ERROR REUTILIZABLE
  // =========================================================================
  function renderErrorState(title, message) {
    return `
      <div class="error-state">
        <div class="modal-danger-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h2 class="empty-title">${escapeHtml(title)}</h2>
        <p class="empty-desc">${escapeHtml(message)}</p>
        <div style="display:flex; gap:10px; margin-top:8px;">
          <button type="button" class="btn btn-primary" id="retry-action-btn">Reintentar</button>
          <a href="/equipos" data-link class="btn btn-secondary">Ir al listado</a>
        </div>
      </div>
    `;
  }

  function bindErrorRetry(retryFn) {
    document.getElementById('retry-action-btn')?.addEventListener('click', retryFn);
  }

  // =========================================================================
  // INTERCEPTOR GLOBAL DE ENLACES [data-link] E INICIALIZACIÓN
  // =========================================================================
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[data-link]');
    if (!link) return;

    // Permitir abrir en pestaña nueva con Ctrl/Cmd/clic central
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) {
      return;
    }

    const href = link.getAttribute('href');
    if (!href) return;

    e.preventDefault();
    navigateTo(href);
  });

  window.addEventListener('popstate', () => {
    router();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !deleteModal.classList.contains('hidden')) {
      closeDeleteModal();
    }
  });

  // Iniciar enrutador al cargar el DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', router);
  } else {
    router();
  }
})();
// =========================================================================
// CONTROL DE PARTICIPANTE PARA MICROSOFT CLARITY
// =========================================================================
(function initParticipantControl() {
  const pidInput = document.getElementById('pid-input');
  const startBtn = document.getElementById('btn-iniciar-prueba');
  const statusEl = document.getElementById('pid-status');

  if (!pidInput || !startBtn) return;

  // Recuperar ID previo si existe en sessionStorage (para recargas)
  try {
    const savedPid = sessionStorage.getItem('participante_id');
    if (savedPid) {
      pidInput.value = savedPid;
      statusEl.textContent = `✓ ${savedPid}`;
    }
  } catch (e) {}

  startBtn.addEventListener('click', () => {
    const id = pidInput.value.trim();

    if (!id) {
      statusEl.textContent = 'Ingresa un ID';
      statusEl.classList.add('error');
      return;
    }

    // Aplicar etiqueta a Clarity
    if (typeof window.clarity === 'function') {
      window.clarity('set', 'participante_id', id);
    }

    // Guardar en sessionStorage para persistir durante la sesión
    try {
      sessionStorage.setItem('participante_id', id);
    } catch (e) {}

    statusEl.textContent = `✓ ${id}`;
    statusEl.classList.remove('error');

    // Opcional: mostrar confirmación visual
    if (typeof showToast === 'function') {
      showToast(`Participante ${id} identificado en Clarity.`, 'success');
    }
  });

  // Permitir presionar Enter en el input
  pidInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      startBtn.click();
    }
  });
})();
