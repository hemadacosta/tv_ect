// script.js (v4) - navegação robusta + controles discretos
let currentIndex = 0;

let player = null;          // instância atual (YT.Player ou Vimeo.Player)
let currentType = null;     // 'youtube' | 'vimeo' | 'googledrive'
let currentVolume = 100;
let autoplayEnabled = true;

// ====== UI: volume (se existir) ======
const volumeSlider = document.getElementById('volume-slider');
const volumeValue  = document.getElementById('volume-value');

if (volumeSlider) {
  volumeSlider.addEventListener('input', function () {
    currentVolume = Number(this.value);
    if (volumeValue) volumeValue.textContent = currentVolume + '%';
    updateVolume();
  });
}

function setStatus(text) {
  const el = document.getElementById('status-text');
  if (el) el.innerText = text;
}

function setTitle(text) {
  const el = document.getElementById('video-title');
  if (el) el.innerText = text;
}

function updateVolume() {
  try {
    if (!player) return;
    if (currentType === 'youtube' && typeof player.setVolume === 'function') {
      player.setVolume(currentVolume);
    } else if (currentType === 'vimeo' && typeof player.setVolume === 'function') {
      player.setVolume(currentVolume / 100);
    }
  } catch (e) {
    console.warn('updateVolume falhou:', e);
  }
}

// ====== Boot ======
function startTV() {
  if (typeof schedule === 'undefined' || !Array.isArray(schedule) || schedule.length === 0) {
    setTitle("Nenhum vídeo na programação.");
    setStatus("Aguarde, iniciando o fluxo...");
    return;
  }
  loadVideo(currentIndex);
}

// ====== Player cleanup (ESSENCIAL) ======
function cleanupPlayer() {
  try {
    if (!player) return;

    // YouTube
    if (currentType === 'youtube') {
      if (typeof player.stopVideo === 'function') player.stopVideo();
      if (typeof player.destroy === 'function') player.destroy(); // importante!
    }

    // Vimeo
    if (currentType === 'vimeo') {
      if (typeof player.unload === 'function') player.unload();
      if (typeof player.destroy === 'function') player.destroy();
    }
  } catch (e) {
    console.warn('cleanupPlayer falhou:', e);
  } finally {
    player = null;
    currentType = null;
    const container = document.getElementById('player');
    if (container) container.innerHTML = '';
  }
}

// ====== Carregar vídeo ======
function loadVideo(index) {
  const videoData = schedule[index];
  if (!videoData) return;

  setTitle(videoData.title || `Vídeo ${index + 1}`);
  setStatus(`Vídeo ${index + 1} de ${schedule.length}`);

  // tipo
  let type = videoData.type;
  if (!type) {
    const u = (videoData.url || '').toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) type = 'youtube';
    else if (u.includes('vimeo.com')) type = 'vimeo';
    else if (u.includes('drive.google.com')) type = 'googledrive';
  }

  // Se mudou de tipo, destrói player anterior para evitar travar a troca
  if (currentType && currentType !== type) {
    cleanupPlayer();
  }

  currentType = type;

  if (type === 'youtube') loadYouTube(videoData.url);
  else if (type === 'vimeo') loadVimeo(videoData.url);
  else if (type === 'googledrive') loadGoogleDrive(videoData.url);
  else {
    console.error("Tipo de vídeo não suportado:", type, videoData);
    setStatus("Tipo de vídeo não suportado.");
  }
}

// ====== YouTube ======
function loadYouTube(url) {
  const videoId = extractYouTubeID(url);
  if (!videoId) {
    console.error("ID do YouTube não encontrado:", url);
    setStatus("Erro: link do YouTube inválido.");
    return;
  }

  // Se API ainda não carregou
  if (typeof YT === 'undefined' || !YT.Player) {
    setStatus("Carregando player do YouTube...");
    setTimeout(() => loadYouTube(url), 400);
    return;
  }

  // Se já existe player YouTube, use loadVideoById (sem recriar)
  if (player && currentType === 'youtube' && typeof player.loadVideoById === 'function') {
    try {
      player.loadVideoById(videoId);
      player.setVolume(currentVolume);
      return;
    } catch (e) {
      console.warn('Falha ao reutilizar player YouTube, recriando...', e);
      cleanupPlayer();
    }
  }

  // Cria do zero
  const container = document.getElementById('player');
  if (container) container.innerHTML = '';

  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId,
    playerVars: {
      autoplay: autoplayEnabled ? 1 : 0,
      controls: 0,           // sem barra
      rel: 0,
      modestbranding: 1,
      playsinline: 1
    },
    events: {
      onReady: (event) => {
        try {
          event.target.setVolume(currentVolume);
          if (autoplayEnabled) event.target.playVideo();
        } catch {}
      },
      onStateChange: (event) => {
        try {
          if (event.data === YT.PlayerState.ENDED) {
            setTimeout(playNext, 700);
          }
        } catch {}
      }
    }
  });
}

