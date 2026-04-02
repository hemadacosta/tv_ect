// script.js (v10) — navegação confiável (YouTube/Vimeo/Dailymotion) + HTML no título
// SUPORTA: YouTube, Vimeo, Dailymotion
// NOVO: Suporte a HTML no title (links, formatação, etc.)

let currentIndex = 0;
let ytPlayer = null;
let vimeoPlayer = null;
let dailymotionPlayer = null;
let currentType = null;
let currentVolume = 100;
let autoplayEnabled = true;
let manualControl = false;
let vimeoAPILoaded = false;

// ====== Controles de volume ======
const volumeSlider = document.getElementById('volume-slider');
const volumeValue  = document.getElementById('volume-value');

function setVolumeUI(vol) {
  currentVolume = Math.max(0, Math.min(100, Number(vol) || 0));
  if (volumeValue) volumeValue.textContent = `${currentVolume}%`;
  if (volumeSlider) volumeSlider.value = String(currentVolume);
}

function applyVolumeToPlayer() {
  try {
    if (currentType === 'youtube' && ytPlayer && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(currentVolume);
    } else if (currentType === 'vimeo' && vimeoPlayer && typeof vimeoPlayer.setVolume === 'function') {
      vimeoPlayer.setVolume(currentVolume / 100);
    }
  } catch (e) {
    console.warn("Falha ao aplicar volume:", e);
  }
}

if (volumeSlider) {
  volumeSlider.addEventListener('input', () => {
    setVolumeUI(volumeSlider.value);
    applyVolumeToPlayer();
    maybeUnmuteIfUserChangedVolume();
  }, { passive: true });
}

// ====== UI: Controles discretos ======
const navControls = document.getElementById('nav-controls');
const videoWrapper = document.getElementById('video-wrapper');

let hideTimer = null;
function showNavTemporarily(ms = 2500) {
  if (!navControls) return;
  navControls.classList.add('show');
  if (hideTimer) clearTimeout(hideTimer);
  hideTimer = setTimeout(() => navControls.classList.remove('show'), ms);
}

if (videoWrapper) {
  videoWrapper.addEventListener('pointerdown', () => showNavTemporarily(2500), { passive: true });
  videoWrapper.addEventListener('focusin', () => showNavTemporarily(4000));
}

let autoplayMuted = true;

function enforceMutedAutoplay() {
  try {
    if (currentType === 'youtube' && ytPlayer && typeof ytPlayer.mute === 'function' && autoplayMuted) {
      ytPlayer.mute();
    }
  } catch (_) {}
}

