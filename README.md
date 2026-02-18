# Pitch Recognition Quiz

A baseball pitch recognition game where players identify fastballs vs offspeed pitches from video clips. Built with vanilla JavaScript, Express, and anonymous fingerprint-based authentication.

**Live Demo**: https://jaabraham.github.io/pitch-quiz/

---

## Table of Contents

1. [How the App Works](#how-the-app-works)
2. [Features](#features)
3. [Architecture Overview](#architecture-overview)
4. [Deployment Setup](#deployment-setup)
   - [Step 1: Deploy Frontend to GitHub Pages](#step-1-deploy-frontend-to-github-pages)
   - [Step 2: Deploy Backend to Render](#step-2-deploy-backend-to-render)
   - [Step 3: Connect Frontend to Backend](#step-3-connect-frontend-to-backend)
5. [Local Development](#local-development)
6. [Security Features](#security-features)
7. [Changelog](#changelog)
8. [Troubleshooting](#troubleshooting)

---

## How the App Works

### Game Flow

1. **Front Page**: User sees compact header (logo + title), leaderboard, and video selection thumbnails
2. **Video Selection**: Click a pitcher thumbnail to start a quiz
3. **Quiz Game**:
   - 5 random clips are selected from the video (different each time!)
   - YouTube video loads at the exact clip start time (muted)
   - **Clip 1**: Click "Start Clip" button to begin
   - **Clips 2-5**: Auto-play immediately after answering previous clip
   - "Fastball" and "Offspeed" buttons appear during the clip
   - Player clicks their guess - immediate feedback shows "CORRECT" or "WRONG" overlay
4. **Scoring**:
   - Correct answer: up to 1000 points based on reaction time
   - Faster response = more points
   - Missed window = 0 points, counts as wrong
5. **High Scores**: Qualifying scores prompt for name entry (no login required)

### Answer Windows

Each video has predefined "answer windows" in `videos.json`:

```json
{
  "videoId": "8ZYPZIwj2u0",
  "description": "Pitch Recognition Drill 1",
  "answerWindows": [
    { "startTime": "0:10", "correctAnswer": 2, "clipIndex": 0 },
    { "startTime": "0:21", "correctAnswer": 1, "clipIndex": 1 }
  ]
}
```

- `videoId`: YouTube video ID
- `startTime`: When the guess window opens (MM:SS format)
- `correctAnswer`: 1 = Fastball, 2 = Offspeed
- `clipIndex`: Sequential clip number in the original video

### Random Clip Selection

Each quiz session randomly selects **5 clips** from all available clips in the video:
- Prevents memorization of answers
- Creates varied gameplay experience
- Clips are sorted chronologically after random selection
- The player destroys and recreates the YouTube player for each clip to ensure accurate timing

---

## Features

- 🎥 **YouTube Integration**: Embedded pitching drill videos (muted)
- 🎲 **Random Clip Selection**: 5 random clips per quiz (different each time)
- 🏆 **Anonymous Leaderboard**: No login/password required
- 🔇 **Muted Audio**: All videos play silently
- 📱 **Mobile Responsive**: Works on phones, tablets, desktop
- 🎮 **Real-time Feedback**: Visual overlay for correct/wrong answers
- 📊 **Score Stats**: Tracks correct %, total time, clip timing
- 🔒 **Anti-Gaming Protection**:
  - Rate limiting (10 scores/hour per device)
  - Name locking (1 name per device per hour)
  - Name reservation (24-hour lock to device)

---

## Architecture Overview

### Two-Deployment Architecture

This app uses a **hybrid deployment approach** for optimal performance and cost:

| Component | Platform | Purpose | Why |
|-----------|----------|---------|-----|
| **Frontend** | GitHub Pages | Static files (HTML, CSS, JS) | Free, fast, no cold start |
| **Backend API** | Render.com | Score submission, leaderboard | Dynamic data, file storage |

### Data Flow

```
User Browser
     │
     ├──► GitHub Pages (Frontend)
     │    ├── index.html
     │    ├── script.js
     │    └── style.css
     │
     ├──► YouTube (Videos - Muted)
     │
     └──► Render.com (Backend API)
          ├── POST /api/scores (submit score)
          ├── GET /topscores.json (leaderboard)
          └── GET /api/check-name (name validation)
```

### Fingerprint Generation

Each browser gets a unique ID stored in `localStorage`:

```javascript
const components = [
    navigator.userAgent,
    screen.width + 'x' + screen.height,
    screen.colorDepth,
    navigator.language,
    new Date().getTimezoneOffset(),
    Math.random().toString(36).substring(2, 15)
];
const fingerprint = btoa(components.join('|')).substring(0, 32);
```

This allows tracking without cookies or logins.

---

## Deployment Setup

### Prerequisites

1. GitHub account (free)
2. Render.com account (free tier)
3. This repository pushed to GitHub

---

### Step 1: Deploy Frontend to GitHub Pages

1. Push your code to GitHub:
   ```bash
   git push origin master
   ```

2. Go to your repository on GitHub: `https://github.com/jaabraham/pitch-quiz`

3. Click **Settings** → **Pages** (in left sidebar)

4. Under "Source", select:
   - **Branch**: `master`
   - **Folder**: `/ (root)`

5. Click **Save**

6. Wait 1-2 minutes for deployment

7. Your site will be at: `https://jaabraham.github.io/pitch-quiz/`

**Note**: The leaderboard won't work yet - you need to deploy the backend (Step 2).

---

### Step 2: Deploy Backend to Render

1. Go to https://render.com and sign up (use GitHub login for ease)

2. From Dashboard, click **"New +"** → **"Web Service"**

3. Click **"Connect GitHub"** and authorize Render

4. Find and select your **`pitch-quiz`** repository

5. Configure the service:

   | Setting | Value |
   |---------|-------|
   | **Name** | `pitch-quiz-api` |
   | **Runtime** | `Node` |
   | **Region** | Choose closest to your users |
   | **Branch** | `master` |
   | **Build Command** | `npm install` |
   | **Start Command** | `npm start` |
   | **Plan** | **Free** |

6. Click **"Create Web Service"**

7. Wait for build to complete (2-3 minutes)

8. Your Render URL is: `https://pitch-quiz.onrender.com`

9. **Copy this URL** - you'll need it for Step 3

---

### Step 3: Connect Frontend to Backend

You need to update the frontend code to point to your Render backend URL.

#### Option A: Update API URL in index.html

1. Open `index.html` in your code editor

2. Find the JavaScript section with the API calls (around line 460)

3. Update the API base URL to your Render URL:

   ```javascript
   // Change from:
   fetch('/topscores.json', ...)
   
   // To:
   fetch('https://pitch-quiz-api.onrender.com/topscores.json', ...)
   ```

4. Do this for all API endpoints:
   - `/topscores.json` → `https://pitch-quiz.onrender.com/topscores.json`
   - `/api/scores` → `https://pitch-quiz.onrender.com/api/scores`
   - `/api/check-name` → `https://pitch-quiz.onrender.com/api/check-name`

#### Option B: Use a Config Variable (Recommended)

Add this near the top of the JavaScript in `index.html`:

```javascript
// API Configuration
const API_BASE = 'https://pitch-quiz.onrender.com';  // Your Render backend URL

// Then use API_BASE in all fetch calls:
fetch(`${API_BASE}/topscores.json`)
fetch(`${API_BASE}/api/scores`, {method: 'POST', ...})
fetch(`${API_BASE}/api/check-name?name=${name}`)
```

#### Update CORS in server.js

Your Render backend needs to allow requests from GitHub Pages. Update `server.js`:

```javascript
// Add CORS middleware before your routes
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://jaabraham.github.io');
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});
```

#### Redeploy After Changes

1. Commit and push your changes:
   ```bash
   git add .
   git commit -m "Update API URLs for GitHub Pages deployment"
   git push origin master
   ```

2. Render will automatically redeploy (takes ~2 minutes)

3. GitHub Pages will update automatically (takes ~1 minute)

4. Test your site!

---

## Local Development

### Prerequisites

- Node.js 18+ installed
- Git installed

### Setup

```bash
# Clone the repository
git clone https://github.com/jaabraham/pitch-quiz.git
cd pitch-quiz

# Install dependencies
npm install

# Start the server (backend will run on localhost:3000)
npm start

# Open browser to http://localhost:3000
```

### File Structure

```
pitch-quiz/
├── index.html              # Main UI and frontend logic
├── script.js               # Quiz game logic, YouTube API
├── style.css               # Styling
├── server.js               # Express server, API endpoints
├── videos.json             # Video configurations with answer windows
├── topscores.json          # High scores database
├── package.json            # Dependencies and scripts
├── render.yaml             # Render deployment config
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

---

## Security Features

### Rate Limiting

- **10 scores per hour per device** (by fingerprint)
- Prevents spam flooding of leaderboard

### Name Locking (1 Hour)

- After submitting a score, device is locked to that name for 1 hour
- Prevents same user from using multiple names

### Name Reservation (24 Hours)

- Names are locked to the first device that uses them for 24 hours
- Prevents name impersonation/squatting

### Input Validation

- Names must be 2-20 characters
- Only alphanumeric characters and spaces allowed
- No special characters or HTML tags

---

## Changelog

### Version 1.1.7 (Current) - 2026-02-17

**Major Changes**:
- 🎲 **Random Clip Selection**: Each quiz now randomly selects 5 clips from all available clips, preventing memorization
- 🔇 **Muted Audio**: All videos now play silently
- 🎯 **Auto-play Clips 2-5**: Only the first clip requires clicking "Start Clip"; subsequent clips auto-play
- 🎨 **Compact Header Layout**: Logo and title now side-by-side with less blank space
- 🛠️ **Fixed Timing Issues**: Player now destroys and recreates for each clip to ensure accurate start times
- 📝 **Updated Documentation**: Complete rewrite for GitHub Pages + Render hybrid deployment

**Technical Improvements**:
- YouTube player now explicitly seeks to correct time and verifies position
- Better error handling for null DOM elements
- Removed old `pitch/` directory with unused local video files
- Added extensive console logging for debugging

### Version 1.0.0 (Original)

**Date**: 2026-02-16

**Features**:
- Initial release
- Anonymous fingerprint-based scoring system
- Rate limiting: 10 scores/hour per device
- Name locking: 1 name per device per hour
- YouTube video integration
- Mobile responsive design

---

## Troubleshooting

### Local Development Issues

| Issue | Solution |
|-------|----------|
| `Error: Cannot find module 'express'` | Run `npm install` |
| Port 3000 already in use | Change `PORT` in server.js or kill other process |
| Changes not reflecting | Clear browser cache, hard refresh (Ctrl+Shift+R) |

### GitHub Pages Issues

| Issue | Solution |
|-------|----------|
| Site not appearing | Check that GitHub Pages is enabled in Settings → Pages |
| 404 errors | Ensure `index.html` is at root and branch is correct |
| Changes not showing | GitHub Pages can take 1-5 minutes to update |

### Render Backend Issues

| Issue | Solution |
|-------|----------|
| "Application Error" | Check Render logs (Dashboard → Logs) |
| Site slow to load | Normal for free tier after idle; first request wakes server |
| Scores not persisting | Expected on free tier (disk is ephemeral) |
| CORS errors | Update `Access-Control-Allow-Origin` in server.js to match your GitHub Pages URL exactly |
| Build fails | Check that `package.json` has correct `"start"` script |

### Cross-Origin (CORS) Issues

If you see errors like:
```
Access to fetch at 'https://pitch-quiz-api.onrender.com/...' 
from origin 'https://jaabraham.github.io' has been blocked by CORS policy
```

**Solution**: Update `server.js` with your exact GitHub Pages URL:

```javascript
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', 'https://jaabraham.github.io');
    // NOT 'https://jaabraham.github.io/' (trailing slash matters!)
    // NOT '*' (won't work with credentials)
});
```

### Game Issues

| Issue | Solution |
|-------|----------|
| Video not loading | Check YouTube URL in `videos.json` |
| Video starts at wrong time | This is a known YouTube API timing issue; the player recreates for each clip to minimize this |
| Buttons don't appear | Check browser console for JavaScript errors |
| Score not submitting | Check if rate limit reached (10/hour), check console for API errors |
| Name rejected | Must be 2-20 chars, alphanumeric + spaces only |

---

## License

MIT License - Feel free to use, modify, and distribute.

---

## Contact

For questions or issues:
- GitHub Issues: https://github.com/jaabraham/pitch-quiz/issues
- Created by: jaabraham

---

**Last Updated**: 2026-02-17 (v1.1.7)
