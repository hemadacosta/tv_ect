
// script.js (v12) — Botões condicionais por dispositivo + Otimizado para Mobile
// DESKTOP: Botões aparecem apenas no hover
// MOBILE/TABLET: Botões aparecem apenas ao tocar na tela

let currentIndex = 0;
let ytPlayer = null;
let vimeoPlayer = null;
let dailymotionPlayer = null;
let currentType = null;
let currentVolume = 100;
let autoplayEnabled = true;
let manualControl = false;
let vimeoAPILoaded = false;
let isMobile = false;
let isTouchDevice = false;
let navVisible = false;
let navTimeout = null;

// ====== DETECÇÃO DE DISPOSITIVO ======
function detectDevice() {
  // Detecta touch (mobile/tablet)
  isTouchDevice = window.matchMedia("(pointer: coarse)").matches || 
                  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Detecta mobile específico (não tablet)
  isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) &&
             !/iPad/i.test(navigator.userAgent);

  console.log("Device detectado:", isTouchDevice ? "Touch" : "Desktop", 
              isMobile ? "(Mobile)" : "(Desktop/Tablet)");

  return { isTouchDevice, isMobile };
}

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

// ====== CONTROLE DE VISIBILIDADE DOS BOTÕES ======
const navControls = document.getElementById('nav-controls');
const videoWrapper = document.getElementById('video-wrapper');

function showNav(duration = 3000) {
  if (!navControls) return;
  navVisible = true;
  navControls.classList.add('show');
  navControls.style.opacity = '1';
  navControls.style.pointerEvents = 'auto';

  // Auto-esconder após duração (exceto se for desktop com mouse sobre)
  clearTimeout(navTimeout);
  if (!isTouchDevice) {
    navTimeout = setTimeout(hideNav, duration);
  }
}

function hideNav() {
  if (!navControls || !navVisible) return;
  navVisible = false;
  navControls.classList.remove('show');
  navControls.style.opacity = '0';
  navControls.style.pointerEvents = 'none';
}

function toggleNav() {
  if (navVisible) {
    hideNav();
  } else {
    showNav(5000); // 5 segundos em mobile
  }
}

// ====== EVENTOS DESKTOP (HOVER) ======
if (videoWrapper && !isTouchDevice) {
  // Mouse entra: mostra
  videoWrapper.addEventListener('mouseenter', () => {
    showNav(3000);
  });

  // Mouse sai: esconde
  videoWrapper.addEventListener('mouseleave', () => {
    hideNav();
  });

  // Mouse move: reseta timer
  videoWrapper.addEventListener('mousemove', () => {
    if (!navVisible) {
      showNav(3000);
    } else {
      // Reseta o timer
      clearTimeout(navTimeout);
      navTimeout = setTimeout(hideNav, 3000);
    }
  });

  // Teclado (acessibilidade)
  videoWrapper.addEventListener('focusin', () => showNav(5000));
}

// ====== EVENTOS MOBILE/TOUCH ======
if (videoWrapper && isTouchDevice) {
  let touchStartTime = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let isSwipe = false;

  videoWrapper.addEventListener('touchstart', (e) => {
    touchStartTime = new Date().getTime();
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    isSwipe = false;
  }, { passive: true });

  videoWrapper.addEventListener('touchmove', (e) => {
    const touchX = e.touches[0].clientX;
    const touchY = e.touches[0].clientY;
    const deltaX = Math.abs(touchX - touchStartX);
    const deltaY = Math.abs(touchY - touchStartY);

    // Se moveu mais de 10px, considera swipe
    if (deltaX > 10 || deltaY > 10) {
      isSwipe = true;
    }
  }, { passive: true });

  videoWrapper.addEventListener('touchend', (e) => {
    const touchEndTime = new Date().getTime();
    const touchDuration = touchEndTime - touchStartTime;

    // Se foi um toque rápido (não swipe) e curto, toggle nav
    if (!isSwipe && touchDuration < 300) {
      toggleNav();
    }
  }, { passive: true });

  // Também permite mostrar ao clicar nos botões (mesmo que invisíveis)
  // Isso garante que se o usuário tocar onde os botões deveriam estar, funcionam
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

function updateInfo(title, status) {
  const t = document.getElementById('video-title');
  const s = document.getElementById('status-text');

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

    // Em mobile, mantém visível por mais tempo após uso
    if (isTouchDevice) {
      showNav(5000);
    }
  };

  // Múltiplos eventos para garantir compatibilidade
  btn.addEventListener('touchstart', handler, { passive: false, capture: true });
  btn.addEventListener('click', handler, { capture: true });
  btn.addEventListener('pointerdown', handler, { capture: true });
}

bindNavButton(btnPrev, playPrevious);
bindNavButton(btnNext, playNextManual);

