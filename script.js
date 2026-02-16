// --- Configuration ---
let videoId = getVideoIdFromURL(); // Use URL param if present, else default
let answerWindows = []; // Will be loaded dynamically
const checkIntervalMs = 100; // Check time more frequently for scoring accuracy
const feedbackDisplayDurationMs = 1500; // How long to show CORRECT/WRONG overlay

// --- Load Video Data ---
async function loadVideoData() {
    try {
        const response = await fetch('videos.json');
        const videos = await response.json();
        const videoData = videos.find(video => video.videoId === videoId);

        if (!videoData) {
            throw new Error(`Video with ID ${videoId} not found in videos.json`);
        }

        answerWindows = videoData.answerWindows;
        updateStaticUI(); // Update UI with loaded data
    } catch (error) {
        console.error('Error loading video data:', error);
        feedbackMessage.textContent = 'Error loading video data. Please try again.';
    }
}

// --- Parse URL Parameters ---
function getVideoIdFromURL() {
    const params = new URLSearchParams(window.location.search);
    return params.get('videoId') || '8ZYPZIwj2u0'; // Use default if not provided
}

// --- State Variables ---
let player;
let score = 0;
let correctAnswers = 0; // Count of correct answers
let questionsAnswered = 0; // Count of questions answered (including missed)
let currentWindowIndex = 0;
let canAnswer = false;
let lastAnsweredClipIndex = -1;
let isQuizComplete = false;
let timeIntervalCheck = null;
let windowStartTimeStamp = null; // Timestamp when the current answer window started

// --- DOM Elements ---
// Use window properties for all shared DOM elements to avoid redeclaration
window.scoreDisplay = window.scoreDisplay || document.getElementById('score');
window.currentClipDisplay = window.currentClipDisplay || document.getElementById('current-clip');
window.totalClipsDisplay = window.totalClipsDisplay || document.getElementById('total-clips');
window.currentTimeDisplay = window.currentTimeDisplay || document.getElementById('current-time');
window.feedbackMessage = window.feedbackMessage || document.getElementById('feedback-message');
window.answerButtonsContainer = window.answerButtonsContainer || document.getElementById('answer-buttons-container');
window.offspeedBtn = window.offspeedBtn || document.getElementById('offspeedBtn');
window.fastballBtn = window.fastballBtn || document.getElementById('fastballBtn');
window.feedbackOverlay = window.feedbackOverlay || document.getElementById('feedback-overlay');
window.feedbackTextOverlay = window.feedbackTextOverlay || document.getElementById('feedback-text-overlay');
window.quizCompleteSection = window.quizCompleteSection || document.getElementById('quiz-complete');
window.finalScoreDisplay = window.finalScoreDisplay || document.getElementById('final-score');
window.finalTotalClipsDisplay = window.finalTotalClipsDisplay || document.getElementById('final-total-clips');
window.restartBtn = window.restartBtn || document.getElementById('restartBtn');
window.clipTimeMsDisplay = window.clipTimeMsDisplay || document.getElementById('clip-time-ms');
window.currentQuestionDisplay = window.currentQuestionDisplay || document.getElementById('current-question');
window.totalQuestionsDisplay = window.totalQuestionsDisplay || document.getElementById('total-questions');
window.percentageCorrectDisplay = window.percentageCorrectDisplay || document.getElementById('percentage-correct');
window.scoreboardScoreDisplay = window.scoreboardScoreDisplay || document.getElementById('scoreboard-score');
window.correctAnswersDisplay = window.correctAnswersDisplay || document.getElementById('correct-answers');
window.wrongAnswersDisplay = window.wrongAnswersDisplay || document.getElementById('wrong-answers');
window.totalTimeDisplay = window.totalTimeDisplay || document.getElementById('total-time');
window.quizUI = window.quizUI || document.getElementById('quiz-ui');
window.frontPage = window.frontPage || document.getElementById('front-page');
window.backToFrontBtn = window.backToFrontBtn || document.getElementById('back-to-front-btn');

// --- Helper for mapping code to display string ---
const answerCodeMap = { 1: "Fastball", 2: "Offspeed" };
function getAnswerString(code) { /* remains the same */ return answerCodeMap[code] || "Unknown"; }

// Helper function to convert "minutes:seconds" to seconds
function parseTimeString(timeString) {
    const [minutes, seconds] = timeString.split(":").map(Number);
    return minutes * 60 + seconds;
}

// --- YouTube API Loading  ---
function onYouTubeIframeAPIReady() {
    createOrLoadPlayer(videoId);
}

