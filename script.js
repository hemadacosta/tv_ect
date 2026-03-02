let currentIndex = 0;
let player = null;
let currentType = null;
let currentVolume = 100; // Volume padrão 100%

// Controle de volume
const volumeSlider = document.getElementById('volume-slider');
const volumeValue = document.getElementById('volume-value');

volumeSlider.addEventListener('input', function() {
    currentVolume = this.value;
    volumeValue.textContent = currentVolume + '%';
    updateVolume();
});

function updateVolume() {
    if (player) {
        if (currentType === 'youtube') {
            player.setVolume(currentVolume);
        } else if (currentType === 'vimeo') {
            player.setVolume(currentVolume / 100); // Vimeo usa 0-1
        }
    }
}

function startTV() {
    if (schedule.length === 0) {
        document.getElementById('video-title').innerText = "Nenhum vídeo na programação.";
        return;
    }
    loadVideo(currentIndex);
}

function loadVideo(index) {
    const videoData = schedule[index];
    document.getElementById('video-title').innerText = videoData.title;
    document.getElementById('status-text').innerText = `Reproduzindo vídeo ${index + 1} de ${schedule.length}`;

    const container = document.getElementById('player');
    container.innerHTML = '';

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

function loadYouTube(url) {
    const videoId = extractYouTubeID(url);
    
    player = new YT.Player('player', {
        height: '100%',
        width: '100%',
        videoId: videoId,
        playerVars: {
            'autoplay': 1,
            'controls': 0,
            'rel': 0,
            'modestbranding': 1
        },
        events: {
            'onReady': onYouTubeReady,
            'onStateChange': onYouTubeStateChange
        }
    });
}

function onYouTubeReady(event) {
    // Aplica o volume quando o player estiver pronto
    event.target.setVolume(currentVolume);
}

function onYouTubeStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        playNext();
    }
}

function loadVimeo(url) {
    const videoId = extractVimeoID(url);
    
    player = new Vimeo.Player('player', {
        id: videoId,
        autoplay: true,
        controls: false,
        background: true,
        loop: false,
        volume: currentVolume / 100
    });

    player.on('ended', () => {
        playNext();
    });
}

function playNext() {
    currentIndex++;
    if (currentIndex >= schedule.length) {
        currentIndex = 0;
    }
    setTimeout(() => {
        loadVideo(currentIndex);
    }, 1000);
}

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

function onYouTubeIframeAPIReady() {
    startTV();
}

if (!window.onYouTubeIframeAPIReady) {
    startTV();
}
