// --- Configuration ---
let videoId = getVideoIdFromURL(); // Use URL param if present, else default
let answerWindows = []; // Will be loaded dynamically
const checkIntervalMs = 100; // Check time more frequently for scoring accuracy
const feedbackDisplayDurationMs = 1500; // How long to show CORRECT/WRONG overlay

// --- Session Logging System ---
const SessionLogger = {
    events: [],
    sessionStart: null,
    sessionEnd: null,
    fingerprint: null,
    username: null,
    
    init() {
        // Get fingerprint from localStorage (set by index.html)
        this.fingerprint = localStorage.getItem('pitch_recognition_fp') || 'unknown';
        this.username = localStorage.getItem('pitch_recognition_name') || null;
        this.events = [];
        this.sessionStart = new Date().toISOString();
        this.sessionEnd = null;
        this.logEvent('SESSION_START', { videoId, totalClips: answerWindows.length });
    },
    
    logEvent(type, data = {}) {
        const event = {
            timestamp: new Date().toISOString(),
            type: type,
            data: data
        };
        this.events.push(event);
        
        // Also log to console for debugging
        console.log(`[LOG] ${type}:`, data);
    },
    
    logAnswer(clipIndex, answer, correctAnswer, timeTaken, pointsEarned, isCorrect) {
        this.logEvent(isCorrect ? 'ANSWER_CORRECT' : 'ANSWER_WRONG', {
            clipIndex,
            guessed: answer,
            correct: correctAnswer,
            timeTaken: Math.round(timeTaken * 100) / 100,
            pointsEarned,
            runningScore: score
        });
    },
    
    logMissed(clipIndex, correctAnswer) {
        this.logEvent('ANSWER_MISSED', {
            clipIndex,
            correct: correctAnswer,
            runningScore: score
        });
    },
    
    logQuizEnd(finalScore, totalClips) {
        this.sessionEnd = new Date().toISOString();
        this.logEvent('SESSION_END', {
            finalScore,
            totalClips,
            correctAnswers,
            wrongAnswers: questionsAnswered - correctAnswers,
            percentageCorrect: questionsAnswered === 0 ? 100 : Math.round((correctAnswers / questionsAnswered) * 100)
        });
    },
    
    async sendToServer() {
        if (this.events.length === 0) return;
        
        try {
            const API_BASE = window.location.origin;
            const response = await fetch(`${API_BASE}/api/log`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    fingerprint: this.fingerprint,
                    username: this.username,
                    sessionStart: this.sessionStart,
                    sessionEnd: this.sessionEnd,
                    score: score,
                    events: this.events,
                    videoId: videoId,
                    totalClips: answerWindows.length
                })
            });
            
            if (response.ok) {
                console.log('[LOG] Session logged successfully');
            } else {
                console.warn('[LOG] Failed to send log:', response.status);
            }
        } catch (err) {
            console.warn('[LOG] Error sending log:', err);
            // Silent fail - logging shouldn't break the game
        }
    }
};

// --- Load Video Data ---
async function loadVideoData() {
    try {
        const response = await fetch('videos.json');
        const videos = await response.json();
        const videoData = videos.find(video => video.videoId === videoId);

        if (!videoData) {
            throw new Error(`Video with ID ${videoId} not found in videos.json`);
        }

        // Randomly select 5 clips from all available answer windows
        answerWindows = selectRandomClips(videoData.answerWindows, 5);
        updateStaticUI(); // Update UI with loaded data
    } catch (error) {
        console.error('Error loading video data:', error);
        feedbackMessage.textContent = 'Error loading video data. Please try again.';
    }
}

// --- Helper: Randomly select N clips from answer windows ---
function selectRandomClips(allWindows, count) {
    // If there are fewer clips than requested, use all of them
    if (allWindows.length <= count) {
        return allWindows.map((w, i) => ({ ...w, clipIndex: i }));
    }
    
    // Shuffle the array using Fisher-Yates algorithm
    const shuffled = [...allWindows];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    
    // Take the first 'count' items
    const selected = shuffled.slice(0, count);
    
    // Sort by start time so they play in chronological order
    selected.sort((a, b) => parseTimeString(a.startTime) - parseTimeString(b.startTime));
    
    // Re-index clipIndex to be 0-4 for the selected clips
    return selected.map((w, i) => ({ ...w, clipIndex: i }));
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
window.scoreDisplay = window.scoreDisplay || document.getElementById('scoreboard-score');
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
    createOrLoadPlayer(videoId, getFirstClipStartTime());
}

