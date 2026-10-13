// ==================== ESTADO GLOBAL ====================
const PIN_LONGITUD = 4;
let pinIngresado = '';
let negocios = [];

// ==================== UTILIDADES ====================
async function hashPin(pin) {
  const data = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function toast(msg, titulo = 'Aviso', tipo = 'info') {
  const toastEl = document.getElementById('toast');
  const toastHeader = toastEl.querySelector('.toast-header i');
  
  // Cambiar ícono según tipo
  const iconos = {
    info: 'bi-info-circle-fill text-primary',
    success: 'bi-check-circle-fill text-success',
    error: 'bi-x-circle-fill text-danger',
    warning: 'bi-exclamation-triangle-fill text-warning'
  };
  toastHeader.className = `bi me-2 ${iconos[tipo] || iconos.info}`;
  
  document.getElementById('toastTitulo').textContent = titulo;
  document.getElementById('toastMsg').textContent = msg;
  const t = new bootstrap.Toast(toastEl);
  t.show();
}

// ==================== LOGIN CON PIN ====================
const dots = document.querySelectorAll('#pinDots .pin-dot');
const pinMsg = document.getElementById('pinMsg');

function actualizarDots() {
  dots.forEach((d, i) => d.classList.toggle('filled', i < pinIngresado.length));
}

async function intentarLogin() {
  if (pinIngresado.length !== PIN_LONGITUD) return;
  
  pinMsg.textContent = 'Verificando...';
  pinMsg.className = 'text-muted mt-3 small';
  const hash = await hashPin(pinIngresado);
  
  try {
    const doc = await db.collection('config').doc('admin').get();
    if (!doc.exists) {
      pinMsg.textContent = '⚠️ Config no inicializada. Crea el documento config/admin en Firestore.';
      pinMsg.className = 'text-warning mt-3 small';
      pinIngresado = '';
      actualizarDots();
      return;
    }
    
    if (doc.data().pinHash === hash) {
      sessionStorage.setItem('adminOk', '1');
      mostrarPanel();
    } else {
      pinMsg.textContent = '❌ PIN incorrecto';
      pinMsg.className = 'text-danger mt-3 small';
      dots.forEach(d => d.classList.add('error'));
      setTimeout(() => {
        pinIngresado = '';
        actualizarDots();
        dots.forEach(d => d.classList.remove('error'));
        pinMsg.textContent = '';
      }, 700);
    }
  } catch (e) {
    console.error(e);
    pinMsg.textContent = 'Error de conexión: ' + e.message;
    pinMsg.className = 'text-danger mt-3 small';
  }
}

// Teclado numérico en pantalla
document.querySelectorAll('.pin-key[data-num]').forEach(k => {
  k.addEventListener('click', () => {
    if (pinIngresado.length < PIN_LONGITUD) {
      pinIngresado += k.dataset.num;
      actualizarDots();
      if (pinIngresado.length === PIN_LONGITUD) intentarLogin();
    }
  });
});

document.getElementById('btnBorrar').addEventListener('click', () => {
  pinIngresado = pinIngresado.slice(0, -1);
  actualizarDots();
});

document.getElementById('btnClear').addEventListener('click', () => {
  pinIngresado = '';
  actualizarDots();
  pinMsg.textContent = '';
});

// Teclado físico
document.addEventListener('keydown', (e) => {
  const loginVisible = document.getElementById('loginScreen').style.display !== 'none' &&
                       document.getElementById('loginScreen').offsetParent !== null;
  if (!loginVisible) return;
  
  if (e.key >= '0' && e.key <= '9' && pinIngresado.length < PIN_LONGITUD) {
    pinIngresado += e.key;
    actualizarDots();
    if (pinIngresado.length === PIN_LONGITUD) intentarLogin();
  } else if (e.key === 'Backspace') {
    pinIngresado = pinIngresado.slice(0, -1);
    actualizarDots();
  }
});

// ==================== MOSTRAR PANEL ====================
function mostrarPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('panelScreen').style.display = 'block';
  cargarTodo();
}

function cerrarSesion() {
  if (!confirm('¿Cerrar sesión del panel?')) return;
  sessionStorage.removeItem('adminOk');
  location.reload();
}

document.getElementById('btnLogout').addEventListener('click', cerrarSesion);

// Auto-login si ya está autenticado en esta sesión
if (sessionStorage.getItem('adminOk') === '1') {
  mostrarPanel();
}

