// script.js (v3) — navegação robusta para GitHub Pages + Moodle popup
let currentIndex = 0;
let player = null;
let currentType = null;
let currentVolume = 100;
let autoplayEnabled = true;
let manualControl = false;

// ====== Helpers de DOM ======
const $ = (id) => document.getElementById(id);

// ====== Bind de controles (clique/pointer) ======
function bindControls() {
  const btnPrev = $('btn-prev');
  const btnNext = $('btn-next');

  if (btnPrev) {
    const handlerPrev = (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
      playPrevious();
    };
    btnPrev.addEventListener('pointerdown', handlerPrev, { capture: true });
    btnPrev.addEventListener('click', handlerPrev, { capture: true });
  }

  if (btnNext) {
    const handlerNext = (ev) => {
      try { ev.preventDefault(); ev.stopPropagation(); } catch (_) {}
      playNextManual();
    };
    btnNext.addEventListener('pointerdown', handlerNext, { capture: true });
    btnNext.addEventListener('click', handlerNext, { capture: true });
  }
}

// expõe no global (para onclick inline, se existir)
window.playPrevious = () => playPrevious();
window.playNextManual = () => playNextManual();

// ====== Volume ======
function bindVolume() {
  const volumeSlider = $('volume-slider');
  const volumeValue  = $('volume-value');

  if (!volumeSlider) return;

  volumeSlider.addEventListener('input', function () {
    currentVolume = Number(this.value);
    if (volumeValue) volumeValue.textContent = currentVolume + '%';
    updateVolume();
  });
}

function updateVolume() {
  if (!player) return;

  try {
    if (currentType === 'youtube' && typeof player.setVolume === 'function') {
      player.setVolume(currentVolume);
    } else if (currentType === 'vimeo' && typeof player.setVolume === 'function') {
      player.setVolume(currentVolume / 100);
    }
    // Google Drive: sem API de volume no embed /preview
  } catch (e) {
    console.warn('Falha ao atualizar volume:', e);
  }
}

// ====== Inicialização ======
function init() {
  bindControls();
  bindVolume();

  // Se schedule não carregou, mostre erro claro
  if (typeof schedule === 'undefined' || !Array.isArray(schedule)) {
    const title = $('video-title');
    const status = $('status-text');
    if (title) title.innerText = "Nenhum vídeo na programação.";
    if (status) status.innerText = "Erro: config.js não carregou (ou está com erro).";
    console.error('schedule indefinido — verifique config.js');
    return;
  }

  if (schedule.length === 0) {
    const title = $('video-title');
    if (title) title.innerText = "Nenhum vídeo na programação.";
    return;
  }

  loadVideo(currentIndex);
}

// GitHub Pages + Moodle: garante init mesmo se API do YouTube demorar
window.onYouTubeIframeAPIReady = function () {
  // Não inicia duas vezes
  if (!window.__tv_started__) {
    window.__tv_started__ = true;
    init();
  }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    if (typeof YT !== 'undefined' && YT.Player) {
      if (!window.__tv_started__) { window.__tv_started__ = true; init(); }
    } else {
      // inicia para Vimeo/Drive enquanto o YT carrega
      if (!window.__tv_started__) { window.__tv_started__ = true; init(); }
    }
  });
} else {
  if (!window.__tv_started__) { window.__tv_started__ = true; init(); }
}

// ====== Core ======
function loadVideo(index) {
  const videoData = schedule[index];
  const title = $('video-title');
  const status = $('status-text');

  if (title) title.innerText = videoData?.title || 'Sem título';
  if (status) status.innerText = `Vídeo ${index + 1} de ${schedule.length}`;

  destroyCurrentPlayer();

  const container = $('player');
  if (!container) return;
  container.innerHTML = '';

  const type = detectType(videoData);
  currentType = type;

  if (type === 'youtube') loadYouTube(videoData.url);
  else if (type === 'vimeo') loadVimeo(videoData.url);
  else if (type === 'googledrive') loadGoogleDrive(videoData.url);
  else {
    console.error("Tipo de vídeo não suportado:", type, videoData);
    if (status) status.innerText = "Tipo de vídeo não suportado.";
  }
}

function detectType(videoData) {
  let type = videoData?.type;
  const url = videoData?.url || '';
  if (!type) {
    if (url.includes('youtube.com') || url.includes('youtu.be')) type = 'youtube';
    else if (url.includes('vimeo.com')) type = 'vimeo';
    else if (url.includes('drive.google.com')) type = 'googledrive';
  }
  return type;
}

function destroyCurrentPlayer() {
  if (!player) return;

  try {
    if (currentType === 'youtube') {
      if (typeof player.stopVideo === 'function') player.stopVideo();
      if (typeof player.destroy === 'function') player.destroy();
    } else if (currentType === 'vimeo') {
      if (typeof player.unload === 'function') player.unload().catch(() => {});
      if (typeof player.destroy === 'function') player.destroy().catch(() => {});
    }
  } catch (e) {
    console.warn('Falha ao destruir player anterior:', e);
  } finally {
    player = null;
  }
}