function maybeUnmuteIfUserChangedVolume() {
  try {
    if (currentVolume > 0) {
      if (ytPlayer && typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
      if (vimeoPlayer && typeof vimeoPlayer.setMuted === 'function') vimeoPlayer.setMuted(false);
    }
  } catch (_) {}
}

// ====== Programação ======
function safeSchedule() {
  if (typeof schedule === 'undefined' || !Array.isArray(schedule) || schedule.length === 0) return [];
  return schedule;
}

// NOVO: Atualiza info com suporte a HTML no título
function updateInfo(title, status) {
  const t = document.getElementById('video-title');
  const s = document.getElementById('status-text');

  // Se o título contiver HTML (tags < >), usa innerHTML
  // Caso contrário, usa innerText para segurança
  if (t) {
    if (title && (title.includes('<') && title.includes('>'))) {
      t.innerHTML = title;
    } else {
      t.innerText = title || '';
    }
  }

  if (s) s.innerText = status || '';
}

// ====== Navegação ======
let _advanceLock = false;

function playNextManual() {
  manualControl = true;
  playNext(false);
}

function playNext(fromAuto = false) {
  if (_advanceLock) return;
  if (fromAuto) _advanceLock = true;

  const sch = safeSchedule();
  if (sch.length === 0) {
    updateInfo("Nenhum vídeo na programação.", "Verifique o config.js.");
    _advanceLock = false;
    return;
  }
  currentIndex = (currentIndex + 1) % sch.length;
  loadVideo(currentIndex, !fromAuto);

  if (fromAuto) setTimeout(() => { _advanceLock = false; }, 1200);
}

function playPrevious() {
  const sch = safeSchedule();
  if (sch.length === 0) {
    updateInfo("Nenhum vídeo na programação.", "Verifique o config.js.");
    return;
  }
  currentIndex = (currentIndex - 1 + sch.length) % sch.length;
  loadVideo(currentIndex, true);
}

window.playNextManual = playNextManual;
window.playNext = playNext;
window.playPrevious = playPrevious;

let _lastNavClickAt = 0;
function _navGuard() {
  const now = Date.now();
  if (now - _lastNavClickAt < 350) return false;
  _lastNavClickAt = now;
  return true;
}

const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
function bindNavButton(btn, fn) {
  if (!btn) return;
  const handler = (ev) => {
    if (!_navGuard()) return;
    ev.preventDefault();
    ev.stopPropagation();
    fn();
    showNavTemporarily(2000);
  };
  btn.addEventListener('pointerdown', handler, { capture: true });
  btn.addEventListener('click', handler, { capture: true });
}
bindNavButton(btnPrev, playPrevious);
bindNavButton(btnNext, playNextManual);

// ====== Carregamento do vídeo ======
function loadVideo(index, fromUser = false) {
  const sch = safeSchedule();
  if (sch.length === 0) {
    updateInfo("Nenhum vídeo na programação.", "Aguarde, iniciando o fluxo...");
    return;
  }

  const videoData = sch[index];
  if (!videoData || !videoData.url) {
    updateInfo("Vídeo inválido na programação.", `Item ${index + 1} sem URL.`);
    return;
  }

  manualControl = !!fromUser;
  updateInfo(videoData.title || "Vídeo", `Vídeo ${index + 1} de ${sch.length}`);

  // Detecta tipo automaticamente
  let type = videoData.type;
  if (!type) {
    const u = String(videoData.url).toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be')) type = 'youtube';
    else if (u.includes('vimeo.com')) type = 'vimeo';
    else if (u.includes('dailymotion.com') || u.includes('dai.ly')) type = 'dailymotion';
    else if (u.includes('drive.google.com')) type = 'googledrive';
  }
  currentType = type;

  if (videoData.embedHtml) {
    const container = document.getElementById('player');
    if (container) container.innerHTML = videoData.embedHtml;
    return;
  }

  // Carrega conforme tipo
  switch(type) {
    case 'youtube':
      loadYouTube(videoData.url, autoplayEnabled);
      break;
    case 'vimeo':
      loadVimeo(videoData.url, autoplayEnabled);
      break;
    case 'dailymotion':
      loadDailymotion(videoData.url, autoplayEnabled);
      break;
    case 'googledrive':
      loadGoogleDrive(videoData.url);
      break;
    default:
      console.error("Tipo não suportado:", type, videoData);
      updateInfo(videoData.title || "Vídeo", "Tipo de vídeo não suportado.");
  }
}

// ====== LIMPEZA DE PLAYERS ======
function clearPlayerContainer() {
  const container = document.getElementById('player');
  if (!container) return;

  if (ytPlayer) {
    try { ytPlayer.destroy(); } catch (e) { console.warn("Erro ao destruir YouTube:", e); }
    ytPlayer = null;
  }

  if (vimeoPlayer) {
    try { vimeoPlayer.destroy(); } catch (e) { console.warn("Erro ao destruir Vimeo:", e); }
    vimeoPlayer = null;
  }

  dailymotionPlayer = null;
  container.innerHTML = '';
}

// ====== YOUTUBE ======
function extractYouTubeID(url) {
  if (!url) return null;
  const u = String(url).trim();
  try {
    const parsed = new URL(u, window.location.href);
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) return id;
    }
    const v = parsed.searchParams.get('v');
    if (v) return v;
    const parts = parsed.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    const shortsIdx = parts.indexOf('shorts');
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
  } catch (_) {}

  const m = u.match(/youtu\.be\/([^\/\?\&]+)/) ||
            u.match(/[?&]v=([^\/\?\&]+)/) ||
            u.match(/youtube\.com\/embed\/([^\/\?\&]+)/) ||
            u.match(/youtube\.com\/shorts\/([^\/\?\&]+)/);
  return m ? m[1] : null;
}

function ensureYouTubeAPIReady(cb) {
  if (typeof YT !== 'undefined' && YT.Player) return cb();
  setTimeout(() => ensureYouTubeAPIReady(cb), 300);
}

