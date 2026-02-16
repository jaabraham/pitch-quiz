document.addEventListener('DOMContentLoaded', () => {
    // Screen elements
    const homeScreen = document.getElementById('home-screen');
    const gameScreen = document.getElementById('game-screen');
    const leaderboardScreen = document.getElementById('leaderboard-screen');

    // Buttons
    const startTrainingBtn = document.getElementById('start-training-btn');
    const viewLeaderboardBtn = document.getElementById('view-leaderboard-btn');
    const backToHomeBtn = document.getElementById('back-to-home-btn');
    const choiceButtons = document.querySelectorAll('.btn-choice');

    // Game elements
    const videoPlayer = document.getElementById('pitch-video');
    const feedbackEl = document.getElementById('feedback');
    const scoreEl = document.getElementById('score');
    const pitchCountEl = document.getElementById('pitch-count');
    const leaderboardList = document.getElementById('leaderboard-list');
    
    // Game state
    let pitches = [];
    let currentPitchIndex = 0;
    let score = 0;
    const pitchesPerRound = 10;

    // Mock data for pitches (will be replaced by API call)
    // IMPORTANT: You need to create this metadata for your videos.
    const pitchData = [
        { file: 'videos/pitch_001.mp4', type: 'fastball' },
        { file: 'videos/pitch_002.mp4', type: 'curveball' },
        { file: 'videos/pitch_003.mp4', type: 'fastball' },
        { file: 'videos/pitch_004.mp4', type: 'fastball' },
        { file: 'videos/pitch_005.mp4', type: 'curveball' },
        { file: 'videos/pitch_006.mp4', type: 'fastball' },
        { file: 'videos/pitch_007.mp4', type: 'curveball' },
        { file: 'videos/pitch_008.mp4', type: 'curveball' },
        { file: 'videos/pitch_009.mp4', type: 'fastball' },
        { file: 'videos/pitch_010.mp4', type: 'curveball' },
        // Add all your pitches here
    ];

    function showScreen(screen) {
        homeScreen.classList.add('hidden');
        gameScreen.classList.add('hidden');
        leaderboardScreen.classList.add('hidden');
        screen.classList.remove('hidden');
    }

    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    function startGame() {
        // Reset state
        score = 0;
        currentPitchIndex = 0;
        scoreEl.textContent = score;
        
        // Shuffle and select pitches for the round
        shuffleArray(pitchData);
        pitches = pitchData.slice(0, pitchesPerRound);
        
        showScreen(gameScreen);
        loadNextPitch();
    }

    function loadNextPitch() {
        feedbackEl.textContent = '';
        feedbackEl.className = '';
        choiceButtons.forEach(btn => btn.disabled = true);

        if (currentPitchIndex >= pitches.length) {
            endGame();
            return;
        }

        pitchCountEl.textContent = `${currentPitchIndex + 1} / ${pitchesPerRound}`;
        const currentPitch = pitches[currentPitchIndex];
        
        // The 'static/' part is handled by Flask's url_for, so we just need the path from static
        videoPlayer.src = `static/${currentPitch.file}`;
        videoPlayer.play();

        videoPlayer.onended = () => {
            choiceButtons.forEach(btn => btn.disabled = false);
        };
    }

    function handleGuess(event) {
        const selectedPitch = event.target.dataset.pitch;
        const correctPitch = pitches[currentPitchIndex].type;
        
        if (selectedPitch === correctPitch) {
            score++;
            feedbackEl.textContent = 'Correct!';
            feedbackEl.classList.add('correct');
        } else {
            feedbackEl.textContent = `Incorrect! It was a ${correctPitch}.`;
            feedbackEl.classList.add('incorrect');
        }
        
        scoreEl.textContent = score;
        currentPitchIndex++;

        choiceButtons.forEach(btn => btn.disabled = true);
        setTimeout(loadNextPitch, 2000); // Wait 2 seconds before next pitch
    }

    function endGame() {
        // Here you would eventually send the score to the server
        // fetch('/api/save-score', { method: 'POST', body: JSON.stringify({ score }) ... });
        alert(`Round Over! Your final score is: ${score} / ${pitchesPerRound}`);
        showScreen(homeScreen);
    }
    
    async function showLeaderboard() {
        // In a real app, you'd fetch this from your server API
        const mockLeaderboard = [
            { username: 'AcePitcher', score: 98 },
            { username: 'CurveMaster', score: 95 },
            { username: 'RookieStar', score: 91 },
            { username: 'SliderKing', score: 88 },
            { username: 'BaseballFan_123', score: 85 },
        ];
        
        leaderboardList.innerHTML = ''; // Clear previous list
        mockLeaderboard.forEach(entry => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${entry.username}</span><span>${entry.score}</span>`;
            leaderboardList.appendChild(li);
        });

        showScreen(leaderboardScreen);
    }

    // Event Listeners
    startTrainingBtn.addEventListener('click', startGame);
    viewLeaderboardBtn.addEventListener('click', showLeaderboard);
    backToHomeBtn.addEventListener('click', () => showScreen(homeScreen));
    choiceButtons.forEach(button => button.addEventListener('click', handleGuess));
});