function createOrLoadPlayer(newVideoId, startTime = 0) {
    console.log(`[PLAYER] createOrLoadPlayer called - videoId: ${newVideoId}, startTime: ${startTime}s`);
    
    // Store the desired start time globally so onPlayerReady can use it
    window.desiredStartTime = startTime;
    
    // Always destroy and recreate the player to ensure clean state and correct start time
    if (window.player && typeof window.player.destroy === 'function') {
        console.log(`[PLAYER] Destroying existing player`);
        window.player.destroy();
        window.player = null;
    }
    
    // Clear the player container
    const playerContainer = document.getElementById('player');
    if (playerContainer) {
        playerContainer.innerHTML = '';
    }
    
    // Create a new player with the correct start time
    console.log(`[PLAYER] Creating new player with start=${startTime}s in playerVars`);
    window.player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: newVideoId,
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'rel': 0,
            'disablekb': 1,
            'autoplay': 0, // Ensure autoplay is off
            'start': Math.floor(startTime), // Start at specified time
            'mute': 1 // Mute the audio
        },
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });
}

// The API will call this function when the video player is ready.
function onPlayerReady(event) {
    console.log("[PLAYER] onPlayerReady called");
    console.log(`[PLAYER] currentWindowIndex: ${currentWindowIndex}, answerWindows.length: ${answerWindows.length}`);
    
    // Explicitly seek to the desired start time to ensure correct position
    const desiredTime = window.desiredStartTime || 0;
    if (event && event.target && typeof event.target.seekTo === 'function' && desiredTime > 0) {
        console.log(`[PLAYER] Explicitly seeking to ${desiredTime}s`);
        event.target.seekTo(desiredTime, true);
    }
    
    // Verify the actual current time
    setTimeout(() => {
        if (event && event.target && typeof event.target.getCurrentTime === 'function') {
            const actualTime = event.target.getCurrentTime();
            console.log(`[PLAYER] Actual video position: ${actualTime.toFixed(2)}s (desired: ${desiredTime}s)`);
            if (Math.abs(actualTime - desiredTime) > 2) {
                console.warn(`[PLAYER] WARNING: Video position mismatch! Seeking again to ${desiredTime}s`);
                event.target.seekTo(desiredTime, true);
            }
        }
    }, 500);
    
    if (answerWindows.length > 0) {
        const firstWindow = answerWindows[0];
        console.log(`[PLAYER] First clip expected at: ${firstWindow.startTime}, clipIndex: ${firstWindow.clipIndex}`);
    }
    feedbackMessage.textContent = "Player Ready. Waiting to start quiz...";
    updateStaticUI(); // Set total clips display
    // Disable answer buttons until the first answer window
    disableButtons();
    hideButtonsContainer();
    // Always pause and mute video on ready
    if (event && event.target) {
        if (typeof event.target.pauseVideo === 'function') {
            event.target.pauseVideo();
            console.log("[PLAYER] Video paused on ready");
        }
        if (typeof event.target.mute === 'function') {
            event.target.mute();
            console.log("[PLAYER] Video muted on ready");
        }
    }
    // Do NOT start timer or play video here
    // Wait for user to click "Start Quiz" overlay
}

// --- Helper: Get start time of first clip ---
function getFirstClipStartTime() {
    if (answerWindows && answerWindows.length > 0) {
        return parseTimeString(answerWindows[0].startTime);
    }
    return 0;
}

