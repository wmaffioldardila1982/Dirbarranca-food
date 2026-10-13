// ==================== ESCAPAR ATRIBUTOS HTML ====================
function escAttr(valor) {
  return String(valor == null ? '' : valor)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// ==================== ESTADO GLOBAL ====================
const lista = document.getElementById('listaNegocios');
const contador = document.getElementById('contador');
const buscador = document.getElementById('buscador');
const filtroBarrio = document.getElementById('filtroBarrio');
const filtroCategoria = document.getElementById('filtroCategoria');
const filtroAbierto = document.getElementById('filtroAbierto');

let negocios = [];

// ==================== CARGAR NEGOCIOS ====================
async function cargarNegocios() {
  try {
    const snapshot = await db.collection('negocios').get();
    negocios = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // Convertir foto única a array de fotos (retrocompatibilidad)
      if (data.foto && !data.fotos) {
        data.fotos = [data.foto];
      } else if (!data.fotos) {
        data.fotos = [];
      }
      negocios.push({ id: doc.id, ...data });
    });
    renderizar();
  } catch (error) {
    console.error('Error cargando:', error);
    lista.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-exclamation-triangle text-warning" style="font-size:3rem"></i>
        <p class="mt-3">No se pudieron cargar los negocios. Verifica tu configuración de Firebase.</p>
      </div>`;
  }
}

// ==================== RENDERIZAR TARJETAS ====================
function renderizar() {
  const texto = buscador.value.toLowerCase();
  const barrio = filtroBarrio.value;
  const categoria = filtroCategoria.value;
  const soloAbiertos = filtroAbierto.checked;
  
  const filtrados = negocios.filter(n => {
    const matchTexto = !texto || 
      (n.nombre || '').toLowerCase().includes(texto) ||
      (n.especialidad || '').toLowerCase().includes(texto) ||
      (n.barrio || '').toLowerCase().includes(texto);
    const matchBarrio = !barrio || n.barrio === barrio;
    const matchCategoria = !categoria || n.categoria === categoria;
    const matchAbierto = !soloAbiertos || estaAbierto(n.horario);
    
    return matchTexto && matchBarrio && matchCategoria && matchAbierto;
  });
  
  // Ordenar: ORO primero, luego recomendados, luego alfabético
  filtrados.sort((a, b) => {
    if (a.oro && !b.oro) return -1;
    if (!a.oro && b.oro) return 1;
    if (a.recomendado && !b.recomendado) return -1;
    if (!a.recomendado && b.recomendado) return 1;
    return (a.nombre || '').localeCompare(b.nombre || '');
  });
  
  contador.textContent = filtrados.length;
  
  if (filtrados.length === 0) {
    lista.innerHTML = `
      <div class="col-12 text-center py-5">
        <i class="bi bi-search" style="font-size:3rem;color:#ccc"></i>
        <p class="mt-3">No encontramos puestos con esos filtros. ¡Intenta con otros!</p>
      </div>`;
    return;
  }
  
  lista.innerHTML = filtrados.map(n => tarjetaHTML(n)).join('');
}

// ==================== TARJETA INDIVIDUAL ====================
function tarjetaHTML(n) {
  const abierto = estaAbierto(n.horario);
  const estadoClass = abierto ? 'estado-abierto' : 'estado-cerrado';
  const estadoTexto = abierto ? '● Abierto ahora' : '○ Cerrado';
  const oroClass = n.oro ? 'gold' : '';
  const recomendadoBadge = n.recomendado ? '<span class="badge-recomendado"><i class="bi bi-patch-check-fill"></i> Recomendado</span>' : '';
  
  // Carrusel de fotos
  const fotos = n.fotos && n.fotos.length > 0 ? n.fotos : ['https://via.placeholder.com/400x200?text=Sin+foto'];
  const fotosHTML = generarCarrusel(n.id, fotos);
  
  const mapsLink = n.maps || '#';
  const whatsappLink = n.whatsapp 
    ? `https://wa.me/57${n.whatsapp.replace(/\D/g,'')}?text=Hola,%20vi%20tu%20puesto%20en%20BarrancaFood`
    : '#';
  
  return `
    <div class="col-md-6 col-lg-4">
      <div class="card card-negocio ${oroClass}">
        ${fotosHTML}
        <div class="card-body">
          <h5 class="card-title fw-bold">
            ${n.nombre || 'Sin nombre'} ${recomendadoBadge}
          </h5>
          <p class="mb-1">
            <i class="bi bi-tag text-danger"></i> ${n.categoria || 'Sin categoría'}
          </p>
          <p class="mb-1">
            <i class="bi bi-geo-alt text-danger"></i> ${n.barrio || 'Sin barrio'}
          </p>
          <p class="mb-2 ${estadoClass}">
            <i class="bi bi-clock"></i> ${estadoTexto}
            <small class="text-muted d-block">${n.horario || 'Horario no especificado'}</small>
          </p>
          
          ${n.especialidad ? `
            <div class="especialidad">
              <i class="bi bi-star-fill text-warning"></i> <strong>El especial:</strong> ${n.especialidad}
            </div>
          ` : ''}
          
          <div class="d-flex gap-2 mt-3">
            <a href="${whatsappLink}" target="_blank" class="btn btn-whatsapp flex-grow-1">
              <i class="bi bi-whatsapp"></i> Pedir
            </a>
            ${n.video ? `
  <button type="button" class="btn btn-video"
          data-video="${escAttr(n.video)}"
          data-titulo="${escAttr(n.nombre || 'Video promocional')}"
          aria-label="Ver video promocional">
    <i class="bi bi-play-circle"></i>
  </button>
` : ''}<a href="${mapsLink}" target="_blank" class="btn btn-outline-secondary" title="Ver en mapa">
              <i class="bi bi-map"></i>
            </a>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== CARRUSEL DE FOTOS ====================
function generarCarrusel(id, fotos) {
  if (fotos.length === 1) {
    return `
      <img src="${fotos[0]}" class="card-img-top" alt="Foto del negocio" 
           onclick="abrirGaleria('${id}', 0)" style="cursor:pointer"
           onerror="this.src='https://via.placeholder.com/400x200?text=Sin+foto'">
    `;
  }
  
  const indicadores = fotos.map((_, i) => `
    <button type="button" data-bs-target="#carousel${id}" data-bs-slide-to="${i}" 
            class="${i === 0 ? 'active' : ''}" aria-label="Foto ${i + 1}"></button>
  `).join('');
  
  const items = fotos.map((foto, i) => `
    <div class="carousel-item ${i === 0 ? 'active' : ''}">
      <img src="${foto}" class="d-block w-100" alt="Foto ${i + 1}" 
           onclick="abrirGaleria('${id}', ${i})" style="cursor:pointer;height:200px;object-fit:cover"
           onerror="this.src='https://via.placeholder.com/400x200?text=Sin+foto'">
    </div>
  `).join('');
  
  return `
    <div id="carousel${id}" class="carousel slide" data-bs-ride="carousel">
      <div class="carousel-indicators">
        ${indicadores}
      </div>
      <div class="carousel-inner">
        ${items}
      </div>
      <button class="carousel-control-prev" type="button" data-bs-target="#carousel${id}" data-bs-slide="prev">
        <span class="carousel-control-prev-icon"></span>
      </button>
      <button class="carousel-control-next" type="button" data-bs-target="#carousel${id}" data-bs-slide="next">
        <span class="carousel-control-next-icon"></span>
      </button>
    </div>
  `;
}

// ==================== DETECTAR SI ESTÁ ABIERTO ====================
function estaAbierto(horario) {
  if (!horario) return false;
  
  const ahora = new Date();
  const horaActual = ahora.getHours() * 60 + ahora.getMinutes();
  
  const h = horario.toLowerCase();
  
  // Detectar si menciona el día actual
  const dias = {
    'lunes': 1, 'martes': 2, 'miércoles': 3, 'miercoles': 3,
    'jueves': 4, 'viernes': 5, 'sábado': 6, 'sabado': 6,
    'domingo': 0, 'lunes a viernes': [1,2,3,4,5],
    'lunes a sábado': [1,2,3,4,5,6], 'todos los días': [0,1,2,3,4,5,6]
  };
  
  for (const [texto, diasArr] of Object.entries(dias)) {
    if (h.includes(texto)) {
      const diasValidos = Array.isArray(diasArr) ? diasArr : [diasArr];
      if (!diasValidos.includes(ahora.getDay())) return false;
    }
  }
  
  if (h.includes('fin de semana') || h.includes('fines de semana')) {
    if (ahora.getDay() !== 0 && ahora.getDay() !== 6) return false;
  }
  
  const match = h.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)?.*?(\d{1,2})(?::(\d{2}))?\s*(am|pm|a\.?m\.?|p\.?m\.?)/i);
  if (match) {
    let inicio = parseInt(match[1]) * 60 + parseInt(match[2] || 0);
    let fin = parseInt(match[4]) * 60 + parseInt(match[5] || 0);
    
    const ampm1 = (match[3] || '').toLowerCase().replace(/\./g,'');
    const ampm2 = (match[6] || '').toLowerCase().replace(/\./g,'');
    
    if (ampm1 === 'pm' && inicio < 720) inicio += 720;
    if (ampm2 === 'pm' && fin < 720) fin += 720;
    
    return horaActual >= inicio && horaActual <= fin;
  }
  
  if (h.includes('noche') || h.includes('6 pm') || h.includes('6:00 pm')) {
    return horaActual >= 1080;
  }
  
  return true;
}



// ==================== ABRIR GALERÍA (GLOBAL) ====================
window.abrirGaleria = function(negocioId, indiceInicial) {
  const n = negocios.find(x => x.id === negocioId);
  if (!n || !n.fotos || n.fotos.length === 0) return;
  
  const modalElement = document.getElementById('modalGaleria');
  const carrusel = document.getElementById('galeriaCarrusel');
  
  document.getElementById('galeriaTitulo').textContent = n.nombre || 'Galería';
  
  const items = n.fotos.map((foto, i) => `
    <div class="carousel-item ${i === indiceInicial ? 'active' : ''}">
      <img src="${foto}" class="d-block w-100" alt="Foto ${i + 1}"
           style="max-height:80vh;object-fit:contain;margin:auto"
           onerror="this.src='https://via.placeholder.com/800x600?text=Error+al+cargar'">
    </div>
  `).join('');
  
  carrusel.innerHTML = items;
  
  const modal = new bootstrap.Modal(modalElement);
  modal.show();
};


// ==================== EVENTOS DE FILTRADO ====================
buscador.addEventListener('input', renderizar);
filtroBarrio.addEventListener('change', renderizar);
filtroCategoria.addEventListener('change', renderizar);
filtroAbierto.addEventListener('change', renderizar);

// Iniciar
cargarNegocios();