// ====== GESTOS DE SWIPE PARA MOBILE ======
if (videoWrapper && isTouchDevice) {
  let touchStartX = 0;
  let touchEndX = 0;
  let touchStartY = 0;
  let touchEndY = 0;

  videoWrapper.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
    touchStartY = e.changedTouches[0].screenY;
  }, { passive: true });

  videoWrapper.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    touchEndY = e.changedTouches[0].screenY;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;

    // Só processa se for swipe horizontal significativo
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        // Swipe esquerda = Próximo
        console.log("Swipe left - Próximo vídeo");
        playNextManual();
        showNav(3000);
      } else {
        // Swipe direita = Anterior
        console.log("Swipe right - Vídeo anterior");
        playPrevious();
        showNav(3000);
      }
    }
  }
}

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

    const playerConfig = {
      id: Number(videoId),
      autoplay: !!allowAutoplay,
      muted: true,
      playsinline: 1,
      title: false,
      byline: false,
      portrait: false,
      controls: true
    };

    vimeoPlayer = new Vimeo.Player('vimeo-player', playerConfig);

    vimeoPlayer.ready().then(() => {
      applyVolumeToPlayer();

      if (!isTouchDevice && currentVolume > 0) {
        vimeoPlayer.setMuted(false);
      }

      if (allowAutoplay) {
        vimeoPlayer.play().catch((err) => {
          console.warn("Autoplay bloqueado no Vimeo:", err);
          if (isTouchDevice) {
            updateInfo(
              document.getElementById('video-title')?.innerText || "Vídeo",
              "Toque na tela para iniciar o vídeo"
            );
          }
        });
      }
    });

    vimeoPlayer.on('ended', () => {
      console.log("Vimeo: vídeo terminou");
      setTimeout(() => {
        manualControl = false;
        playNext(true);
      }, 800);
    });

    // Fallback para mobile
    if (isTouchDevice) {
      let lastTime = 0;
      let stuckCount = 0;

      const checkProgress = setInterval(() => {
        vimeoPlayer.getCurrentTime().then(time => {
          vimeoPlayer.getDuration().then(duration => {
            if (duration > 0 && time > 0 && (duration - time) < 2) {
              console.log("Vimeo: detectado fim do vídeo (mobile fallback)");
              clearInterval(checkProgress);
              setTimeout(() => {
                manualControl = false;
                playNext(true);
              }, 1000);
            }

            if (time === lastTime && time > 0) {
              stuckCount++;
              if (stuckCount > 3) {
                console.log("Vimeo: vídeo possivelmente terminado (stuck)");
                clearInterval(checkProgress);
              }
            } else {
              stuckCount = 0;
            }
            lastTime = time;
          });
        }).catch(() => {});
      }, 2000);

      window._vimeoCheckInterval = checkProgress;
    }

    vimeoPlayer.on('error', (err) => {
      console.error("Erro no Vimeo:", err);
      updateInfo("Erro no Vimeo", "Não foi possível reproduzir o vídeo");
    });
  });
}

// ====== DAILYMOTION ======
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
  const muteParam = 'mute=1';
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
    isTouchDevice ? "Dailymotion: toque para iniciar" : "Dailymotion: reproduzindo"
  );
}

// ====== GOOGLE DRIVE ======
function extractDriveFileId(url) {
  if (!url) return null;
  const u = String(url);

  // Formato: /file/d/{fileId}/view  ou  /file/d/{fileId}/preview
  const m1 = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];

  // Formato: ?id={fileId}  (links diretos antigos)
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
    updateInfo("Erro no Drive", "Não encontrei o ID do arquivo. Verifique a URL.");
    return;
  }

  console.log("Carregando vídeo Google Drive, fileId:", fileId);

  clearPlayerContainer();
  const container = document.getElementById('player');

  // O Google Drive só suporta embed via iframe /preview.
  // A abordagem com <video src="uc?export=download"> falha por CORS,
  // redirecionamentos de aviso antivírus e ausência de suporte a range requests.
  const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;

  container.innerHTML = `
    <iframe
      id="drive-player"
      src="${previewUrl}"
      width="100%"
      height="100%"
      frameborder="0"
      allow="autoplay; fullscreen"
      allowfullscreen
      style="border:0; width:100%; height:100%; position:absolute; top:0; left:0;"
    ></iframe>
  `;

  // Nota: iframes cross-origin do Drive não disparam eventos 'ended'.
  // O avanço automático não é possível via JS puro — o usuário pode
  // avançar manualmente com o botão "próximo" ou swipe.

  const statusMsg = isTouchDevice
    ? "Drive: toque em ▶ no player para iniciar o vídeo."
    : "Drive: clique em ▶ no player para iniciar. Use o botão → para avançar.";

  updateInfo(
    document.getElementById('video-title')?.innerText || "Vídeo",
    statusMsg
  );
}

// ====== Inicialização ======
(function init() {
  detectDevice();
  setVolumeUI(currentVolume);

  const sch = safeSchedule();
  if (sch.length === 0) {
    updateInfo("Nenhum vídeo na programação.", "Aguarde, iniciando o fluxo...");
    return;
  }
  manualControl = false;
  loadVideo(0, false);
})();
