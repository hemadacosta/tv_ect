// script.js (v5) — navegação confiável (YouTube/Vimeo) + controles discretos
let currentIndex = 0;
let ytPlayer = null;      // instância YT.Player
let vimeoPlayer = null;   // instância Vimeo.Player
let currentType = null;
let currentVolume = 100;
let autoplayEnabled = true;
let manualControl = false;

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
      // Vimeo usa 0..1
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

// ====== UI: Controles discretos (hover no desktop + toque temporário no mobile) ======
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
  // Touch/click na área do vídeo -> mostra controles por alguns segundos
  videoWrapper.addEventListener('pointerdown', () => showNavTemporarily(2500), { passive: true });
  // Teclado (acessibilidade)
  videoWrapper.addEventListener('focusin', () => showNavTemporarily(4000));
}

let autoplayMuted = true; // necessário para autoplay em muitos navegadores (som exige gesto do usuário)

function enforceMutedAutoplayForYouTube() {
  try {
    if (ytPlayer && typeof ytPlayer.mute === 'function' && autoplayMuted) ytPlayer.mute();
  } catch (_) {}
}
function maybeUnmuteIfUserChangedVolume() {
  // Se a usuária mexer no slider (volume > 0), tentamos liberar som
  try {
    if (currentVolume > 0 && ytPlayer && typeof ytPlayer.unMute === 'function') ytPlayer.unMute();
    if (currentVolume > 0 && vimeoPlayer && typeof vimeoPlayer.setMuted === 'function') vimeoPlayer.setMuted(false);
  } catch (_) {}
}

// ====== Programação ======
function safeSchedule() {
  // schedule vem do config.js (global)
  if (typeof schedule === 'undefined' || !Array.isArray(schedule) || schedule.length === 0) return [];
  return schedule;
}

function updateInfo(title, status) {
  const t = document.getElementById('video-title');
  const s = document.getElementById('status-text');
  if (t) t.innerText = title || '';
  if (s) s.innerText = status || '';
}

// ====== Navegação (expostas no window para onclick do index.html) ======
let _advanceLock = false;  // evita pulo duplo (YouTube às vezes dispara ENDED mais de uma vez)

function playNextManual() {
  manualControl = true;
  playNext(/*fromAuto*/ false);
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
  loadVideo(currentIndex, /*fromUser*/ !fromAuto);

  // libera o lock após iniciar o carregamento
  if (fromAuto) setTimeout(() => { _advanceLock = false; }, 1200);
}

function playPrevious() {
  const sch = safeSchedule();
  if (sch.length === 0) {
    updateInfo("Nenhum vídeo na programação.", "Verifique o config.js.");
    return;
  }
  currentIndex = (currentIndex - 1 + sch.length) % sch.length;
  loadVideo(currentIndex, /*fromUser*/ true);
}

// Garantir que o onclick encontre as funções:
window.playNextManual = playNextManual;
window.playNext = playNext;
window.playPrevious = playPrevious;

// Também adiciona listeners (caso o onclick seja bloqueado por algum motivo)
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
function bindNavButton(btn, fn) {
  if (!btn) return;
  const handler = (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    fn();
    showNavTemporarily(2000);
  };
  // pointerdown costuma ser mais confiável quando há iframes
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

  manualControl = !!fromUser; // se veio do botão, não forçar autoplay imediato antes do load
  updateInfo(videoData.title || "Vídeo", `Vídeo ${index + 1} de ${sch.length}`);

  // Detecta tipo se não estiver definido
  let type = videoData.type;
  if (!type) {
    const u = String(videoData.url);
    if (u.includes('youtube.com') || u.includes('youtu.be')) type = 'youtube';
    else if (u.includes('vimeo.com')) type = 'vimeo';
    else if (u.includes('drive.google.com')) type = 'googledrive';
  }
  currentType = type;

  // Carrega conforme tipo
  if (type === 'youtube') {
    loadYouTube(videoData.url, !fromUser);
  } else if (type === 'vimeo') {
    loadVimeo(videoData.url, !fromUser);
  } else if (type === 'googledrive') {
    loadGoogleDrive(videoData.url);
  } else {
    console.error("Tipo não suportado:", type, videoData);
    updateInfo(videoData.title || "Vídeo", "Tipo de vídeo não suportado.");
  }
}