function createOrLoadPlayer(newVideoId) {
    if (window.player && typeof window.player.loadVideoById === 'function') {
        // If player exists, just load the new video and pause immediately
        window.player.loadVideoById(newVideoId);
        setTimeout(() => {
            if (window.player && typeof window.player.pauseVideo === 'function') {
                window.player.pauseVideo();
            }
        }, 500); // Pause after load
    } else {
        // Create a new player (do not autoplay)
        window.player = new YT.Player('player', {
            height: '360',
            width: '640',
            videoId: newVideoId,
            playerVars: {
                'playsinline': 1,
                'controls': 0,
                'rel': 0,
                'disablekb': 1,
                'autoplay': 0 // Ensure autoplay is off
            },
            events: {
                'onReady': onPlayerReady,
                'onStateChange': onPlayerStateChange
            }
        });
    }
}

// The API will call this function when the video player is ready.
function onPlayerReady(event) {
    console.log("Player Ready");
    feedbackMessage.textContent = "Player Ready. Waiting to start quiz...";
    updateStaticUI(); // Set total clips display
    // Disable answer buttons until the first answer window
    disableButtons();
    hideButtonsContainer();
    // Always pause video on ready
    if (event && event.target && typeof event.target.pauseVideo === 'function') {
        event.target.pauseVideo();
    }
    // Do NOT start timer or play video here
    // Wait for user to click "Start Quiz" overlay
}

// --- Start Quiz logic (called by overlay button) ---
window.startQuiz = function() {
    console.log("Start Quiz button clicked");
    // Always start from the beginning
    if (window.player && typeof window.player.seekTo === 'function') {
        window.player.seekTo(0, true);
    }
    // Start the timer BEFORE playing the video to ensure timer is running even if playVideo is delayed
    startPlaybackTimer();
    if (window.player && typeof window.player.playVideo === 'function') {
        window.player.playVideo();
    }
};

// The API calls this function when the player's state changes.
function onPlayerStateChange(event) {
    console.log("Player State Changed:", event.data);
    if (event.data == YT.PlayerState.ENDED) {
        console.log("Video Ended");
        // Handle overall video end if needed (though quiz might finish sooner)
        if (!isQuizComplete) {
            endQuiz(); // End quiz if video finishes before last clip processed
        }
    }
     // Add other state handling if needed (e.g., buffering, errors)
     // Remove timer auto-start here, timer is started by startQuiz only
     // (do not call startPlaybackTimer here)
}


// --- Core Logic Functions ---
function startPlaybackTimer() {
    if (timeIntervalCheck) {
        clearInterval(timeIntervalCheck); // Clear existing interval if any
    }
    console.log("Starting playback timer");
    // Run checkTimeWindow immediately so UI updates right away
    checkTimeWindow();
    timeIntervalCheck = setInterval(checkTimeWindow, checkIntervalMs);
}

function stopPlaybackTimer() {
    if (timeIntervalCheck) {
        console.log("Stopping playback timer");
        clearInterval(timeIntervalCheck);
        timeIntervalCheck = null;
    }
}