// ====== Vimeo ======
function loadVimeo(url) {
  const videoId = extractVimeoID(url);
  if (!videoId) {
    console.error("ID do Vimeo não encontrado:", url);
    setStatus("Erro: link do Vimeo inválido.");
    return;
  }

  // Se já existe player Vimeo, use loadVideo (sem recriar)
  if (player && currentType === 'vimeo' && typeof player.loadVideo === 'function') {
    player.loadVideo(videoId).then(() => {
      player.setVolume(currentVolume / 100);
    }).catch((e) => {
      console.warn('Falha ao reutilizar player Vimeo, recriando...', e);
      cleanupPlayer();
      loadVimeo(url);
    });
    return;
  }

  const container = document.getElementById('player');
  if (container) container.innerHTML = '';

  player = new Vimeo.Player('player', {
    id: videoId,
    autoplay: autoplayEnabled,
    controls: 0,
    background: 1,
    loop: false,
    volume: currentVolume / 100
  });

  player.on('ended', () => setTimeout(playNext, 700));
  player.on('loaded', () => updateVolume());
}

// ====== Google Drive ======
function loadGoogleDrive(url) {
  const fileId = extractGoogleDriveID(url);
  if (!fileId) {
    console.error("ID do Google Drive não encontrado:", url);
    document.getElementById('player').innerHTML =
      '<p style="color:white;text-align:center;padding:16px;">Erro ao carregar vídeo do Google Drive</p>';
    setStatus("Erro: link do Drive inválido.");
    return;
  }

  const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  const container = document.getElementById('player');
  if (container) {
    container.innerHTML = `
      <iframe
        src="${embedUrl}"
        width="100%"
        height="100%"
        style="border:none;"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen>
      </iframe>`;
  }
  setStatus("Google Drive — use os botões para navegar");
}

// ====== Navegação ======
function playNextManual() {
  setStatus("Indo para o próximo vídeo...");
  playNext();
}

function playNext() {
  // IMPORTANTE: se estiver em YouTube/Vimeo, não precisa destruir pra trocar dentro do mesmo tipo.
  currentIndex = (currentIndex + 1) % schedule.length;
  loadVideo(currentIndex);
}

function playPrevious() {
  setStatus("Voltando para o vídeo anterior...");
  currentIndex = (currentIndex - 1 + schedule.length) % schedule.length;
  loadVideo(currentIndex);
}

// Expor para onclick do HTML (blindagem)
window.playNextManual = playNextManual;
window.playNext = playNext;
window.playPrevious = playPrevious;

// ====== Utilitários ======
function extractYouTubeID(url) {
  if (!url) return null;
  url = url.trim();

  // youtu.be/<id>
  let m = url.match(/youtu\.be\/([^?\s]+)/);
  if (m && m[1]) return m[1];

  // watch?v=<id>
  m = url.match(/[?&]v=([^&\s]+)/);
  if (m && m[1]) return m[1];

  // /embed/<id>
  m = url.match(/youtube\.com\/embed\/([^?\s]+)/);
  if (m && m[1]) return m[1];

  // /v/<id>
  m = url.match(/youtube\.com\/v\/([^?\s]+)/);
  if (m && m[1]) return m[1];

  return null;
}

function extractVimeoID(url) {
  if (!url) return null;
  url = url.trim();
  const m = url.match(/vimeo\.com\/(?:.*\/)?(\d+)/);
  return m ? m[1] : null;
}

function extractGoogleDriveID(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([^\/\?]+)/);
  return m ? m[1] : null;
}

// ====== Controles discretos (hover + toque) ======
(function initOverlayControls() {
  const wrapper = document.getElementById('video-wrapper');
  if (!wrapper) return;

  let hideTimer = null;
  const show = () => {
    wrapper.classList.add('show-controls');
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => wrapper.classList.remove('show-controls'), 2500);
  };

  // toque/clique no vídeo mostra botões por 2.5s (não fixa)
  wrapper.addEventListener('pointerdown', (e) => {
    // se clicou em botão, não mexe
    if (e.target && (e.target.id === 'btn-prev' || e.target.id === 'btn-next')) return;
    show();
  }, { passive: true });
})();

// ====== Inicialização ======
window.onYouTubeIframeAPIReady = function () {
  startTV();
};

// Fallback: se por algum motivo o callback não vier, tenta iniciar depois
setTimeout(() => {
  if (!player && (typeof schedule !== 'undefined')) startTV();
}, 1200);
