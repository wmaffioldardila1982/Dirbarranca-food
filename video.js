/* ==========================================================
   BarrancaFood · video.js (Versión Final Corregida)
   Reproductor flotante multi-plataforma optimizado
   ========================================================== */
(function () {
  'use strict';

  const MODAL_ID = 'bfVideoModal';
  const BODY_ID  = 'bfVideoBody';
  let modalInstancia = null;

  // ---------- Escapar texto para atributos HTML ----------
  function escAttr(valor) {
    return String(valor == null ? '' : valor)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // ---------- Crear el modal una sola vez ----------
  function crearModal() {
    if (document.getElementById(MODAL_ID)) return;

    const holder = document.createElement('div');
    holder.innerHTML = `
      <div class="modal fade" id="${MODAL_ID}" tabindex="-1" aria-hidden="true">
        <div class="modal-dialog modal-lg modal-dialog-centered">
          <div class="modal-content bg-dark text-white">
            <div class="modal-header border-secondary">
              <h5 class="modal-title" id="bfVideoTitle">Video promocional</h5>
              <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Cerrar"></button>
            </div>
            <div class="modal-body p-0 bg-black position-relative">
              <div id="${BODY_ID}" class="ratio ratio-16x9 d-flex align-items-center justify-content-center">
                <!-- El contenido se inyecta aquí -->
              </div>
            </div>
            <div class="modal-footer border-secondary py-2">
              <small class="text-white-50 me-auto">
                <i class="bi bi-info-circle"></i>
                ¿No carga? La plataforma puede requerir abrir el enlace original.
              </small>
              <a id="bfVideoExternal" class="btn btn-sm btn-outline-light" href="#" target="_blank" rel="noopener" style="display:none">
                Abrir original <i class="bi bi-box-arrow-up-right"></i>
              </a>
            </div>
          </div>
        </div>
      </div>`;

    document.body.appendChild(holder.firstElementChild);
  }

  // ---------- Detectar plataforma y construir reproductor ----------
  function resolver(raw) {
    const original = String(raw || '').trim();
    if (!original) {
      return { kind: 'error', note: 'Este negocio aún no tiene un video configurado.' };
    }

    let u;
    try {
      u = new URL(original);
    } catch (_) {
      return { kind: 'error', note: 'El enlace no es válido. Debe empezar por https://' };
    }

    if (!/^https?:$/.test(u.protocol)) {
      return { kind: 'error', note: 'Ese protocolo no es un enlace de video.' };
    }

    const host = u.hostname.replace(/^www\./, '').toLowerCase();
    const path = u.pathname;
    const query = u.searchParams;

    const yt = (id) => ({
      kind: 'iframe',
      src: `https://www.youtube.com/embed/${id}?autoplay=1&rel=0&modestbranding=1`,
      plataforma: 'youtube'
    });

    // 1. YOUTUBE
    if (host === 'youtu.be') {
      const id = path.slice(1).split('/')[0].split('?')[0];
      if (/^[A-Za-z0-9_-]{11}$/.test(id)) return yt(id);
    }
    if (/(^|\.)youtube\.com$/.test(host) || host === 'youtube-nocookie.com') {
      let id = query.get('v');
      if (!id) {
        const m = path.match(/^\/(embed|shorts|live|v)\/([A-Za-z0-9_-]{11})/);
        if (m) id = m[2];
      }
      if (id && /^[A-Za-z0-9_-]{11}$/.test(id)) return yt(id);
    }

    // 2. VIMEO
    if (/(^|\.)vimeo\.com$/.test(host)) {
      const m = path.match(/\/(?:video\/)?(\d+)/);
      if (m) {
        return { kind: 'iframe', src: `https://player.vimeo.com/video/${m[1]}?autoplay=1`, plataforma: 'vimeo' };
      }
    }

    // 3. FACEBOOK (Optimizado para evitar zoom/barras negras)
    if (/(^|\.)facebook\.com$/.test(host) || host === 'fb.watch') {
      let id = query.get('v') || query.get('fbid');
      if (!id) {
        const m = path.match(/\/videos\/(\d+)/) || path.match(/\/watch\/?\?.*v=(\d+)/) || path.match(/\/reel\/(\d+)/);
        if (m) id = m[1];
      }
      if (id) {
        const canonicalUrl = `https://www.facebook.com/watch/?v=${id}`;
        return {
          kind: 'iframe',
          src: `https://www.facebook.com/plugins/video.php?` +
               `href=${encodeURIComponent(canonicalUrl)}` +
               `&show_text=false` +
               `&width=560` +
               `&height=315` +
               `&locale=es_ES`,
          plataforma: 'facebook',
          original: canonicalUrl
        };
      }
      return { kind: 'external', src: original, note: 'Enlace de Facebook no reconocido. Ábrelo en una pestaña nueva.' };
    }

    // 4. INSTAGRAM
    if (/(^|\.)instagram\.com$/.test(host)) {
      const m = path.match(/\/(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/);
      if (m) {
        const tipo = m[1] === 'reels' ? 'reel' : m[1];
        return { kind: 'iframe', src: `https://www.instagram.com/${tipo}/${m[2]}/embed/`, plataforma: 'instagram' };
      }
    }

    // 5. TIKTOK
    if (/(^|\.)tiktok\.com$/.test(host) || host === 'vm.tiktok.com' || host === 'vt.tiktok.com') {
      const m = path.match(/\/video\/(\d+)/);
      if (m) {
        return { kind: 'iframe', src: `https://www.tiktok.com/embed/v2/${m[1]}`, plataforma: 'tiktok' };
      }
      return { kind: 'external', src: original, note: 'TikTok bloquea enlaces cortos. Abre el video original.' };
    }

    // 6. GOOGLE DRIVE
    if (host === 'drive.google.com') {
      const m = path.match(/\/file\/d\/([A-Za-z0-9_-]+)/);
      const id = m ? m[1] : query.get('id');
      if (id) {
        return { kind: 'iframe', src: `https://drive.google.com/file/d/${id}/preview`, plataforma: 'drive' };
      }
    }

    // 7. VIDEO DIRECTO (.mp4, .webm, etc.)
    if (/\.(mp4|webm|ogg|ogv|mov|m4v)$/i.test(path)) {
      return { kind: 'video', src: original, plataforma: 'directo' };
    }

    // 8. Desconocido
    return { kind: 'external', src: original, note: 'Esta plataforma no permite reproducir el video dentro del directorio.' };
  }

  // ---------- Dibujar el reproductor dentro del modal ----------
  function mostrar(res) {
    const body = document.getElementById(BODY_ID);
    const ext  = document.getElementById('bfVideoExternal');

    // Resetear estado
    body.className = 'ratio ratio-16x9 d-flex align-items-center justify-content-center bg-black';
    body.innerHTML = '';
    ext.href = '#';
    ext.style.display = 'none';

    if (res.kind === 'iframe') {
      const iframe = document.createElement('iframe');
      iframe.src = res.src;
      iframe.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
      iframe.allowFullscreen = true;
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.title = 'Video promocional';
      
      // Estilos específicos para Facebook para evitar el "zoom" o estiramiento
      if (res.plataforma === 'facebook') {
        iframe.style.cssText = 'border:none; overflow:hidden; background:#000; max-width:100%; aspect-ratio:16/9;';
        iframe.className = 'bf-facebook-embed';
      } else {
        iframe.style.cssText = 'border:none; width:100%; height:100%;';
      }

      body.appendChild(iframe);

      // Enlace de respaldo por si el embed falla (muy común en Facebook)
      if (res.original) {
        ext.href = res.original;
        ext.style.display = 'inline-block';
      }

    } else if (res.kind === 'video') {
      const video = document.createElement('video');
      video.src = res.src;
      video.controls = true;
      video.playsInline = true;
      video.preload = 'auto';
      video.style.cssText = 'width:100%; height:100%; object-fit:contain; background:#000;';

      video.addEventListener('error', () => {
        body.className = 'p-4 text-center';
        body.innerHTML = `<i class="bi bi-camera-video-off" style="font-size:2.5rem"></i><p class="mt-3 mb-0">No se pudo cargar el archivo.</p>`;
        ext.href = res.src;
        ext.style.display = 'inline-block';
      });

      body.appendChild(video);
      const intento = video.play();
      if (intento && typeof intento.catch === 'function') {
        intento.catch(() => { /* Autoplay bloqueado por el navegador, el usuario dará play */ });
      }

    } else {
      body.className = 'p-4 text-center';
      body.innerHTML = `
        <i class="bi bi-camera-video-off" style="font-size:2.5rem; opacity:.6"></i>
        <p class="mt-3 mb-1">${escAttr(res.note || 'No se puede incrustar este video.')}</p>
        <small class="text-white-50">Usa el botón "Abrir original" para verlo.</small>`;

      if (res.src) {
        ext.href = res.src;
        ext.style.display = 'inline-block';
      }
    }
  }

  // ---------- FUNCIÓN PRINCIPAL ----------
  function abrir(rawUrl, titulo) {
    try {
      if (typeof bootstrap === 'undefined') {
        console.warn('[BarrancaFood] Bootstrap JS no está cargado.');
        if (rawUrl) window.open(rawUrl, '_blank', 'noopener');
        return;
      }

      crearModal();
      document.getElementById('bfVideoTitle').textContent = titulo || 'Video promocional';
      mostrar(resolver(rawUrl));

      if (!modalInstancia) {
        modalInstancia = new bootstrap.Modal(document.getElementById(MODAL_ID));
      }
      modalInstancia.show();

    } catch (error) {
      console.error('[BarrancaFood] Error al abrir el video:', error);
      if (rawUrl) window.open(rawUrl, '_blank', 'noopener');
    }
  }

  // ---------- Detener el video al cerrar el modal ----------
  document.addEventListener('hidden.bs.modal', function (e) {
    if (e.target && e.target.id === MODAL_ID) {
      const body = document.getElementById(BODY_ID);
      if (body) body.innerHTML = ''; // Esto mata el iframe/video y detiene la reproducción
    }
  });

  // ---------- DELEGACIÓN: Un solo listener para TODOS los botones ----------
  document.addEventListener('click', function (e) {
    const boton = e.target instanceof Element ? e.target.closest('[data-video]') : null;
    if (!boton) return;
    e.preventDefault();
    abrir(boton.getAttribute('data-video'), boton.getAttribute('data-titulo'));
  });

  // ---------- API pública y compatibilidad ----------
  window.BarrancaVideo = { abrir: abrir };
  window.abrirVideo = function (url, titulo) { abrir(url, titulo); }; // Compatibilidad

  // ---------- Inicializar ----------
  function init() {
    crearModal();
    console.log('✅ [BarrancaFood] Reproductor de video listo.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();