// --- MODIFIED: checkTimeWindow Function ---
function checkTimeWindow() {
    const ytPlayer = window.player;
    if (
        !ytPlayer ||
        typeof ytPlayer.getCurrentTime !== 'function' ||
        isQuizComplete
    ) {
        if (!isQuizComplete && !ytPlayer?._checkTimeWindowWarned) {
            if (ytPlayer) ytPlayer._checkTimeWindowWarned = true;
        }
        return;
    }
    if (ytPlayer._checkTimeWindowWarned) ytPlayer._checkTimeWindowWarned = false;

    let currentTime = 0;
    try {
        currentTime = ytPlayer.getCurrentTime();
        if (typeof currentTime !== 'number' || isNaN(currentTime)) currentTime = 0;
    } catch {
        currentTime = 0;
    }

    if (currentTimeDisplay) {
        currentTimeDisplay.textContent = currentTime.toFixed(1) + 's';
    }

    // --- Robust window advancement: loop to catch up if user seeks forward or timer lags ---
    while (currentWindowIndex < answerWindows.length) {
        const currentWindow = answerWindows[currentWindowIndex];
        const currentStartTime = parseTimeString(currentWindow.startTime);
        const nextStartTime =
            currentWindowIndex + 1 < answerWindows.length
                ? parseTimeString(answerWindows[currentWindowIndex + 1].startTime)
                : Infinity;

        if (clipTimeMsDisplay) {
            if (currentTime >= currentStartTime) {
                const timeSinceStart = (currentTime - currentStartTime).toFixed(2);
                clipTimeMsDisplay.textContent = timeSinceStart;
            } else {
                clipTimeMsDisplay.textContent = "0.0";
            }
        }

        // State 1: INSIDE the answer window
        if (currentTime >= currentStartTime && currentTime < nextStartTime) {
            // Only allow answering if not already answered
            if (lastAnsweredClipIndex !== currentWindow.clipIndex && !isQuizComplete) {
                if (!canAnswer) {
                    canAnswer = true;
                    windowStartTimeStamp = currentTime;
                    feedbackMessage.textContent = `Clip ${currentWindow.clipIndex + 1}: Guess Now!`;
                }
                enableButtons();
                showButtonsContainer();
            } else {
                // Already answered, keep buttons disabled/hidden
                disableButtons();
                hideButtonsContainer();
            }
            break; // In current window, stop loop
        }
        // State 2: PASSED the answer window end time
        else if (currentTime >= nextStartTime) {
            // If not answered, count as missed and advance
            if (lastAnsweredClipIndex !== currentWindow.clipIndex && !isQuizComplete) {
                canAnswer = false;
                disableButtons();
                hideButtonsContainer();
                windowStartTimeStamp = null;
                feedbackMessage.textContent = `Clip ${currentWindow.clipIndex + 1}: Missed!`;
                lastAnsweredClipIndex = currentWindow.clipIndex;
                questionsAnswered++;
                wrongAnswersDisplay.textContent = questionsAnswered - correctAnswers;
                totalTimeDisplay.textContent = ytPlayer.getCurrentTime().toFixed(1);
                updatePercentageCorrect();
            }
            // Always advance window if past, even if canAnswer is false
            currentWindowIndex++;
            if (currentWindowIndex >= answerWindows.length) {
                endQuiz();
                return;
            }
            // Continue loop to check next window (in case user skipped ahead)
        }
        // State 3: BEFORE the answer window start time
        else {
            if (canAnswer) {
                canAnswer = false;
                disableButtons();
                hideButtonsContainer();
                windowStartTimeStamp = null;
            }
            if (
                !feedbackMessage.textContent.includes("Correct") &&
                !feedbackMessage.textContent.includes("Incorrect") &&
                !feedbackMessage.textContent.includes("Missed")
            ) {
                feedbackMessage.textContent = `Waiting for Clip ${currentWindow.clipIndex + 1}...`;
            }
            break; // Not in any window yet, stop loop
        }
    }
}

// --- MODIFIED: handleAnswer Function ---
function handleAnswer(selectedAnswerString) {
    // Use window.player to ensure global reference
    const ytPlayer = window.player;
    if (!canAnswer || isQuizComplete || windowStartTimeStamp === null || !ytPlayer || typeof ytPlayer.getCurrentTime !== 'function') {
        return;
    }

    const clickTime = ytPlayer.getCurrentTime();
    const currentWindow = answerWindows[currentWindowIndex];
    const correctAnswerCode = currentWindow.correctAnswer;
    const correctAnswerString = getAnswerString(correctAnswerCode);

    canAnswer = false;
    disableButtons();
    hideButtonsContainer();
    lastAnsweredClipIndex = currentWindow.clipIndex;
    const timeTaken = clickTime - windowStartTimeStamp;
    windowStartTimeStamp = null;

    let pointsEarned = 0;
    let overlayClass = 'wrong';
    let overlayText = 'WRONG!';

    // Increment questions answered
    questionsAnswered++;

    if (selectedAnswerString === correctAnswerString) {
        pointsEarned = Math.max(0, Math.floor(1000 - (timeTaken*100)));
        score += pointsEarned;
        correctAnswers++; // Increment correct answers
        feedbackMessage.textContent = `Clip ${currentWindow.clipIndex + 1}: Correct! (+${pointsEarned} pts)`;
        overlayClass = 'correct';
        overlayText = 'CORRECT!';
    } else {
        feedbackMessage.textContent = `Clip ${currentWindow.clipIndex + 1}: Incorrect! (Was ${correctAnswerString})`;
    }

    // Update stats
    correctAnswersDisplay.textContent = correctAnswers;
    wrongAnswersDisplay.textContent = questionsAnswered - correctAnswers;
    totalTimeDisplay.textContent = ytPlayer.getCurrentTime().toFixed(1); // Update total time

    showFeedbackOverlay(overlayText, overlayClass);
    scoreboardScoreDisplay.textContent = score;
    updatePercentageCorrect(); // Update percentage correct
    moveToNextWindow();
}