function loadYouTube(url, allowAutoplay) {
  const videoId = extractYouTubeID(url);
  if (!videoId) {
    console.error("ID YouTube não encontrado:", url);
    updateInfo("Erro no YouTube", "Não encontrei o ID do vídeo.");
    return;
  }

  ensureYouTubeAPIReady(() => {
    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      try {
        ytPlayer.loadVideoById(videoId);
        applyVolumeToPlayer();
        maybeUnmuteIfUserChangedVolume();
        if (!allowAutoplay && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
        return;
      } catch (e) {
        console.warn("Falha no loadVideoById; recriando player...", e);
        clearPlayerContainer();
      }
    }

    if (vimeoPlayer) clearPlayerContainer();

    ytPlayer = new YT.Player('player', {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: {
        autoplay: allowAutoplay ? 1 : 0,
        controls: 1,
        rel: 0,
        modestbranding: 1,
        playsinline: 1
      },
      events: {
        onReady: (ev) => {
          try { ev.target.setVolume(currentVolume); } catch (_) {}
          enforceMutedAutoplay();
          if (allowAutoplay) {
            try { ev.target.playVideo(); } catch (_) {}
          }
        },
        onStateChange: (ev) => {
          if (ev.data === YT.PlayerState.ENDED) {
            setTimeout(() => {
              manualControl = false;
              playNext(true);
            }, 800);
          }
        }
      }
    });
  });
}

// ====== VIMEO ======
function loadVimeoAPI(callback) {
  if (typeof Vimeo !== 'undefined' && Vimeo.Player) {
    vimeoAPILoaded = true;
    callback();
    return;
  }

  if (document.querySelector('script[src*="player.vimeo.com/api/player.js"]')) {
    const checkInterval = setInterval(() => {
      if (typeof Vimeo !== 'undefined' && Vimeo.Player) {
        vimeoAPILoaded = true;
        clearInterval(checkInterval);
        callback();
      }
    }, 100);
    return;
  }

  const script = document.createElement('script');
  script.src = 'https://player.vimeo.com/api/player.js';
  script.async = true;
  script.onload = () => {
    vimeoAPILoaded = true;
    callback();
  };
  script.onerror = () => {
    updateInfo("Erro", "Não foi possível carregar o player do Vimeo.");
  };
  document.head.appendChild(script);
}

function extractVimeoID(url) {
  if (!url) return null;
  const u = String(url).trim();
  const patterns = [
    /vimeo\.com\/(?:video\/)?(\d+)(?:[?\/]|$)/,
    /vimeo\.com\/channels\/[^\/]+\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];

  for (const pattern of patterns) {
    const m = u.match(pattern);
    if (m) return m[1];
  }
  return null;
}

function loadVimeo(url, allowAutoplay) {
  const videoId = extractVimeoID(url);
  if (!videoId) {
    console.error("ID Vimeo não encontrado:", url);
    updateInfo("Erro no Vimeo", "Não encontrei o ID do vídeo.");
    return;
  }

  loadVimeoAPI(() => {
    clearPlayerContainer();

    const container = document.getElementById('player');
    const vimeoDiv = document.createElement('div');
    vimeoDiv.id = 'vimeo-player';
    container.appendChild(vimeoDiv);

    vimeoPlayer = new Vimeo.Player('vimeo-player', {
      id: Number(videoId),
      autoplay: !!allowAutoplay,
      muted: autoplayMuted,
      title: false,
      byline: false,
      portrait: false,
      controls: true
    });

    vimeoPlayer.ready().then(() => {
      applyVolumeToPlayer();
      maybeUnmuteIfUserChangedVolume();
      if (allowAutoplay) {
        vimeoPlayer.play().catch((err) => {
          console.warn("Autoplay bloqueado:", err);
        });
      }
    });

    vimeoPlayer.on('ended', () => {
      setTimeout(() => {
        manualControl = false;
        playNext(true);
      }, 800);
    });

    vimeoPlayer.on('error', (err) => {
      console.error("Erro no Vimeo:", err);
      updateInfo("Erro no Vimeo", "Não foi possível reproduzir o vídeo");
    });
  });
}

