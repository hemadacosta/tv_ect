// script.js (v14) — Modo Anti-Propaganda com Fallback Automático + UI/UX Intacta
// DESKTOP: Botões aparecem apenas no hover
// MOBILE/TABLET: Botões aparecem apenas ao tocar na tela
// YOUTUBE: Tenta Invidious/Piped (sem anúncios) → Se falhar, volta para YouTube oficial automaticamente

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
let ytFallbackTimer = null;
let ytAdFreeAttempt = 0;

// ====== CONFIGURAÇÃO ANTI-PROPAGANDA ======
const YT_AD_FREE_ENABLED = true; // true = tenta instâncias sem anúncios | false = YouTube oficial direto
const YT_AD_FREE_INSTANCES = [
  "https://invidious.fdn.fr",
  "https://iv.ggtyler.dev",
  "https://piped.video",
  "https://invidious.lunar.icu"
];

// ====== DETECÇÃO DE DISPOSITIVO ======
function detectDevice() {
  isTouchDevice = window.matchMedia("(pointer: coarse)").matches ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
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
  if (navVisible) hideNav();
  else showNav(5000);
}

// ====== EVENTOS DESKTOP (HOVER) ======
if (videoWrapper && !isTouchDevice) {
  videoWrapper.addEventListener('mouseenter', () => showNav(3000));
  videoWrapper.addEventListener('mouseleave', () => hideNav());
  videoWrapper.addEventListener('mousemove', () => {
    if (!navVisible) showNav(3000);
    else {
      clearTimeout(navTimeout);
      navTimeout = setTimeout(hideNav, 3000);
    }
  });
  videoWrapper.addEventListener('focusin', () => showNav(5000));
}

// ====== EVENTOS MOBILE/TOUCH (Navegação UI) ======
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
    if (Math.abs(touchX - touchStartX) > 10 || Math.abs(touchY - touchStartY) > 10) {
      isSwipe = true;
    }
  }, { passive: true });

  videoWrapper.addEventListener('touchend', (e) => {
    const touchDuration = new Date().getTime() - touchStartTime;
    if (!isSwipe && touchDuration < 300) toggleNav();
  }, { passive: true });
}

// ====== Autoplay Silencioso ======
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
    if (title && title.includes('<') && title.includes('>')) t.innerHTML = title;
    else t.innerText = title || '';
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
    if (isTouchDevice) showNav(5000);
  };
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
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0) {
        playNextManual();
        showNav(3000);
      } else {
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

  switch(type) {
    case 'youtube': loadYouTube(videoData.url, autoplayEnabled); break;
    case 'vimeo': loadVimeo(videoData.url, autoplayEnabled); break;
    case 'dailymotion': loadDailymotion(videoData.url, autoplayEnabled); break;
    case 'googledrive': loadGoogleDrive(videoData.url); break;
    default:
      console.error("Tipo não suportado:", type, videoData);
      updateInfo(videoData.title || "Vídeo", "Tipo de vídeo não suportado.");
  }
}

// ====== LIMPEZA DE PLAYERS ======
function clearPlayerContainer() {
  if (ytFallbackTimer) {
    clearTimeout(ytFallbackTimer);
    ytFallbackTimer = null;
  }
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
  const m = u.match(/youtu\.be\/([^/?&]+)/) ||
            u.match(/[?&]v=([^/?&]+)/) ||
            u.match(/youtube\.com\/embed\/([^/?&]+)/) ||
            u.match(/youtube\.com\/shorts\/([^/?&]+)/);
  return m ? m[1] : null;
}

function ensureYouTubeAPIReady(cb) {
  if (typeof YT !== 'undefined' && YT.Player) return cb();
  setTimeout(() => ensureYouTubeAPIReady(cb), 300);
}