// --- Start Quiz logic (called by overlay button) ---
window.startQuiz = function() {
    const firstWindow = answerWindows[0];
    const startTime = getFirstClipStartTime();
    console.log(`[CLIP] STARTING QUIZ: Clip 1 at ${firstWindow.startTime} (${startTime}s) - Answer: ${getAnswerString(firstWindow.correctAnswer)}`);
    
    // Initialize session logging
    SessionLogger.init();
    
    // Hide the overlay
    if (window.startQuizOverlay) {
        window.startQuizOverlay.style.display = 'none';
    }
    // Start the timer and play the video
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
    
    // Log current state for debugging
    if (answerWindows.length > 0 && currentWindowIndex < answerWindows.length) {
        const expectedWindow = answerWindows[currentWindowIndex];
        const expectedStart = parseTimeString(expectedWindow.startTime);
        // Only log occasionally to avoid spam
        if (Math.floor(currentTime * 2) % 5 === 0) { // Log roughly every 2.5 seconds
            console.log(`[TIMER] currentTime: ${currentTime.toFixed(2)}s, expecting clip ${currentWindowIndex + 1} at ${expectedStart}s`);
        }
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
                    console.log(`[CLIP] ACTIVE: Clip ${currentWindowIndex + 1} - Current time: ${currentTime.toFixed(2)}s, Window: ${currentStartTime}s-${nextStartTime}s`);
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
                console.log(`[CLIP] MISSED: Clip ${currentWindowIndex + 1} - Current time: ${currentTime.toFixed(2)}s, Window ended at: ${nextStartTime}s`);
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
                
                // Stop timer and pause video
                stopPlaybackTimer();
                if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
                    ytPlayer.pauseVideo();
                }
                
                // Load next clip after delay
                setTimeout(() => {
                    moveToNextWindow();
                }, 1500);
                return;
            }
            // Always advance window if past, even if canAnswer is false
            console.log(`[CLIP] ADVANCING: Moving past Clip ${currentWindowIndex + 1} (already answered)`);
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
                const msg = `Waiting for Clip ${currentWindowIndex + 1} at ${currentWindow.startTime}... (current: ${currentTime.toFixed(1)}s)`;
                feedbackMessage.textContent = msg;
                // Log this state change
                if (Math.floor(currentTime) % 2 === 0) { // Log every ~2 seconds
                    console.log(`[TIMER] ${msg}, clipIndex: ${currentWindow.clipIndex}`);
                }
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
        console.log(`[CLIP] CORRECT: Clip ${currentWindowIndex + 1} - Guessed: ${selectedAnswerString}, Time: ${timeTaken.toFixed(2)}s, Points: ${pointsEarned}`);
        SessionLogger.logAnswer(currentWindow.clipIndex, selectedAnswerString, correctAnswerString, timeTaken, pointsEarned, true);
    } else {
        feedbackMessage.textContent = `Clip ${currentWindow.clipIndex + 1}: Incorrect! (Was ${correctAnswerString})`;
        console.log(`[CLIP] WRONG: Clip ${currentWindowIndex + 1} - Guessed: ${selectedAnswerString}, Correct: ${correctAnswerString}, Time: ${timeTaken.toFixed(2)}s`);
        SessionLogger.logAnswer(currentWindow.clipIndex, selectedAnswerString, correctAnswerString, timeTaken, 0, false);
    }

    // Update stats
    correctAnswersDisplay.textContent = correctAnswers;
    wrongAnswersDisplay.textContent = questionsAnswered - correctAnswers;
    totalTimeDisplay.textContent = clickTime.toFixed(1); // Use click time, not current time

    showFeedbackOverlay(overlayText, overlayClass);
    scoreboardScoreDisplay.textContent = score;
    updatePercentageCorrect(); // Update percentage correct
    
    // Stop the timer and pause video
    stopPlaybackTimer();
    if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
        ytPlayer.pauseVideo();
    }
    
    // Wait a moment then load next clip
    setTimeout(() => {
        moveToNextWindow();
    }, 1500);
}

// --- MODIFIED: moveToNextWindow Function ---
function moveToNextWindow() {
    currentWindowIndex++;
    
    if (currentWindowIndex >= answerWindows.length) {
        console.log(`[CLIP] Quiz complete - no more clips`);
        endQuiz();
        return;
    }
    
    // Load the next clip at its exact start time
    const nextWindow = answerWindows[currentWindowIndex];
    const startTime = parseTimeString(nextWindow.startTime);
    const correctAnswer = getAnswerString(nextWindow.correctAnswer);
    
    console.log(`[CLIP] Loading Clip ${currentWindowIndex + 1}/${answerWindows.length}`);
    console.log(`[CLIP]   Start time: ${nextWindow.startTime} (${startTime}s)`);
    console.log(`[CLIP]   Correct answer: ${correctAnswer}`);
    console.log(`[CLIP]   Original clipIndex from videos.json: ${nextWindow.clipIndex}`);
    
    // Update UI
    if (currentClipDisplay) {
        currentClipDisplay.textContent = currentWindowIndex + 1;
    }
    if (currentQuestionDisplay) {
        currentQuestionDisplay.textContent = currentWindowIndex + 1;
    }
    if (clipTimeMsDisplay) {
        clipTimeMsDisplay.textContent = "0.0";
    }
    
    feedbackMessage.textContent = `Clip ${currentWindowIndex + 1}: Loading...`;
    
    // Store the desired start time globally
    window.desiredStartTime = startTime;
    
    // Destroy and recreate player for each clip to ensure correct start time
    if (window.player && typeof window.player.destroy === 'function') {
        console.log(`[CLIP] Destroying player for clip ${currentWindowIndex + 1}`);
        window.player.destroy();
        window.player = null;
    }
    
    // Clear the player container
    const playerContainer = document.getElementById('player');
    if (playerContainer) {
        playerContainer.innerHTML = '';
    }
    
    // Create new player at the exact start time
    console.log(`[CLIP] Creating new player for clip ${currentWindowIndex + 1} at ${startTime}s`);
    window.player = new YT.Player('player', {
        height: '360',
        width: '640',
        videoId: videoId,
        playerVars: {
            'playsinline': 1,
            'controls': 0,
            'rel': 0,
            'disablekb': 1,
            'autoplay': 0,
            'start': Math.floor(startTime),
            'mute': 1
        },
        events: {
            'onReady': function(event) {
                console.log(`[CLIP] Player ready for clip ${currentWindowIndex + 1}, auto-playing`);
                // Ensure muted
                if (typeof event.target.mute === 'function') {
                    event.target.mute();
                }
                event.target.playVideo();
                startPlaybackTimer();
                feedbackMessage.textContent = `Clip ${currentWindowIndex + 1}: Guess Now!`;
            },
            'onStateChange': onPlayerStateChange
        }
    });
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
    
    // Log session end and send to server
    SessionLogger.logQuizEnd(score, answerWindows.length);
    SessionLogger.sendToServer();
}


