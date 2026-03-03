// script.js
let currentIndex = 0;
let player = null;
let currentType = null;
let currentVolume = 100;
let autoplayEnabled = true;
let manualControl = false;

// Controle de volume
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');

if (volumeSlider) {
    volumeSlider.addEventListener('input', function() {
        currentVolume = this.value;
        volumeValue.textContent = currentVolume + '%';
        updateVolume();
    });
}

function updateVolume() {
    if (player) {
        if (currentType === 'youtube') {
            player.setVolume(currentVolume);
        } else if (currentType === 'vimeo') {
            player.setVolume(currentVolume / 100);
        }
    }
}

// Limpa/destroi o player atual (necessário para trocar de vídeo com segurança)
function cleanupPlayer() {
    if (!player) return;
    try {
        if (currentType === 'youtube' && typeof player.destroy === 'function') {
            player.destroy();
        } else if (currentType === 'vimeo') {
            if (typeof player.destroy === 'function') player.destroy();
            else if (typeof player.unload === 'function') player.unload();
        } else {
            // googledrive / outros: nada especial
        }
    } catch (e) {
        console.warn("Falha ao limpar player anterior:", e);
    }
    player = null;
    currentType = null;
}


function startTV() {
    if (typeof schedule === 'undefined' || schedule.length === 0) {
        document.getElementById('video-title').innerText = "Nenhum vídeo na programação.";
        return;
    }
    loadVideo(currentIndex);
}

function loadVideo(index) {
    const videoData = schedule[index];
    document.getElementById('video-title').innerText = videoData.title;
    document.getElementById('status-text').innerText = `Vídeo ${index + 1} de ${schedule.length}`;

    const container = document.getElementById('player');
    // IMPORTANTE: destruir player anterior antes de reusar o container
    cleanupPlayer();
    container.innerHTML = '';
    manualControl = false;

    // Detectar tipo automaticamente se não especificado
    let type = videoData.type;
    if (!type) {
        if (videoData.url.includes('youtube.com') || videoData.url.includes('youtu.be')) {
            type = 'youtube';
        } else if (videoData.url.includes('vimeo.com')) {
            type = 'vimeo';
        } else if (videoData.url.includes('drive.google.com')) {
            type = 'googledrive';
        }
    }

    currentType = type;

    if (type === 'youtube') {
        loadYouTube(videoData.url);
    } else if (type === 'vimeo') {
        loadVimeo(videoData.url);
    } else if (type === 'googledrive') {
        loadGoogleDrive(videoData.url);
    } else {
        console.error("Tipo de vídeo não suportado:", type);
    }
}

// ========== YOUTUBE ==========
function loadYouTube(url) {
    const videoId = extractYouTubeID(url);
    
    if (!videoId) {
        console.error("ID do YouTube não encontrado em:", url);
        return;
    }
    
    // Se a API do YouTube ainda não carregou, aguarde
    if (typeof YT === 'undefined' || !YT.Player) {
        setTimeout(() => loadYouTube(url), 500);
        return;
    }
    
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'autoplay': autoplayEnabled ? 1 : 0,
            'controls': manualControl ? 1 : 0,
            'rel': 0,
            'modestbranding': 1,
            'playsinline': 1
        },
        events: {
            'onReady': onYouTubeReady,
            'onStateChange': onYouTubeStateChange
        }
    });
}

function onYouTubeReady(event) {
    event.target.setVolume(currentVolume);
    if (autoplayEnabled && !manualControl) {
        event.target.playVideo();
    }
}

function onYouTubeStateChange(event) {
    if (event.data === YT.PlayerState.ENDED && !manualControl) {
        setTimeout(playNext, 1000);
    }
}

// ========== VIMEO ==========
function loadVimeo(url) {
    const videoId = extractVimeoID(url);
    
    if (!videoId) {
        console.error("ID do Vimeo não encontrado em:", url);
        return;
    }
    
    player = new Vimeo.Player('player', {
        id: videoId,
        autoplay: autoplayEnabled && !manualControl,
        controls: manualControl ? 1 : 0,
        background: !manualControl,
        loop: false,
        volume: currentVolume / 100,
        transparent: false
    });

    player.on('ended', () => {
        if (!manualControl) {
            setTimeout(playNext, 1000);
        }
    });
    
    player.on('loaded', () => {
        player.setVolume(currentVolume / 100);
    });
}

// ========== GOOGLE DRIVE ==========
function loadGoogleDrive(url) {
    const fileId = extractGoogleDriveID(url);
    
    if (!fileId) {
        console.error("ID do Google Drive não encontrado em:", url);
        document.getElementById('player').innerHTML = '<p style="color:white; text-align:center;">Erro ao carregar vídeo do Google Drive</p>';
        return;
    }
    
    // Usa /preview para embed
    const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;
    
    const container = document.getElementById('player');
    container.innerHTML = `
        <iframe 
            src="${embedUrl}" 
            width="100%" 
            height="100%" 
            style="border:none;" 
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen>
        </iframe>
    `;
    
    document.getElementById('status-text').innerText = "Google Drive - Use os botões para navegar";
}

// ========== NAVEGAÇÃO ==========

// Botão "Próximo" (controle manual do estudante)
function playNextManual() {
    manualControl = true;
    playNext();
}

// Próximo vídeo (usado pelo autoplay e pelo botão)
function playNext() {
    // IMPORTANTE: destruir player anterior (YouTube/Vimeo) antes de carregar outro
    cleanupPlayer();

    currentIndex++;
    if (currentIndex >= schedule.length) {
        currentIndex = 0; // Loop infinito
    }
    loadVideo(currentIndex);
}

// Botão "Anterior"
function playPrevious() {
    manualControl = true;

    // IMPORTANTE: destruir player anterior (YouTube/Vimeo) antes de carregar outro
    cleanupPlayer();

    currentIndex--;
    if (currentIndex < 0) {
        currentIndex = schedule.length - 1;
    }
    loadVideo(currentIndex);
}

// ========== UTILITÁRIOS ==========

function extractYouTubeID(url) {
    if (!url) return null;
    // Remove espaços e parâmetros extras
    url = url.trim().split('?')[0];
    
    const patterns = [
        /youtu\.be\/([^\/\?]+)/,
        /youtube\.com\/watch\?v=([^\/\?]+)/,
        /youtube\.com\/embed\/([^\/\?]+)/,
        /youtube\.com\/v\/([^\/\?]+)/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match && match[1]) return match[1];
    }
    return null;
}

function extractVimeoID(url) {
    if (!url) return null;
    url = url.trim().split('?')[0];
    
    const pattern = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:\w+\/)?|album\/(?:\d+\/)?video\/|)?(\d+)/;
    const match = url.match(pattern);
    return match ? match[1] : null;
}

function extractGoogleDriveID(url) {
    if (!url) return null;
    // Aceita tanto /view quanto /preview
    const pattern = /\/file\/d\/([^\/\?]+)/;
    const match = url.match(pattern);
    return match ? match[1] : null;
}

// ========== INICIALIZAÇÃO ==========

// Callback da API do YouTube
window.onYouTubeIframeAPIReady = function() {
    startTV();
};

// Inicia se a API do YouTube já estiver carregada ou se não for necessário
if (typeof YT !== 'undefined' && YT.Player) {
    startTV();
} else if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
    // Se por acaso a API não foi carregada, tenta iniciar mesmo assim (para Vimeo/Drive)
    setTimeout(startTV, 100);
}