// --- MODIFIED: moveToNextWindow Function ---
function moveToNextWindow() {
    currentWindowIndex++;
    // Safely update currentClipDisplay and currentQuestionDisplay if they exist
    if (currentClipDisplay) {
        currentClipDisplay.textContent = Math.min(currentWindowIndex + 1, answerWindows.length);
    }
    if (currentQuestionDisplay) {
        currentQuestionDisplay.textContent = Math.min(currentWindowIndex + 1, answerWindows.length);
    }
    if (clipTimeMsDisplay) {
        clipTimeMsDisplay.textContent = "0.0"; // Reset time to 0.0 after each clip
    }

    if (currentWindowIndex >= answerWindows.length) {
        endQuiz();
    }
}

// --- MODIFIED: updatePercentageCorrect Function ---
function updatePercentageCorrect() {
    const percentage = questionsAnswered === 0 
        ? 100 // If no questions have been answered, percentage is 100%
        : Math.round((correctAnswers / questionsAnswered) * 100);

    percentageCorrectDisplay.textContent = `${percentage}%`;
}

function endQuiz() {
     if (isQuizComplete) return;
    console.log("Ending Quiz");
    isQuizComplete = true;
    canAnswer = false;
    stopPlaybackTimer();
    disableButtons();
    hideButtonsContainer(); // Ensure buttons are hidden at the end
    // player.pauseVideo(); // Optional: Pause video

    feedbackMessage.textContent = "Quiz Finished!";
    finalScoreDisplay.textContent = score;
    finalTotalClipsDisplay.textContent = answerWindows.length;
    quizCompleteSection.classList.remove('hidden');
}


// --- MODIFIED: resetQuiz Function ---
function resetQuiz() {
    console.log("Resetting Quiz");
    score = 0;
    correctAnswers = 0; // Reset correct answers
    questionsAnswered = 0; // Reset questions answered
    currentWindowIndex = 0;
    lastAnsweredClipIndex = -1;
    canAnswer = false;
    isQuizComplete = false;
    windowStartTimeStamp = null; // Reset timestamp

    updateStaticUI();
    scoreboardScoreDisplay.textContent = score; // Reset scoreboard score
    percentageCorrectDisplay.textContent = "100%"; // Reset percentage correct to 100%
    clipTimeMsDisplay.textContent = "0"; // Reset clip time in ms
    correctAnswersDisplay.textContent = "0"; // Reset correct answers
    wrongAnswersDisplay.textContent = "0"; // Reset wrong answers
    totalTimeDisplay.textContent = "0.0"; // Reset total time

    scoreDisplay.textContent = score;
    feedbackMessage.textContent = "Starting... Waiting for Clip 1";
    quizCompleteSection.classList.add('hidden');
    hideButtonsContainer(); // Start with buttons hidden
    feedbackOverlay.classList.add('hidden'); // Ensure overlay is hidden

    if (player && typeof player.seekTo === 'function') {
        player.seekTo(0, true); // Seek to beginning of the VIDEO
        // Do NOT play video or start timer here
    }
    // Do NOT call startPlaybackTimer here
}


// --- UI Helper Functions ---
function enableButtons() { // Only enables, doesn't show container
    if (!isQuizComplete) {
        offspeedBtn.disabled = false;
        fastballBtn.disabled = false;
    }
}

function disableButtons() { // Only disables, doesn't hide container
    offspeedBtn.disabled = true;
    fastballBtn.disabled = true;
}

function showButtonsContainer() {
     answerButtonsContainer.classList.remove('hidden');
}

function hideButtonsContainer() {
     answerButtonsContainer.classList.add('hidden');
}

function showFeedbackOverlay(text, typeClass) {
    feedbackTextOverlay.textContent = text;
    feedbackOverlay.className = 'feedback-overlay'; // Reset classes
    feedbackOverlay.classList.add(typeClass); // Add 'correct' or 'wrong'

    // Make visible (remove hidden) - triggers fade-in if using opacity transition
     feedbackOverlay.classList.remove('hidden');


    // Set timeout to hide it again
    setTimeout(() => {
        feedbackOverlay.classList.add('hidden');
    }, feedbackDisplayDurationMs);
}


function updateStaticUI() {
    // Ensure all DOM elements exist before updating
    if (!totalClipsDisplay || !currentClipDisplay || !correctAnswersDisplay || !wrongAnswersDisplay || !totalTimeDisplay) {
        console.error("One or more DOM elements are missing. Check your HTML structure.");
        return;
    }

    totalClipsDisplay.textContent = answerWindows.length;
    currentClipDisplay.textContent = Math.min(currentWindowIndex + 1, answerWindows.length); // Update current clip

    // Update scoreboard stats
    correctAnswersDisplay.textContent = correctAnswers;
    wrongAnswersDisplay.textContent = questionsAnswered - correctAnswers;
    totalTimeDisplay.textContent = player ? player.getCurrentTime().toFixed(1) : "0.0"; // Ensure player exists
    updatePercentageCorrect();
}