// ====== YouTube ======
function extractYouTubeID(url) {
  if (!url) return null;
  const u = String(url).trim();

  // 1) tenta URL parsing
  try {
    const parsed = new URL(u, window.location.href);
    // youtu.be/<id>
    if (parsed.hostname.includes('youtu.be')) {
      const id = parsed.pathname.split('/').filter(Boolean)[0];
      if (id) return id;
    }
    // youtube.com/watch?v=<id>
    const v = parsed.searchParams.get('v');
    if (v) return v;
    // /embed/<id> ou /shorts/<id>
    const parts = parsed.pathname.split('/').filter(Boolean);
    const embedIdx = parts.indexOf('embed');
    if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];
    const shortsIdx = parts.indexOf('shorts');
    if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
  } catch (_) {}

  // 2) regex fallback
  const m =
    u.match(/youtu\.be\/([^\/\?\&]+)/) ||
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
    // Se já existe player, REUTILIZA (isso resolve “só o vídeo 1 carrega”)
    if (ytPlayer && typeof ytPlayer.loadVideoById === 'function') {
      try {
        ytPlayer.loadVideoById(videoId);
        applyVolumeToPlayer();
    maybeUnmuteIfUserChangedVolume();
        if (!allowAutoplay && typeof ytPlayer.pauseVideo === 'function') ytPlayer.pauseVideo();
        // Se for controle manual do estudante, esconda controles após clicar
        return;
      } catch (e) {
        console.warn("Falha no loadVideoById; recriando player…", e);
        try { ytPlayer.destroy(); } catch (_) {}
        ytPlayer = null;
      }
    }

    // Cria player se não existe
    ytPlayer = new YT.Player('player', {
      height: '100%',
      width: '100%',
      videoId,
      playerVars: {
        autoplay: allowAutoplay ? 1 : 0,
        controls: 1, // sem barra externa sua, mas permite controle mínimo se o YouTube liberar
        rel: 0,
        modestbranding: 1,
        playsinline: 1
      },
      events: {
        onReady: (ev) => {
          try { ev.target.setVolume(currentVolume); } catch (_) {}
          enforceMutedAutoplayForYouTube();
          if (allowAutoplay) {
            try { ev.target.playVideo(); } catch (_) {}
          }
        },
        onStateChange: (ev) => {
          if (ev.data === YT.PlayerState.ENDED) {
            // Autoavança sempre que o vídeo acabar
            setTimeout(() => {
              manualControl = false;
              playNext(true);
            }, 800);
          }
        }
      }
    });

    // Se estiver vindo de um Vimeo antes, pare Vimeo
    if (vimeoPlayer) {
      try { vimeoPlayer.pause(); } catch (_) {}
    }
  });
}

// ====== Vimeo ======
function extractVimeoID(url) {
  if (!url) return null;
  const u = String(url).trim();
  // Ex: https://vimeo.com/12345678 ou https://player.vimeo.com/video/12345678
  const m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function loadVimeo(url, allowAutoplay) {
  const videoId = extractVimeoID(url);
  if (!videoId) {
    console.error("ID Vimeo não encontrado:", url);
    updateInfo("Erro no Vimeo", "Não encontrei o ID do vídeo.");
    return;
  }

  // Se já existe player, reutiliza
  if (vimeoPlayer && typeof vimeoPlayer.loadVideo === 'function') {
    vimeoPlayer.loadVideo(Number(videoId)).then(() => {
      applyVolumeToPlayer();
    maybeUnmuteIfUserChangedVolume();
      if (allowAutoplay) vimeoPlayer.play().catch(()=>{});
      else vimeoPlayer.pause().catch(()=>{});
    }).catch((e) => {
      console.warn("Falha no loadVideo do Vimeo; recriando player…", e);
      try { vimeoPlayer.destroy(); } catch (_) {}
      vimeoPlayer = null;
      createVimeoPlayer(videoId, allowAutoplay);
    });
    // Pausa YouTube se estiver ativo
    if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
      try { ytPlayer.pauseVideo(); } catch (_) {}
    }
    return;
  }

  createVimeoPlayer(videoId, allowAutoplay);
}

