// script.js (v6) — navegação confiável (YouTube/Vimeo) + controles discretos
// CORREÇÃO: API do Vimeo carregada dinamicamente + gerenciamento correto de players

let currentIndex = 0;
let ytPlayer = null;      // instância YT.Player
let vimeoPlayer = null;   // instância Vimeo.Player
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
let _lastNavClickAt = 0;
function _navGuard() {
  const now = Date.now();
  if (now - _lastNavClickAt < 350) return false; // ignora duplo disparo
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

  // Se a entrada trouxer um HTML de incorporação (embedHtml), usamos diretamente
  if (videoData.embedHtml) {
    const container = document.getElementById('player');
    if (container) container.innerHTML = videoData.embedHtml;
    return;
  }

  // Carrega conforme tipo
  if (type === 'youtube') {
    // Mantém autoplay mesmo quando a navegação é manual pelos botões
    loadYouTube(videoData.url, autoplayEnabled);
  } else if (type === 'vimeo') {
    // Mantém autoplay mesmo quando a navegação é manual pelos botões
    loadVimeo(videoData.url, autoplayEnabled);
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

// NOVO: Limpa completamente o container e destroi players antigos
function clearPlayerContainer() {
  const container = document.getElementById('player');
  if (!container) return;

  // Destroi player do YouTube se existir
  if (ytPlayer) {
    try {
      ytPlayer.destroy();
    } catch (e) {
      console.warn("Erro ao destruir YouTube player:", e);
    }
    ytPlayer = null;
  }

  // Destroi player do Vimeo se existir
  if (vimeoPlayer) {
    try {
      vimeoPlayer.destroy();
    } catch (e) {
      console.warn("Erro ao destruir Vimeo player:", e);
    }
    vimeoPlayer = null;
  }

  // Limpa o HTML do container
  container.innerHTML = '';
}

function loadYouTube(url, allowAutoplay) {
  const videoId = extractYouTubeID(url);
  if (!videoId) {
    console.error("ID YouTube não encontrado:", url);
    updateInfo("Erro no YouTube", "Não encontrei o ID do vídeo.");
    return;
  }

  ensureYouTubeAPIReady(() => {
    // Se já existe player YouTube, REUTILIZA (isso resolve "só o vídeo 1 carrega")
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
        clearPlayerContainer(); // Usa a nova função de limpeza
      }
    }

    // Limpa container se não estava usando YouTube antes (veio do Vimeo ou Drive)
    if (vimeoPlayer) {
      clearPlayerContainer();
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

// NOVO: Carrega a API do Vimeo dinamicamente se não estiver presente
function loadVimeoAPI(callback) {
  if (typeof Vimeo !== 'undefined' && Vimeo.Player) {
    vimeoAPILoaded = true;
    callback();
    return;
  }

  // Verifica se o script já está sendo carregado
  if (document.querySelector('script[src*="player.vimeo.com/api/player.js"]')) {
    // Aguarda o carregamento
    const checkInterval = setInterval(() => {
      if (typeof Vimeo !== 'undefined' && Vimeo.Player) {
        vimeoAPILoaded = true;
        clearInterval(checkInterval);
        callback();
      }
    }, 100);
    return;
  }

  console.log("Carregando API do Vimeo...");

  // Cria o script para carregar a API
  const script = document.createElement('script');
  script.src = 'https://player.vimeo.com/api/player.js';
  script.async = true;
  script.onload = () => {
    console.log("API do Vimeo carregada com sucesso!");
    vimeoAPILoaded = true;
    callback();
  };
  script.onerror = () => {
    console.error("Falha ao carregar API do Vimeo");
    updateInfo("Erro", "Não foi possível carregar o player do Vimeo. Verifique sua conexão.");
  };
  document.head.appendChild(script);
}

function extractVimeoID(url) {
  if (!url) return null;
  const u = String(url).trim();

  // Padrões suportados:
  // https://vimeo.com/12345678
  // https://player.vimeo.com/video/12345678
  // https://vimeo.com/12345678?param=value
  // https://vimeo.com/channels/staffpicks/12345678

  const patterns = [
    /vimeo\.com\/(?:video\/)?(\d+)(?:[?\/]|$)/,
    /vimeo\.com\/channels\/[^\/]+\/(\d+)/,
    /player\.vimeo\.com\/video\/(\d+)/
  ];

  for (const pattern of patterns) {
    const m = u.match(pattern);
    if (m) return m[1];
  }

  // Fallback: regex original mais simples
  const m = u.match(/vimeo\.com\/(?:video\/)?(\d+)/);
  return m ? m[1] : null;
}

function loadVimeo(url, allowAutoplay) {
  const videoId = extractVimeoID(url);
  if (!videoId) {
    console.error("ID Vimeo não encontrado:", url);
    updateInfo("Erro no Vimeo", "Não encontrei o ID do vídeo. Verifique a URL.");
    return;
  }

  // Carrega a API primeiro, depois cria o player
  loadVimeoAPI(() => {
    // Limpa container e players antigos antes de criar novo
    clearPlayerContainer();

    // Cria novo container para o Vimeo
    const container = document.getElementById('player');
    const vimeoDiv = document.createElement('div');
    vimeoDiv.id = 'vimeo-player';
    container.appendChild(vimeoDiv);

    // Cria o player do Vimeo
    createVimeoPlayer(videoId, allowAutoplay);
  });
}

function createVimeoPlayer(videoId, allowAutoplay) {
  try {
    console.log("Criando player Vimeo para ID:", videoId);

    vimeoPlayer = new Vimeo.Player('vimeo-player', {
      id: Number(videoId),
      autoplay: !!allowAutoplay,
      muted: autoplayMuted, // Importante para autoplay funcionar
      title: false,
      byline: false,
      portrait: false,
      controls: true
    });

    vimeoPlayer.ready().then(() => {
      console.log("Vimeo player pronto!");

      // Aplica volume atual
      applyVolumeToPlayer();

      // Se usuário já ajustou volume, desmuta
      maybeUnmuteIfUserChangedVolume();

      // Tenta dar play se permitido
      if (allowAutoplay) {
        vimeoPlayer.play().catch((err) => {
          console.warn("Autoplay bloqueado pelo navegador:", err);
          // Autoplay foi bloqueado, usuário precisa interagir
          updateInfo(
            document.getElementById('video-title')?.innerText || "Vídeo",
            "Clique no vídeo para iniciar (bloqueio do navegador)"
          );
        });
      }
    });

    // Evento quando o vídeo termina
    vimeoPlayer.on('ended', () => {
      console.log("Vimeo: vídeo terminou, avançando...");
      setTimeout(() => {
        manualControl = false;
        playNext(true);
      }, 800);
    });

    // Evento de erro
    vimeoPlayer.on('error', (err) => {
      console.error("Erro no player Vimeo:", err);
      updateInfo("Erro no Vimeo", "Não foi possível reproduzir o vídeo");
    });

    // Evento de carregamento
    vimeoPlayer.on('loaded', () => {
      console.log("Vimeo: vídeo carregado");
    });

  } catch (err) {
    console.error("Falha ao criar player Vimeo:", err);
    updateInfo("Erro", "Falha ao inicializar player do Vimeo");
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

  // Limpa players anteriores
  clearPlayerContainer();

  const container = document.getElementById('player');

  // Tentativa 1: tocar como MP4 direto via endpoint 'uc' + <video> (permite ended -> auto-sequência)
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

  // Autoplay com som costuma ser bloqueado -> iniciamos muted
  vid.muted = true;

  vid.addEventListener('ended', () => {
    setTimeout(() => {
      manualControl = false;
      playNext(true);
    }, 800);
  });

  vid.addEventListener('error', () => {
    // Fallback: preview do Drive (sem ended confiável)
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
  // Carrega o primeiro vídeo com autoplay
  manualControl = false;
  loadVideo(0, false);
})();