// --- MODIFIED: resetQuiz Function ---
function resetQuiz() {
    console.log("[CLIP] ========== RESETTING QUIZ ==========");
    score = 0;
    correctAnswers = 0; // Reset correct answers
    questionsAnswered = 0; // Reset questions answered
    currentWindowIndex = 0;
    lastAnsweredClipIndex = -1;
    canAnswer = false;
    isQuizComplete = false;
    windowStartTimeStamp = null; // Reset timestamp

    updateStaticUI();
    
    // Safely update UI elements (check for null)
    if (scoreboardScoreDisplay) scoreboardScoreDisplay.textContent = score;
    if (percentageCorrectDisplay) percentageCorrectDisplay.textContent = "100%";
    if (clipTimeMsDisplay) clipTimeMsDisplay.textContent = "0";
    if (correctAnswersDisplay) correctAnswersDisplay.textContent = "0";
    if (wrongAnswersDisplay) wrongAnswersDisplay.textContent = "0";
    if (totalTimeDisplay) totalTimeDisplay.textContent = "0.0";
    if (scoreDisplay) scoreDisplay.textContent = score;
    if (feedbackMessage) feedbackMessage.textContent = "Ready for Clip 1... Press Start Clip when ready!";
    if (quizCompleteSection) quizCompleteSection.classList.add('hidden');
    
    hideButtonsContainer(); // Start with buttons hidden
    if (feedbackOverlay) feedbackOverlay.classList.add('hidden'); // Ensure overlay is hidden

    // Log the selected clips for this quiz
    console.log(`[CLIP] Selected ${answerWindows.length} clips for this quiz:`);
    answerWindows.forEach((win, idx) => {
        console.log(`[CLIP]   ${idx + 1}. Start: ${win.startTime}, Answer: ${getAnswerString(win.correctAnswer)}`);
    });

    // Cue the first clip at its start time
    const startTime = getFirstClipStartTime();
    window.desiredStartTime = startTime; // Store globally for onPlayerReady
    const firstWindow = answerWindows[0];
    console.log(`[CLIP] Cueing Clip 1 at ${firstWindow.startTime} (${startTime}s) - Answer: ${getAnswerString(firstWindow.correctAnswer)}`);
    
    // Destroy and recreate player for first clip
    if (player && typeof player.destroy === 'function') {
        player.destroy();
        player = null;
    }
    const playerContainer = document.getElementById('player');
    if (playerContainer) {
        playerContainer.innerHTML = '';
    }
    
    createOrLoadPlayer(videoId, startTime);
    
    // Show the start overlay
    if (window.startQuizOverlay) {
        window.startQuizOverlay.style.display = 'flex';
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
    console.log(`[VIDEO] startQuizForVideo called with videoId: ${newVideoId}`);
    
    // Log video selection event if we already have a session
    if (SessionLogger.sessionStart && !SessionLogger.sessionEnd) {
        SessionLogger.logEvent('VIDEO_CHANGED', { fromVideoId: videoId, toVideoId: newVideoId });
    }
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
    console.log(`[VIDEO] Video data loaded, answerWindows count: ${answerWindows.length}`);
    resetQuiz();
    showQuizUIOnly();
    // Load the new video in the player (or create if not exists) at the first clip's start time
    const startTime = getFirstClipStartTime();
    console.log(`[VIDEO] Loading player at startTime: ${startTime}s`);
    if (typeof YT !== 'undefined' && YT.Player) {
        createOrLoadPlayer(videoId, startTime);
    } else {
        // If API not loaded yet, load it
        console.log(`[VIDEO] YouTube API not ready, loading API...`);
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