function createVimeoPlayer(videoId, allowAutoplay) {
  const container = document.getElementById('player');
  if (!container) return;
  container.innerHTML = '<div id="vimeo-player"></div>';

  vimeoPlayer = new Vimeo.Player('vimeo-player', {
    id: Number(videoId),
    autoplay: !!allowAutoplay,
    title: false,
    byline: false,
    portrait: false
  });

  vimeoPlayer.ready().then(() => {
    try { if (autoplayMuted && typeof vimeoPlayer.setMuted==='function') vimeoPlayer.setMuted(true); } catch(_) {}
    applyVolumeToPlayer();
    maybeUnmuteIfUserChangedVolume();
    if (allowAutoplay) vimeoPlayer.play().catch(()=>{});
  });

  vimeoPlayer.on('ended', () => {
    setTimeout(() => {
      manualControl = false;
              playNext(true);
    }, 800);
  });

  // Pausa YouTube se estiver ativo
  if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
    try { ytPlayer.pauseVideo(); } catch (_) {}
  }
}

// ====== Google Drive ======
function extractDriveFileId(url) {
  if (!url) return null;
  const u = String(url);
  // /file/d/<id>/view
  const m1 = u.match(/\/file\/d\/([^\/]+)\//);
  if (m1) return m1[1];
  // open?id=<id>
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

    // Pausa players anteriores
    if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
        try { ytPlayer.pauseVideo(); } catch (_) {}
    }
    if (vimeoPlayer) {
        try { vimeoPlayer.pause(); } catch (_) {}
    }

    const container = document.getElementById('player');
    container.innerHTML = `
        <iframe
            src="https://drive.google.com/file/d/${fileId}/preview?autoplay=1&hl=pt-BR"
            width="100%" height="100%"
            allow="autoplay; fullscreen"
            allowfullscreen
            style="border:0; background:#000;"
        ></iframe>
    `;

    updateInfo(
        document.getElementById('video-title')?.innerText || "Vídeo",
        "Drive: clique no play se não iniciar automaticamente. Volume ajustável no player."
    );

    // Timer para auto-avançar (se duration estiver definido no config)
    const videoData = safeSchedule()[currentIndex];
    if (videoData && videoData.duration && typeof videoData.duration === 'number') {
        setTimeout(() => {
            if (!manualControl) {  // Só avança se não for controle manual
                playNext(true);
            }
        }, (videoData.duration * 1000) + 5000);  // +5s buffer para loading/delay
    } else {
        console.warn("Duração não definida para auto-avançar no Drive:", videoData);
        updateInfo(
            document.getElementById('video-title')?.innerText || "Vídeo",
            "Drive: sem duração definida — use botões para navegar."
        );
    }
}


// ====== Inicialização ======
(function init() {
  setVolumeUI(currentVolume);

  const sch = safeSchedule();
  if (sch.length === 0) {
    updateInfo("Nenhum vídeo na programação.", "Aguarde, iniciando o fluxo...");
    return;
  }
  // Carrega o primeiro vídeo com autoplay
  manualControl = false;
  loadVideo(0, false);
  // Watchdog: se travar (ex.: Drive não carrega), pule após 30s
let watchdogTimer;
function startWatchdog() {
    if (watchdogTimer) clearTimeout(watchdogTimer);
    watchdogTimer = setTimeout(() => {
        if (!manualControl) {
            console.warn("Watchdog: possível travamento — avançando.");
            playNext(true);
        }
    }, 30000);  // 30s
}

// Chame startWatchdog() no início de loadVideo()
// (adicione na função loadVideo, logo após updateInfo)
startWatchdog();
})();