// ====== DAILYMOTION (Iframe Embed) ======
function extractDailymotionID(url) {
  if (!url) return null;
  const u = String(url).trim();

  const patterns = [
    /dailymotion\.com\/video\/([a-zA-Z0-9]+)/,
    /dai\.ly\/([a-zA-Z0-9]+)/,
    /geo\.dailymotion\.com\/player\.html\?video=([a-zA-Z0-9]+)/
  ];

  for (const pattern of patterns) {
    const m = u.match(pattern);
    if (m) return m[1];
  }

  return null;
}

function loadDailymotion(url, allowAutoplay) {
  const videoId = extractDailymotionID(url);
  if (!videoId) {
    console.error("ID Dailymotion não encontrado:", url);
    updateInfo("Erro no Dailymotion", "Não encontrei o ID do vídeo. Verifique a URL.");
    return;
  }

  console.log("Carregando vídeo Dailymotion:", videoId);

  clearPlayerContainer();

  const container = document.getElementById('player');

  const autoplayParam = allowAutoplay ? 'autoplay=1' : 'autoplay=0';
  const muteParam = autoplayMuted ? 'mute=1' : 'mute=0';
  const embedUrl = `https://www.dailymotion.com/embed/video/${videoId}?${autoplayParam}&${muteParam}&controls=1&ui-logo=0&sharing-enable=0`;

  container.innerHTML = `
    <iframe 
      id="dailymotion-player"
      src="${embedUrl}" 
      width="100%" 
      height="100%"
      frameborder="0" 
      allowfullscreen
      allow="autoplay; fullscreen; picture-in-picture"
      style="border: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0;"
    ></iframe>
  `;

  dailymotionPlayer = document.getElementById('dailymotion-player');

  updateInfo(
    document.getElementById('video-title')?.innerText || "Vídeo",
    "Dailymotion: reproduzindo (use os botões para navegar)"
  );

  console.log("Dailymotion embed carregado:", embedUrl);
}

// ====== GOOGLE DRIVE ======
function extractDriveFileId(url) {
  if (!url) return null;
  const u = String(url);
  const m1 = u.match(/\/file\/d\/([^\/]+)\//);
  if (m1) return m1[1];
  try {
    const parsed = new URL(u, window.location.href);
    const id = parsed.searchParams.get('id');
    if (id) return id;
  } catch (_) {}
  return null;
}

function loadGoogleDrive(url) {
  const fileId = extractDriveFileId(url);
  if (!fileId) {
    console.error("ID Drive não encontrado:", url);
    updateInfo("Erro no Drive", "Não encontrei o ID do arquivo.");
    return;
  }

  clearPlayerContainer();
  const container = document.getElementById('player');
  const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

  container.innerHTML = `
    <video id="drive-video" width="100%" height="100%" playsinline
      ${autoplayEnabled ? "autoplay" : ""} muted controls
      style="background:#000; width:100%; height:100%; object-fit:contain;"
    >
      <source src="${directUrl}" type="video/mp4">
      Seu navegador não suporta vídeo HTML5.
    </video>
  `;

  const vid = document.getElementById('drive-video');
  if (!vid) return;

  try { vid.volume = Math.max(0, Math.min(1, currentVolume / 100)); } catch(_) {}
  vid.muted = true;

  vid.addEventListener('ended', () => {
    setTimeout(() => {
      manualControl = false;
      playNext(true);
    }, 800);
  });

  vid.addEventListener('error', () => {
    container.innerHTML = `
      <iframe
        src="https://drive.google.com/file/d/${fileId}/preview"
        width="100%" height="100%"
        allow="autoplay"
        allowfullscreen
        style="border:0;"
      ></iframe>
    `;
    updateInfo(
      document.getElementById('video-title')?.innerText || "Vídeo",
      "Drive: este vídeo pode exigir clique no play (limitação do Drive)."
    );
  });

  updateInfo(
    document.getElementById('video-title')?.innerText || "Vídeo",
    autoplayEnabled
      ? "Drive: iniciando (silencioso). Ajuste o volume para ativar som."
      : "Drive: pronto. Clique em play para iniciar."
  );
}

// ====== Inicialização ======
(function init() {
  setVolumeUI(currentVolume);

  const sch = safeSchedule();
  if (sch.length === 0) {
    updateInfo("Nenhum vídeo na programação.", "Aguarde, iniciando o fluxo...");
    return;
  }
  manualControl = false;
  loadVideo(0, false);
})();
