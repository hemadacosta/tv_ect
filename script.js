// script.js
let currentIndex = 0;
let player = null; // Pode ser um player YT ou Vimeo
let currentType = null; // 'youtube' ou 'vimeo'

// Função principal para iniciar o fluxo
function startTV() {
    if (schedule.length === 0) {
        document.getElementById('video-title').innerText = "Nenhum vídeo na programação.";
        return;
    }
    loadVideo(currentIndex);
}

// Função que decide qual player usar e carrega o vídeo
function loadVideo(index) {
    const videoData = schedule[index];
    document.getElementById('video-title').innerText = videoData.title;
    document.getElementById('status-text').innerText = `Reproduzindo vídeo ${index + 1} de ${schedule.length}`;

    const container = document.getElementById('player');
    container.innerHTML = ''; // Limpa o player anterior

    // Detectar tipo de vídeo
    if (videoData.url.includes('youtube.com') || videoData.url.includes('youtu.be')) {
        currentType = 'youtube';
        loadYouTube(videoData.url);
    } else if (videoData.url.includes('vimeo.com')) {
        currentType = 'vimeo';
        loadVimeo(videoData.url);
    } else {
        console.error("Link inválido:", videoData.url);
    }
}

// --- Lógica do YouTube ---
function loadYouTube(url) {
    // Extrair ID do YouTube
    const videoId = extractYouTubeID(url);
    
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'autoplay': 1,
            'controls': 0, // Esconde controles para parecer TV
            'rel': 0,      // Não mostra vídeos relacionados de outros canais
            'modestbranding': 1
        },
        events: {
            'onStateChange': onYouTubeStateChange
        }
    });
}

function onYouTubeStateChange(event) {
    // 0 significa que o vídeo terminou
    if (event.data === YT.PlayerState.ENDED) {
        playNext();
    }
}

// --- Lógica do Vimeo ---
function loadVimeo(url) {
    // Extrair ID do Vimeo
    const videoId = extractVimeoID(url);
    
    player = new Vimeo.Player('player', {
        id: videoId,
        autoplay: true,
        controls: false,
        background: true, // Modo cinema
        loop: false
    });

    player.on('ended', () => {
        playNext();
    });
}

// --- Controle de Fluxo ---
function playNext() {
    currentIndex++;
    if (currentIndex >= schedule.length) {
        currentIndex = 0; // Volta para o início (Loop infinito)
    }
    // Pequeno delay para evitar conflitos de API
    setTimeout(() => {
        loadVideo(currentIndex);
    }, 1000);
}

// --- Utilitários de Extração de ID ---
function extractYouTubeID(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length == 11) ? match[2] : null;
}

function extractVimeoID(url) {
    const regExp = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:\w+\/)?|album\/(?:\d+\/)?video\/|)(\d+)/;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

// Inicia quando a API do YouTube estiver pronta
function onYouTubeIframeAPIReady() {
    startTV();
}
// Se o Vimeo carregar antes, o startTV já roda, mas a lógica do Vimeo é assíncrona dentro do loadVimeo.
// Para garantir, chamamos o startTV logo se o YT não estiver presente (caso só tenha Vimeo).
if (!window.onYouTubeIframeAPIReady) {
    startTV();
}