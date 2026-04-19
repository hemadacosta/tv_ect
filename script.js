
// script.js (v14) — Botões condicionais por dispositivo + Otimizado para Mobile
// DESKTOP: Botões aparecem apenas no hover
// MOBILE/TABLET: Botões aparecem apenas ao tocar na tela
// GOOGLE DRIVE: Overlay de início sincroniza o timer com o play real do usuário

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
let driveAutoAdvanceTimer = null; // Timer de avanço automático para vídeos do Drive
let driveCountdownInterval = null; // Intervalo do contador regressivo do Drive

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

// ====== CONTROLES DE VOLUME ======
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
  if (navVisible) {
    hideNav();
  } else {
    showNav(5000);
  }
}

// ====== EVENTOS DESKTOP (HOVER) ======
if (videoWrapper && !isTouchDevice) {
  videoWrapper.addEventListener('mouseenter', () => showNav(3000));
  videoWrapper.addEventListener('mouseleave', () => hideNav());
  videoWrapper.addEventListener('mousemove', () => {
    if (!navVisible) {
      showNav(3000);
    } else {
      clearTimeout(navTimeout);
      navTimeout = setTimeout(hideNav, 3000);
    }
  });
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
    const deltaX = Math.abs(e.touches[0].clientX - touchStartX);
    const deltaY = Math.abs(e.touches[0].clientY - touchStartY);
    if (deltaX > 10 || deltaY > 10) isSwipe = true;
  }, { passive: true });

  videoWrapper.addEventListener('touchend', (e) => {
    const touchDuration = new Date().getTime() - touchStartTime;
    if (!isSwipe && touchDuration < 300) toggleNav();
  }, { passive: true });
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

// ====== PROGRAMAÇÃO ======
function safeSchedule() {
  if (typeof schedule === 'undefined' || !Array.isArray(schedule) || schedule.length === 0) return [];
  return schedule;
}

function updateInfo(title, status) {
  const t = document.getElementById('video-title');
  const s = document.getElementById('status-text');

  if (t) {
    if (title && title.includes('<') && title.includes('>')) {
      t.innerHTML = title;
    } else {
      t.innerText = title || '';
    }
  }

  if (s) s.innerText = status || '';
}

// ====== NAVEGAÇÃO ======
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
        console.log("Swipe left — Próximo vídeo");
        playNextManual();
        showNav(3000);
      } else {
        console.log("Swipe right — Vídeo anterior");
        playPrevious();
        showNav(3000);
      }
    }
  }
}