// ==================== CARGAR DATOS ====================
async function cargarTodo() {
  await cargarNegocios();
  renderStats();
  renderRecientes();
  renderTablaNegocios();
  cargarInfoConfig();
}

async function cargarNegocios() {
  try {
    const snap = await db.collection('negocios').orderBy('fechaRegistro', 'desc').get();
    negocios = [];
    snap.forEach(d => {
      const data = d.data();
      // Retrocompatibilidad: convertir foto única a array
      if (data.foto && !data.fotos) {
        data.fotos = [data.foto];
      } else if (!data.fotos) {
        data.fotos = [];
      }
      negocios.push({ id: d.id, ...data });
    });
  } catch (e) {
    console.error('Error cargando negocios:', e);
    toast('Error al cargar negocios: ' + e.message, 'Error', 'error');
  }
}

// ==================== DASHBOARD ====================
function renderStats() {
  document.getElementById('statTotal').textContent = negocios.length;
  document.getElementById('statActivos').textContent = negocios.filter(n => n.activo).length;
  document.getElementById('statOro').textContent = negocios.filter(n => n.oro).length;
  document.getElementById('statPend').textContent = negocios.filter(n => !n.activo).length;
}

function renderRecientes() {
  const tbody = document.getElementById('tablaRecientes');
  const recientes = negocios.slice(0, 5);
  
  if (recientes.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Sin registros aún</td></tr>';
    return;
  }
  
  tbody.innerHTML = recientes.map(n => {
    const fecha = n.fechaRegistro ? new Date(n.fechaRegistro).toLocaleDateString('es-CO') : '-';
    const estado = !n.activo ? '<span class="badge bg-secondary">Pendiente</span>' :
                   n.oro ? '<span class="badge badge-oro"><i class="bi bi-star-fill"></i> Oro</span>' :
                   '<span class="badge bg-success">Activo</span>';
    return `
      <tr>
        <td><strong>${n.nombre || 'Sin nombre'}</strong></td>
        <td>${n.categoria || '-'}</td>
        <td>${n.barrio || '-'}</td>
        <td>${fecha}</td>
        <td>${estado}</td>
      </tr>
    `;
  }).join('');
}

// ==================== TABLA NEGOCIOS ====================
const buscarAdmin = document.getElementById('buscarAdmin');
const filtroEstado = document.getElementById('filtroEstado');
const filtroOro = document.getElementById('filtroOro');

[buscarAdmin, filtroEstado, filtroOro].forEach(el => 
  el.addEventListener('input', renderTablaNegocios)
);

document.getElementById('btnRecargar').addEventListener('click', async () => {
  const btn = document.getElementById('btnRecargar');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
  await cargarNegocios();
  renderStats();
  renderRecientes();
  renderTablaNegocios();
  btn.disabled = false;
  btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i> Recargar';
  toast('Datos actualizados', 'Listo', 'success');
});