function fallbackToOfficialYouTube(videoId, allowAutoplay) {
  console.log("⚠️ Instância ad-free instável. Alternando para YouTube oficial...");
  updateInfo(document.getElementById('video-title')?.innerText || "Vídeo", "Carregando via YouTube oficial...");
  
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
    
    ytPlayer = new YT.Player('player', {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: { autoplay: allowAutoplay ? 1 : 0, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: (ev) => {
          try { ev.target.setVolume(currentVolume); } catch (_) {}
          enforceMutedAutoplay();
          if (allowAutoplay) try { ev.target.playVideo(); } catch (_) {}
        },
        onStateChange: (ev) => {
          if (ev.data === YT.PlayerState.ENDED) {
            setTimeout(() => { manualControl = false; playNext(true); }, 800);
          }
        }
      }
    });
  });
}

function loadYouTube(url, allowAutoplay) {
  const videoId = extractYouTubeID(url);
  if (!videoId) {
    console.error("ID YouTube não encontrado:", url);
    updateInfo("Erro no YouTube", "Não encontrei o ID do vídeo.");
    return;
  }

  // ====== MODO SEM PROPAGANDA (COM FALLBACK) ======
  if (YT_AD_FREE_ENABLED) {
    clearPlayerContainer();
    const container = document.getElementById('player');
    const instance = YT_AD_FREE_INSTANCES[ytAdFreeAttempt % YT_AD_FREE_INSTANCES.length];
    const embedUrl = `${instance}/embed/${videoId}?autoplay=${allowAutoplay ? 1 : 0}&mute=1&controls=1&local=true`;
    
    const iframe = document.createElement('iframe');
    iframe.id = "yt-adfree-player";
    iframe.src = embedUrl;
    iframe.width = "100%";
    iframe.height = "100%";
    iframe.frameBorder = "0";
    iframe.allow = "autoplay; fullscreen; picture-in-picture";
    iframe.allowFullscreen = true;
    iframe.style = "position:absolute;top:0;left:0;border:none;";
    
    let endedDetected = false;
    let fallbackTriggered = false;

    // Timeout de segurança: se não carregar em 3.5s, vai para o oficial
    ytFallbackTimer = setTimeout(() => {
      if (!endedDetected && !fallbackTriggered) {
        fallbackTriggered = true;
        ytAdFreeAttempt++;
        fallbackToOfficialYouTube(videoId, allowAutoplay);
      }
    }, 3500);

    const handleInvidiousMessage = (e) => {
      if ((e.origin.includes('invidious') || e.origin.includes('piped')) && e.data && e.data.event === 'ended' && !endedDetected) {
        endedDetected = true;
        clearTimeout(ytFallbackTimer);
        window.removeEventListener('message', handleInvidiousMessage);
        setTimeout(() => { manualControl = false; playNext(true); }, 800);
      }
    };
    window.addEventListener('message', handleInvidiousMessage);

    iframe.onload = () => {
      clearTimeout(ytFallbackTimer);
      updateInfo(document.getElementById('video-title')?.innerText || "Vídeo", "Reproduzindo (modo sem propagandas)");
    };

    container.appendChild(iframe);
    return;
  }

  // ====== MODO OFICIAL YOUTUBE (DIRETO) ======
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
      playerVars: { autoplay: allowAutoplay ? 1 : 0, controls: 1, rel: 0, modestbranding: 1, playsinline: 1 },
      events: {
        onReady: (ev) => {
          try { ev.target.setVolume(currentVolume); } catch (_) {}
          enforceMutedAutoplay();
          if (allowAutoplay) try { ev.target.playVideo(); } catch (_) {}
        },
        onStateChange: (ev) => {
          if (ev.data === YT.PlayerState.ENDED) {
            setTimeout(() => { manualControl = false; playNext(true); }, 800);
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
  script.onload = () => { vimeoAPILoaded = true; callback(); };
  script.onerror = () => updateInfo("Erro", "Não foi possível carregar o player do Vimeo.");
  document.head.appendChild(script);
}

function extractVimeoID(url) {
  if (!url) return null;
  const u = String(url).trim();
  const patterns = [/vimeo\.com\/(?:video\/)?(\d+)(?:[?/]|$)/, /vimeo\.com\/channels\/[^/]+\/(\d+)/, /player\.vimeo\.com\/video\/(\d+)/];
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
      if (!isTouchDevice && currentVolume > 0) vimeoPlayer.setMuted(false);
      if (allowAutoplay) {
        vimeoPlayer.play().catch((err) => {
          console.warn("Autoplay bloqueado no Vimeo:", err);
          if (isTouchDevice) updateInfo(document.getElementById('video-title')?.innerText || "Vídeo", "Toque na tela para iniciar o vídeo");
        });
      }
    });

    vimeoPlayer.on('ended', () => {
      setTimeout(() => { manualControl = false; playNext(true); }, 800);
    });

    if (isTouchDevice) {
      let lastTime = 0;
      let stuckCount = 0;
      const checkProgress = setInterval(() => {
        vimeoPlayer.getCurrentTime().then(time => {
          vimeoPlayer.getDuration().then(duration => {
            if (duration > 0 && time > 0 && (duration - time) < 2) {
              clearInterval(checkProgress);
              setTimeout(() => { manualControl = false; playNext(true); }, 1000);
            }
            if (time === lastTime && time > 0) {
              stuckCount++;
              if (stuckCount > 3) clearInterval(checkProgress);
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
  const patterns = [/dailymotion\.com\/video\/([a-zA-Z0-9]+)/, /dai\.ly\/([a-zA-Z0-9]+)/, /geo\.dailymotion\.com\/player\.html\?video=([a-zA-Z0-9]+)/];
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
  clearPlayerContainer();
  const container = document.getElementById('player');
  const autoplayParam = allowAutoplay ? 'autoplay=1' : 'autoplay=0';
  const embedUrl = `https://www.dailymotion.com/embed/video/${videoId}?${autoplayParam}&mute=1&controls=1&ui-logo=0&sharing-enable=0`;
  
  container.innerHTML = `<iframe id="dailymotion-player" src="${embedUrl}" width="100%" height="100%" frameborder="0" allowfullscreen allow="autoplay; fullscreen; picture-in-picture" style="border: none; width: 100%; height: 100%; position: absolute; top: 0; left: 0;"></iframe>`;
  dailymotionPlayer = document.getElementById('dailymotion-player');
  updateInfo(document.getElementById('video-title')?.innerText || "Vídeo", isTouchDevice ? "Dailymotion: toque para iniciar" : "Dailymotion: reproduzindo");
}

// ====== GOOGLE DRIVE ======
function extractDriveFileId(url) {
  if (!url) return null;
  const u = String(url);
  const m1 = u.match(/\/file\/d\/([^/]+)\//);
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
  
  container.innerHTML = `<video id="drive-video" width="100%" height="100%" playsinline ${autoplayEnabled ? `autoplay` : ``} muted controls style="background:#000; width:100%; height:100%; object-fit:contain;"><source src="${directUrl}" type="video/mp4">Seu navegador não suporta vídeo HTML5.</video>`;
  
  const vid = document.getElementById('drive-video');
  if (!vid) return;
  try { vid.volume = Math.max(0, Math.min(1, currentVolume / 100)); } catch(_) {}
  vid.muted = true;
  
  vid.addEventListener('ended', () => {
    setTimeout(() => { manualControl = false; playNext(true); }, 800);
  });
  
  vid.addEventListener('error', () => {
    container.innerHTML = `<iframe src="https://drive.google.com/file/d/${fileId}/preview" width="100%" height="100%" allow="autoplay" allowfullscreen style="border:0;"></iframe>`;
    updateInfo(document.getElementById('video-title')?.innerText || "Vídeo", "Drive: este vídeo pode exigir clique no play (limitação do Drive).");
  });
  
  updateInfo(document.getElementById('video-title')?.innerText || "Vídeo", autoplayEnabled ? "Drive: iniciando (silencioso). Ajuste o volume para ativar som." : "Drive: pronto. Clique em play para iniciar.");
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