// ====== CARREGAMENTO DO VÍDEO ======
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

  // Detecta tipo automaticamente pela URL se não informado
  let type = videoData.type;
  if (!type) {
    const u = String(videoData.url).toLowerCase();
    if (u.includes('youtube.com') || u.includes('youtu.be'))        type = 'youtube';
    else if (u.includes('vimeo.com'))                                type = 'vimeo';
    else if (u.includes('dailymotion.com') || u.includes('dai.ly')) type = 'dailymotion';
    else if (u.includes('drive.google.com'))                         type = 'googledrive';
  }
  currentType = type;

  if (videoData.embedHtml) {
    const container = document.getElementById('player');
    if (container) container.innerHTML = videoData.embedHtml;
    return;
  }

  switch (type) {
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
      loadGoogleDrive(videoData.url, videoData.duration);
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

  // Cancela timer e contador regressivo do Drive ao trocar de vídeo
  if (driveAutoAdvanceTimer) {
    clearTimeout(driveAutoAdvanceTimer);
    driveAutoAdvanceTimer = null;
  }
  if (driveCountdownInterval) {
    clearInterval(driveCountdownInterval);
    driveCountdownInterval = null;
  }

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

  const m = u.match(/youtu\.be\/([^\/\?\&]+)/)           ||
            u.match(/[?&]v=([^\/\?\&]+)/)                 ||
            u.match(/youtube\.com\/embed\/([^\/\?\&]+)/)  ||
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

    // Fallback para mobile (detecção por progresso)
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
  const embedUrl = `https://www.dailymotion.com/embed/video/${videoId}?${autoplayParam}&mute=1&controls=1&ui-logo=0&sharing-enable=0`;

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
// O Drive não detecta fim do vídeo via JS (iframe cross-origin).
// Solução: informe "duration" (segundos) no config.js.
// Um botão de sobreposição é exibido sobre o iframe — o timer SÓ inicia
// quando o usuário clica nele, garantindo sincronismo com o play real.
//
// Exemplo no config.js:
// {
//   title: "Contato (1997)",
//   url: "https://drive.google.com/file/d/SEU_ID/view",
//   type: "googledrive",
//   duration: 9360    // 2h36min = 2×3600 + 36×60
// }

function secsToHHMMSS(s) {
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function extractDriveFileId(url) {
  if (!url) return null;
  const u = String(url);

  // Formato: /file/d/{fileId}/view  ou  /file/d/{fileId}/preview
  const m1 = u.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];

  // Formato legado: ?id={fileId}
  try {
    const parsed = new URL(u, window.location.href);
    const id = parsed.searchParams.get('id');
    if (id) return id;
  } catch (_) {}

  return null;
}

function loadGoogleDrive(url, duration) {
  const fileId = extractDriveFileId(url);
  if (!fileId) {
    console.error("ID Drive não encontrado:", url);
    updateInfo("Erro no Drive", "Não encontrei o ID do arquivo. Verifique a URL.");
    return;
  }

  console.log("Carregando vídeo Google Drive, fileId:", fileId);

  clearPlayerContainer();
  const container = document.getElementById('player');
  const previewUrl = `https://drive.google.com/file/d/${fileId}/preview`;
  const durationSec = Math.round(Number(duration));

  if (durationSec > 0) {
    // ── COM duração: exibe iframe + botão de sobreposição ───────────────────
    // O botão fica sobre o iframe. Ao clicar, ele some e o timer começa.
    // Assim o contador parte do momento em que o usuário realmente dá play.
    // ────────────────────────────────────────────────────────────────────────
    const btnLabel = isTouchDevice
      ? `▶  Toque aqui para iniciar\nAvanço automático em ${secsToHHMMSS(durationSec)}`
      : `▶  Clique aqui para iniciar\nAvanço automático em ${secsToHHMMSS(durationSec)}`;

    container.innerHTML = `
      <iframe
        id="drive-player"
        src="${previewUrl}"
        width="100%" height="100%"
        frameborder="0"
        allow="autoplay; fullscreen"
        allowfullscreen
        style="border:0; width:100%; height:100%; position:absolute; top:0; left:0;"
      ></iframe>
      <div id="drive-overlay" style="
        position:absolute; inset:0; z-index:20;
        display:flex; align-items:center; justify-content:center;
        background:rgba(0,0,0,0.6); cursor:pointer;">
        <button id="drive-start-btn" style="
          background:rgba(20,20,20,0.93);
          color:#fff;
          border:2px solid rgba(255,255,255,0.3);
          border-radius:14px;
          padding:20px 36px;
          font-size:clamp(14px,2.4vw,20px);
          font-family:Arial,sans-serif;
          white-space:pre-line;
          text-align:center;
          line-height:1.6;
          cursor:pointer;
          max-width:88%;
          transition:background 0.2s, transform 0.15s;">
          ${btnLabel}
        </button>
      </div>
    `;

    // Efeito visual no hover/focus do botão
    const startBtn = document.getElementById('drive-start-btn');
    startBtn.addEventListener('mouseenter', () => {
      startBtn.style.background = 'rgba(60,60,60,0.97)';
      startBtn.style.transform  = 'scale(1.03)';
    });
    startBtn.addEventListener('mouseleave', () => {
      startBtn.style.background = 'rgba(20,20,20,0.93)';
      startBtn.style.transform  = 'scale(1)';
    });
    startBtn.addEventListener('mousedown',  () => { startBtn.style.transform = 'scale(0.97)'; });

    // Função que inicia o timer — chamada uma única vez ao clicar/tocar
    let timerStarted = false;
    const startDriveTimer = (e) => {
      if (timerStarted) return;
      timerStarted = true;
      if (e && e.stopPropagation) e.stopPropagation();

      const overlay = document.getElementById('drive-overlay');
      if (overlay) overlay.remove();

      console.log(`Drive: timer iniciado — avança em ${secsToHHMMSS(durationSec)}`);

      // Contador regressivo exibido na barra de status (atualiza a cada segundo)
      let remaining = durationSec;
      driveCountdownInterval = setInterval(() => {
        remaining--;
        const statusEl = document.getElementById('status-text');
        if (statusEl) {
          statusEl.innerText = `Drive: reproduzindo — próximo vídeo em ${secsToHHMMSS(remaining)}`;
        }
        if (remaining <= 0) {
          clearInterval(driveCountdownInterval);
          driveCountdownInterval = null;
        }
      }, 1000);

      // Timer principal: avança para o próximo vídeo ao término
      driveAutoAdvanceTimer = setTimeout(() => {
        if (driveCountdownInterval) {
          clearInterval(driveCountdownInterval);
          driveCountdownInterval = null;
        }
        console.log("Drive: duração atingida — avançando automaticamente.");
        manualControl = false;
        playNext(true);
      }, durationSec * 1000);

      updateInfo(
        document.getElementById('video-title')?.innerText || "Vídeo",
        `Drive: reproduzindo — próximo vídeo em ${secsToHHMMSS(durationSec)}`
      );
    };

    startBtn.addEventListener('click',    startDriveTimer, { capture: true });
    startBtn.addEventListener('touchend', startDriveTimer, { passive: true });

    updateInfo(
      document.getElementById('video-title')?.innerText || "Vídeo",
      `Drive: clique no botão para iniciar (duração: ${secsToHHMMSS(durationSec)})`
    );

  } else {
    // ── SEM duração: apenas iframe, avanço manual ───────────────────────────
    container.innerHTML = `
      <iframe
        id="drive-player"
        src="${previewUrl}"
        width="100%" height="100%"
        frameborder="0"
        allow="autoplay; fullscreen"
        allowfullscreen
        style="border:0; width:100%; height:100%; position:absolute; top:0; left:0;"
      ></iframe>
    `;

    updateInfo(
      document.getElementById('video-title')?.innerText || "Vídeo",
      isTouchDevice
        ? "Drive: toque em ▶ no player para iniciar. Use o botão → para avançar."
        : "Drive: clique em ▶ no player para iniciar. Use o botão → para avançar."
    );
  }
}

// ====== INICIALIZAÇÃO ======
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