// ====== YouTube ======
function loadYouTube(url) {
  const videoId = extractYouTubeID(url);
  const status = $('status-text');

  if (!videoId) {
    console.error("ID do YouTube não encontrado em:", url);
    if (status) status.innerText = "Erro: vídeo do YouTube inválido.";
    return;
  }

  if (typeof YT === 'undefined' || !YT.Player) {
    // aguarda API carregar
    setTimeout(() => loadYouTube(url), 250);
    return;
  }

  player = new YT.Player('player', {
    height: '100%',
    width: '100%',
    videoId,
    playerVars: {
      autoplay: (autoplayEnabled && !manualControl) ? 1 : 0,
      controls: 0,
      rel: 0,
      modestbranding: 1,
      playsinline: 1
    },
    events: {
      onReady: (event) => {
        try {
          event.target.setVolume(currentVolume);
          if (autoplayEnabled) event.target.playVideo();
        } catch (_) {}
      },
      onStateChange: (event) => {
        if (event.data === YT.PlayerState.ENDED && !manualControl) {
          setTimeout(playNext, 800);
        }
      }
    }
  });
}

// ====== Vimeo ======
function loadVimeo(url) {
  const videoId = extractVimeoID(url);
  const status = $('status-text');

  if (!videoId) {
    console.error("ID do Vimeo não encontrado em:", url);
    if (status) status.innerText = "Erro: vídeo do Vimeo inválido.";
    return;
  }

  player = new Vimeo.Player('player', {
    id: videoId,
    autoplay: autoplayEnabled && !manualControl,
    controls: 0,
    background: true,
    loop: false,
    volume: currentVolume / 100,
    transparent: false
  });

  player.on('ended', () => {
    if (!manualControl) setTimeout(playNext, 800);
  });

  player.on('loaded', () => {
    player.setVolume(currentVolume / 100).catch(() => {});
  });
}

// ====== Google Drive ======
function loadGoogleDrive(url) {
  const fileId = extractGoogleDriveID(url);
  const container = $('player');
  const status = $('status-text');

  if (!fileId) {
    console.error("ID do Google Drive não encontrado em:", url);
    if (container) container.innerHTML = '<p style="color:white; text-align:center;">Erro ao carregar vídeo do Google Drive</p>';
    if (status) status.innerText = "Erro: vídeo do Google Drive inválido.";
    return;
  }

  const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

  if (container) {
    container.innerHTML = `
      <iframe
        src="${embedUrl}"
        width="100%"
        height="100%"
        allow="autoplay; fullscreen; picture-in-picture"
        allowfullscreen
        referrerpolicy="no-referrer-when-downgrade">
      </iframe>
    `;
  }

  if (status) status.innerText = "Google Drive — use Anterior/Próximo para navegar.";
  player = null;
}

// ====== Navegação ======
function playNextManual() {
  manualControl = true;
  // feedback imediato (para você “ver” que clicou)
  const status = $('status-text');
  if (status) status.innerText = "Indo para o próximo vídeo…";
  playNext();
}

function playNext() {
  destroyCurrentPlayer();
  currentIndex++;
  if (currentIndex >= schedule.length) currentIndex = 0;
  loadVideo(currentIndex);
}

function playPrevious() {
  manualControl = true;
  const status = $('status-text');
  if (status) status.innerText = "Voltando para o vídeo anterior…";

  destroyCurrentPlayer();
  currentIndex--;
  if (currentIndex < 0) currentIndex = schedule.length - 1;
  loadVideo(currentIndex);
}

// ====== Utilitários ======
function extractYouTubeID(url) {
  if (!url) return null;

  try {
    const u = new URL(url.trim());
    if (u.hostname.includes('youtu.be')) {
      const id = u.pathname.replace('/', '').trim();
      return id || null;
    }
    if (u.hostname.includes('youtube.com')) {
      if (u.pathname.startsWith('/watch')) return u.searchParams.get('v');
      if (u.pathname.startsWith('/embed/')) return u.pathname.split('/embed/')[1]?.split('/')[0] || null;
      if (u.pathname.startsWith('/v/')) return u.pathname.split('/v/')[1]?.split('/')[0] || null;
    }
  } catch (_) {}

  const m = String(url).match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

function extractVimeoID(url) {
  if (!url) return null;
  const m = url.trim().match(/vimeo\.com\/(?:.*\/)?(\d+)/);
  return m ? m[1] : null;
}

function extractGoogleDriveID(url) {
  if (!url) return null;
  const m = url.match(/\/file\/d\/([^\/\?]+)/);
  return m ? m[1] : null;
}