// --- Load the API Asynchronously ---
function loadYouTubeAPI() {
     console.log("Requesting YouTube API Load");
     var tag = document.createElement('script');
     tag.src = "https://www.youtube.com/iframe_api";
     var firstScriptTag = document.getElementsByTagName('script')[0];
     firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
}

// --- Event Listeners ---
if (window.offspeedBtn) window.offspeedBtn.addEventListener('click', () => handleAnswer('Offspeed'));
if (window.fastballBtn) window.fastballBtn.addEventListener('click', () => handleAnswer('Fastball'));
if (window.restartBtn) window.restartBtn.addEventListener('click', resetQuiz);

// --- Initial Setup ---
document.addEventListener('DOMContentLoaded', async () => {
    console.log("DOM Loaded");
    videoId = getVideoIdFromURL(); // Get video ID from URL
    await loadVideoData(); // Load video data dynamically
    updateStaticUI();
    loadYouTubeAPI();
});

// --- UI Section Management for Mobile App Front Page ---
function showQuizUIOnly() {
    if (window.quizUI) window.quizUI.classList.remove('hidden');
    if (window.frontPage) window.frontPage.classList.add('hidden');
    // Hide all elements with class 'hide-on-quiz'
    document.querySelectorAll('.hide-on-quiz').forEach(el => el.classList.add('hidden'));
    // Hide the video thumbnail list explicitly (robust)
    var thumbList = document.getElementById('video-thumb-list');
    if (thumbList) thumbList.classList.add('hidden');
}

function showFrontPageOnly() {
    if (window.quizUI) window.quizUI.classList.add('hidden');
    if (window.frontPage) window.frontPage.classList.remove('hidden');
    // Optionally stop playback timer and pause video
    stopPlaybackTimer();
    if (player && typeof player.pauseVideo === 'function') player.pauseVideo();
    // Show all elements with class 'hide-on-quiz'
    document.querySelectorAll('.hide-on-quiz').forEach(el => el.classList.remove('hidden'));
    // Show the video thumbnail list on front page
    var thumbList = document.getElementById('video-thumb-list');
    if (thumbList) thumbList.classList.remove('hidden');
}

// --- Support for dynamic video selection ---
window.startQuizForVideo = async function(newVideoId) {
    // Update videoId and URL
    videoId = newVideoId;
    if (window.history && window.history.replaceState) {
        window.history.replaceState({}, '', '?videoId=' + videoId);
    }
    // Stop any existing playback timer
    stopPlaybackTimer();
    // Hide all elements with class 'hide-on-quiz' when starting quiz
    document.querySelectorAll('.hide-on-quiz').forEach(el => el.classList.add('hidden'));
    // Always hide the thumbnail list explicitly
    var thumbList = document.getElementById('video-thumb-list');
    if (thumbList) thumbList.classList.add('hidden');
    // Load new video data and reset quiz
    await loadVideoData();
    resetQuiz();
    showQuizUIOnly();
    // Load the new video in the player (or create if not exists)
    if (typeof YT !== 'undefined' && YT.Player) {
        createOrLoadPlayer(videoId);
    } else {
        // If API not loaded yet, load it
        loadYouTubeAPI();
    }
};

// --- Patch resetQuiz to allow reloading videoId ---
function patchResetQuiz() {
    // If called after videoId changes, reload video data
    if (typeof resetQuiz._patched === 'undefined') {
        const origResetQuiz = resetQuiz;
        resetQuiz = async function() {
            await loadVideoData();
            origResetQuiz();
        };
        resetQuiz._patched = true;
    }
}
patchResetQuiz();

// --- Patch endQuiz to be globally accessible (for top score saving) ---
window.endQuiz = endQuiz;
window.resetQuiz = resetQuiz;
window.stopPlaybackTimer = stopPlaybackTimer;

// --- Back to Home button logic ---
if (window.backToFrontBtn) {
    window.backToFrontBtn.addEventListener('click', () => {
        showFrontPageOnly();
        // Remove videoId from URL
        if (window.history && window.history.replaceState) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    });
}

// Expose startPlaybackTimer for overlay button
window.startPlaybackTimer = startPlaybackTimer;