// script.js
let currentIndex = 0;
let player = null;
let currentType = null;
let currentVolume = 100;
let autoplayEnabled = true;
let manualControl = false;

// ====== Helpers de DOM ======
const $ = (id) => document.getElementById(id);

// Controle de volume
const volumeSlider = $('volume-slider');
const volumeValue  = $('volume-value');

if (volumeSlider) {
    volumeSlider.addEventListener('input', function () {
        currentVolume = Number(this.value);
        if (volumeValue) volumeValue.textContent = currentVolume + '%';
        updateVolume();
    });
}

// Botões de navegação (mais confiável que onclick inline no GitHub Pages/Moodle)
const btnPrev = $('btn-prev');
const btnNext = $('btn-next');

if (btnPrev) btnPrev.addEventListener('click', () => playPrevious());
if (btnNext) btnNext.addEventListener('click', () => playNextManual());

// Expor as funções no escopo global (caso você queira manter onclick no HTML)
window.playPrevious   = playPrevious;
window.playNextManual = playNextManual;

function updateVolume() {
    if (!player) return;

    try {
        if (currentType === 'youtube' && typeof player.setVolume === 'function') {
            player.setVolume(currentVolume);
        } else if (currentType === 'vimeo' && typeof player.setVolume === 'function') {
            player.setVolume(currentVolume / 100);
        }
        // Google Drive: não há API de volume no embed /preview
    } catch (e) {
        console.warn('Falha ao atualizar volume:', e);
    }
}

function startTV() {
    if (typeof schedule === 'undefined' || !Array.isArray(schedule) || schedule.length === 0) {
        const title = $('video-title');
        if (title) title.innerText = "Nenhum vídeo na programação.";
        return;
    }
    loadVideo(currentIndex);
}

function loadVideo(index) {
    const videoData = schedule[index];

    const title = $('video-title');
    const status = $('status-text');
    if (title) title.innerText = videoData.title || 'Sem título';
    if (status) status.innerText = `Vídeo ${index + 1} de ${schedule.length}`;

    // Sempre “limpa” player anterior de forma segura
    destroyCurrentPlayer();

    // Garante que o container exista e esteja limpo
    const container = $('player');
    if (!container) return;
    container.innerHTML = '';

    // Se o usuário acabou de clicar, isso é controle manual
    // (mas o controle visual do player pode continuar oculto — o importante aqui é navegar)
    const type = detectType(videoData);
    currentType = type;

    if (type === 'youtube') {
        loadYouTube(videoData.url);
    } else if (type === 'vimeo') {
        loadVimeo(videoData.url);
    } else if (type === 'googledrive') {
        loadGoogleDrive(videoData.url);
    } else {
        console.error("Tipo de vídeo não suportado:", type);
        if (status) status.innerText = "Tipo de vídeo não suportado.";
    }
}

function detectType(videoData) {
    let type = videoData.type;
    if (!type && videoData.url) {
        const u = videoData.url;
        if (u.includes('youtube.com') || u.includes('youtu.be')) type = 'youtube';
        else if (u.includes('vimeo.com')) type = 'vimeo';
        else if (u.includes('drive.google.com')) type = 'googledrive';
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
            // Vimeo Player: destroy() remove o iframe e listeners
            if (typeof player.unload === 'function') player.unload().catch(() => {});
            if (typeof player.destroy === 'function') player.destroy().catch(() => {});
        }
    } catch (e) {
        console.warn('Falha ao destruir player anterior:', e);
    } finally {
        player = null;
    }
}

// ========== YOUTUBE ==========
function loadYouTube(url) {
    const videoId = extractYouTubeID(url);

    if (!videoId) {
        console.error("ID do YouTube não encontrado em:", url);
        const status = $('status-text');
        if (status) status.innerText = "Erro: vídeo do YouTube inválido.";
        return;
    }

    // Se a API do YouTube ainda não carregou, aguarde
    if (typeof YT === 'undefined' || !YT.Player) {
        setTimeout(() => loadYouTube(url), 250);
        return;
    }

    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
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

// ========== VIMEO ==========
function loadVimeo(url) {
    const videoId = extractVimeoID(url);

    if (!videoId) {
        console.error("ID do Vimeo não encontrado em:", url);
        const status = $('status-text');
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

// ========== GOOGLE DRIVE ==========
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

    // Usa /preview para embed
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

    // Drive não fornece callback de “ended”; o estudante navega pelos botões
    if (status) status.innerText = "Google Drive — use Anterior/Próximo para navegar.";
    player = null;
}

// ========== NAVEGAÇÃO ==========

// Botão "Próximo" (controle manual do estudante)
function playNextManual() {
    manualControl = true;
    playNext();
}

// Próximo vídeo (usado pelo autoplay e pelo botão)
function playNext() {
    destroyCurrentPlayer();

    currentIndex++;
    if (currentIndex >= schedule.length) currentIndex = 0; // Loop infinito
    loadVideo(currentIndex);
}

// Botão "Anterior"
function playPrevious() {
    manualControl = true;

    destroyCurrentPlayer();

    currentIndex--;
    if (currentIndex < 0) currentIndex = schedule.length - 1;
    loadVideo(currentIndex);
}

// ========== UTILITÁRIOS ==========

function extractYouTubeID(url) {
    if (!url) return null;

    try {
        // Suporta youtu.be/ID e youtube.com/watch?v=ID, incluindo parâmetros
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
    } catch (_) {
        // fallback
    }

    // fallback regex
    const m = url.match(/(?:youtu\.be\/|v=|embed\/)([\w-]{6,})/);
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

// ========== INICIALIZAÇÃO ==========

// Callback da API do YouTube
window.onYouTubeIframeAPIReady = function () {
    startTV();
};

// Se por algum motivo o callback não vier (ex.: sem YouTube na lista), inicia após DOM pronto
document.addEventListener('DOMContentLoaded', () => {
    // Tenta iniciar rapidamente; se o YouTube ainda não carregou, o loadYouTube aguarda.
    startTV();
});