function renderTablaNegocios() {
  const texto = buscarAdmin.value.toLowerCase();
  const estado = filtroEstado.value;
  const oro = filtroOro.value;
  
  const filtrados = negocios.filter(n => {
    const matchTexto = !texto || 
      (n.nombre || '').toLowerCase().includes(texto) ||
      (n.barrio || '').toLowerCase().includes(texto) ||
      (n.categoria || '').toLowerCase().includes(texto);
    const matchEstado = !estado ||
      (estado === 'activo' && n.activo === true) ||
      (estado === 'inactivo' && n.activo === false) ||
      (estado === 'pendiente' && n.activo === undefined);
    const matchOro = !oro ||
      (oro === 'si' && n.oro) ||
      (oro === 'no' && !n.oro);
    return matchTexto && matchEstado && matchOro;
  });
  
  const tbody = document.getElementById('tablaNegocios');
  
  if (filtrados.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-4">Sin resultados</td></tr>';
    return;
  }
  
  tbody.innerHTML = filtrados.map(n => {
    const badges = [];
    if (n.oro) badges.push('<span class="badge badge-oro"><i class="bi bi-star-fill"></i> Oro</span>');
    if (n.recomendado) badges.push('<span class="badge badge-rec"><i class="bi bi-patch-check"></i> Rec</span>');
    if (!n.activo) badges.push('<span class="badge badge-inactivo">Pendiente</span>');
    
    const numFotos = (n.fotos || []).length;
    
    return `
      <tr>
        <td>
          <strong>${n.nombre || 'Sin nombre'}</strong>
          <div class="small text-muted">
            ${badges.join(' ')}
            ${numFotos > 0 ? `<span class="ms-1"><i class="bi bi-images"></i> ${numFotos}</span>` : ''}
            ${n.video ? '<span class="ms-1"><i class="bi bi-camera-video"></i></span>' : ''}
          </div>
        </td>
        <td>${n.categoria || '-'}</td>
        <td>${n.barrio || '-'}</td>
        <td><small>${n.whatsapp || '-'}</small></td>
        <td>
          ${n.activo 
            ? '<span class="badge bg-success">Activo</span>' 
            : '<span class="badge bg-secondary">Inactivo</span>'}
        </td>
        <td class="text-center">
          <div class="btn-group btn-group-sm">
            <button class="btn btn-outline-primary" onclick="editarNegocio('${n.id}')" title="Editar">
              <i class="bi bi-pencil"></i>
            </button>
            <button class="btn btn-outline-${n.activo ? 'warning' : 'success'}" 
                    onclick="toggleActivo('${n.id}')" 
                    title="${n.activo ? 'Desactivar' : 'Activar'}">
              <i class="bi bi-${n.activo ? 'eye-slash' : 'eye'}"></i>
            </button>
            <button class="btn btn-outline-${n.oro ? 'secondary' : 'warning'}" 
                    onclick="toggleOro('${n.id}')" 
                    title="${n.oro ? 'Quitar Oro' : 'Marcar Oro'}">
              <i class="bi bi-star${n.oro ? '-fill' : ''}"></i>
            </button>
            <button class="btn btn-outline-${n.recomendado ? 'secondary' : 'success'}" 
                    onclick="toggleRecomendado('${n.id}')" 
                    title="${n.recomendado ? 'Quitar Recomendado' : 'Marcar Recomendado'}">
              <i class="bi bi-patch-check${n.recomendado ? '-fill' : ''}"></i>
            </button>
            <button class="btn btn-outline-danger" 
                    onclick="eliminarNegocio('${n.id}', '${(n.nombre||'').replace(/'/g,"\\'")}')" 
                    title="Eliminar">
              <i class="bi bi-trash"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// ==================== ACCIONES RÁPIDAS ====================
window.toggleActivo = async function(id) {
  const n = negocios.find(x => x.id === id);
  if (!n) return;
  const nuevo = !n.activo;
  try {
    await db.collection('negocios').doc(id).update({ activo: nuevo });
    n.activo = nuevo;
    renderTablaNegocios();
    renderStats();
    toast(nuevo ? 'Negocio activado' : 'Negocio desactivado', 'Listo', 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'Error', 'error');
  }
};

window.toggleOro = async function(id) {
  const n = negocios.find(x => x.id === id);
  if (!n) return;
  const nuevo = !n.oro;
  try {
    await db.collection('negocios').doc(id).update({ oro: nuevo });
    n.oro = nuevo;
    renderTablaNegocios();
    renderStats();
    toast(nuevo ? '⭐ Perfil Oro activado' : 'Perfil Oro removido', 'Listo', 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'Error', 'error');
  }
};

window.toggleRecomendado = async function(id) {
  const n = negocios.find(x => x.id === id);
  if (!n) return;
  const nuevo = !n.recomendado;
  try {
    await db.collection('negocios').doc(id).update({ recomendado: nuevo });
    n.recomendado = nuevo;
    renderTablaNegocios();
    toast(nuevo ? '✅ Marcado como Recomendado' : 'Insignia removida', 'Listo', 'success');
  } catch (e) {
    toast('Error: ' + e.message, 'Error', 'error');
  }
};

window.eliminarNegocio = async function(id, nombre) {
  if (!confirm(`¿Eliminar "${nombre}"?\n\nEsta acción NO se puede deshacer.`)) return;
  try {
    await db.collection('negocios').doc(id).delete();
    negocios = negocios.filter(n => n.id !== id);
    renderTablaNegocios();
    renderStats();
    renderRecientes();
    toast('Negocio eliminado', 'Eliminado', 'warning');
  } catch (e) {
    toast('Error al eliminar: ' + e.message, 'Error', 'error');
  }
};

// ==================== EDITAR NEGOCIO ====================
window.editarNegocio = function(id) {
  const n = negocios.find(x => x.id === id);
  if (!n) return;
  
  document.getElementById('editId').value = id;
  document.getElementById('editNombre').value = n.nombre || '';
  document.getElementById('editCategoria').value = n.categoria || 'Otro';
  document.getElementById('editBarrio').value = n.barrio || 'Otro';
  document.getElementById('editEspecialidad').value = n.especialidad || '';
  document.getElementById('editWhatsapp').value = n.whatsapp || '';
  document.getElementById('editHorario').value = n.horario || '';
  document.getElementById('editMaps').value = n.maps || '';
  document.getElementById('editVideo').value = n.video || '';
  
  // Array de fotos → una URL por línea
  document.getElementById('editFotos').value = (n.fotos || []).join('\n');
  
  document.getElementById('editOro').checked = !!n.oro;
  document.getElementById('editRecomendado').checked = !!n.recomendado;
  document.getElementById('editActivo').checked = n.activo !== false;
  
  new bootstrap.Modal(document.getElementById('modalEditar')).show();
};

document.getElementById('formEditar').addEventListener('submit', async (e) => {
  e.preventDefault();
  const id = document.getElementById('editId').value;
  
  // Procesar fotos: una URL por línea, máximo 5
  const fotosTexto = document.getElementById('editFotos').value.trim();
  const fotos = fotosTexto 
    ? fotosTexto.split('\n').map(f => f.trim()).filter(f => f).slice(0, 5)
    : [];
  
  const data = {
    nombre: document.getElementById('editNombre').value.trim(),
    categoria: document.getElementById('editCategoria').value,
    barrio: document.getElementById('editBarrio').value,
    especialidad: document.getElementById('editEspecialidad').value.trim(),
    whatsapp: document.getElementById('editWhatsapp').value.trim(),
    horario: document.getElementById('editHorario').value.trim(),
    maps: document.getElementById('editMaps').value.trim(),
    video: document.getElementById('editVideo').value.trim(),
    fotos: fotos,
    oro: document.getElementById('editOro').checked,
    recomendado: document.getElementById('editRecomendado').checked,
    activo: document.getElementById('editActivo').checked,
    fechaActualizacion: new Date().toISOString()
  };
  
  try {
    await db.collection('negocios').doc(id).update(data);
    
    // Actualizar array local
    const idx = negocios.findIndex(n => n.id === id);
    if (idx >= 0) negocios[idx] = { id, ...negocios[idx], ...data };
    
    bootstrap.Modal.getInstance(document.getElementById('modalEditar')).hide();
    renderTablaNegocios();
    renderStats();
    renderRecientes();
    toast('Cambios guardados correctamente', '✅ Listo', 'success');
  } catch (e) {
    toast('Error al guardar: ' + e.message, 'Error', 'error');
  }
});

// ==================== CAMBIAR PIN ====================
document.getElementById('formPin').addEventListener('submit', async (e) => {
  e.preventDefault();
  const actual = document.getElementById('pinActual').value;
  const nuevo = document.getElementById('pinNuevo').value;
  const confirm = document.getElementById('pinConfirm').value;
  
  if (nuevo.length < 4 || nuevo.length > 6 || !/^\d+$/.test(nuevo)) {
    toast('El PIN debe tener 4-6 dígitos', 'Error', 'error');
    return;
  }
  if (nuevo !== confirm) {
    toast('Los PINs nuevos no coinciden', 'Error', 'error');
    return;
  }
  if (nuevo === actual) {
    toast('El nuevo PIN debe ser diferente al actual', 'Aviso', 'warning');
    return;
  }
  
  try {
    const hashActual = await hashPin(actual);
    const configDoc = await db.collection('config').doc('admin').get();
    const config = configDoc.data();
    
    if (config.pinHash !== hashActual) {
      toast('El PIN actual es incorrecto', '❌ Error', 'error');
      return;
    }
    
    const hashNuevo = await hashPin(nuevo);
    await db.collection('config').doc('admin').update({
      pinHash: hashNuevo,
      pinCreado: new Date().toISOString(),
      version: (config.version || 1) + 1
    });
    
    toast('PIN actualizado correctamente', '✅ Listo', 'success');
    document.getElementById('formPin').reset();
    cargarInfoConfig();
  } catch (e) {
    toast('Error al cambiar PIN: ' + e.message, 'Error', 'error');
  }
});

async function cargarInfoConfig() {
  try {
    const doc = await db.collection('config').doc('admin').get();
    if (doc.exists && doc.data().pinCreado) {
      document.getElementById('infoPinFecha').textContent = 
        new Date(doc.data().pinCreado).toLocaleString('es-CO');
    }
  } catch (e) { 
    console.error(e); 
  }
}