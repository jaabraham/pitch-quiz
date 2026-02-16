# Pitch Recognition Quiz

A baseball pitch recognition game where players identify fastballs vs offspeed pitches from video clips. Built with vanilla JavaScript, Express, and anonymous fingerprint-based authentication.

**Live Demo**: https://pitch-quiz.onrender.com

---

## Table of Contents

1. [How the App Works](#how-the-app-works)
2. [Features](#features)
3. [Local Development](#local-development)
4. [Deployment Guide](#deployment-guide)
   - [GitHub Setup](#github-setup)
   - [Render.com Deployment](#rendercom-deployment)
5. [Architecture](#architecture)
6. [Security Features](#security-features)
7. [Changelog](#changelog)
8. [Troubleshooting](#troubleshooting)

---

## How the App Works

### Game Flow

1. **Front Page**: User sees leaderboard and video selection thumbnails
2. **Video Selection**: Click a pitcher thumbnail to start a quiz
3. **Quiz Game**: 
   - YouTube video plays showing pitching drills
   - During specific time windows, "Fastball" and "Offspeed" buttons appear
   - Player clicks their guess before the window expires
   - Immediate feedback: "CORRECT" or "WRONG" overlay
4. **Scoring**:
   - Correct answer: up to 1000 points based on reaction time
   - Faster response = more points
   - Missed window = 0 points, counts as wrong
5. **High Scores**: Qualifying scores prompt for name entry (no login required)

### Answer Windows

Each video has predefined "answer windows" in `videos.json`:

```json
{
  "startTime": "0:10",
  "correctAnswer": 1,
  "clipIndex": 0
}
```

- `startTime`: When the guess window opens (MM:SS format)
- `correctAnswer`: 1 = Fastball, 2 = Offspeed
- `clipIndex`: Sequential clip number

---

## Features

- 🎥 **YouTube Integration**: Embedded pitching drill videos
- 🏆 **Anonymous Leaderboard**: No login/password required
- 🔒 **Anti-Gaming Protection**: 
  - Rate limiting (10 scores/hour per device)
  - Name locking (1 name per device per hour)
  - Name reservation (24-hour lock to device)
- 📱 **Mobile Responsive**: Works on phones, tablets, desktop
- 🎮 **Real-time Feedback**: Visual overlay for correct/wrong answers
- 📊 **Score Stats**: Tracks correct %, total time, clip timing

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

# Start the server
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
├── package.json            # Dependencies and scripts
├── videos.json             # Video configurations with answer windows
├── topscores.json          # High scores database
├── topscores_backup.json   # Original scores backup
├── render.yaml             # Render deployment config
├── .gitignore              # Git ignore rules
└── README.md               # This file
```

---

## Deployment Guide

### GitHub Setup

#### Step 1: Create GitHub Repository

1. Go to https://github.com/new
2. **Repository name**: `pitch-quiz`
3. **Description**: (optional) "Baseball pitch recognition quiz"
4. Choose **Public** or **Private**
5. ⚠️ **UNCHECK** all initialization options:
   - [ ] Add a README file
   - [ ] Add .gitignore
   - [ ] Choose a license
6. Click **"Create repository"**

#### Step 2: Create Personal Access Token

1. Go to https://github.com/settings/tokens
2. Click **"Generate new token (classic)"**
3. **Note**: "Pitch Quiz Deploy"
4. **Expiration**: 30 days (or custom)
5. **Scopes**: Check only **`repo`** (full control of private repositories)
6. Click **"Generate token"**
7. **COPY THE TOKEN IMMEDIATELY** (you won't see it again!)

#### Step 3: Push Local Code to GitHub

```bash
# Navigate to project directory
cd /path/to/pitch-quiz

# Initialize git (if not already done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit"

# Add remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/pitch-quiz.git

# Push to GitHub
git push -u origin master

# When prompted:
# Username: YOUR_USERNAME
# Password: YOUR_PERSONAL_ACCESS_TOKEN (paste it, won't show characters)
```

**Verify**: Visit https://github.com/YOUR_USERNAME/pitch-quiz to confirm files uploaded.

---

### Render.com Deployment

#### Step 1: Create Render Account

1. Go to https://render.com
2. Sign up with GitHub (recommended) or email
3. Verify your account

#### Step 2: Create Web Service

1. From Render Dashboard, click **"New +"** (top right)
2. Select **"Web Service"**
3. Click **"Connect GitHub"** and authorize Render
4. Find and select your **`pitch-quiz`** repository

#### Step 3: Configure Service

| Setting | Value |
|---------|-------|
| **Name** | `pitch-quiz` (or any name you prefer) |
| **Runtime** | `Node` |
| **Region** | Choose closest to your users |
| **Branch** | `master` (or `main` if you renamed it) |
| **Root Directory** | (leave empty) |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | **Free** |

#### Step 4: Deploy

1. Click **"Create Web Service"**
2. Wait for build to complete (2-3 minutes)
3. Render will provide a URL like: `https://pitch-quiz.onrender.com`

#### Step 5: Verify Deployment

1. Visit your assigned URL
2. Test the quiz:
   - Click a video thumbnail
   - Click "Start Quiz"
   - Click "🧪 Test High Score (9999)" button
   - Enter a name and submit
3. Check that your name appears on the leaderboard

---

## Architecture

### Tech Stack

| Component | Technology |
|-----------|------------|
| Frontend | Vanilla HTML, CSS, JavaScript |
| Backend | Node.js, Express |
| Video | YouTube IFrame API |
| Auth | Anonymous device fingerprinting |
| Storage | JSON files (topscores.json) |
| Hosting | Render (free tier) |

### Data Flow

```
User Browser                    Render Server
     |                                |
     |-- 1. Load page -------------->|
     |<-- 2. Return index.html --------|
     |                                |
     |-- 3. Fetch videos.json ------->|
     |<-- 4. Return video configs ----|
     |                                |
     |-- 5. Fetch topscores.json ---->|
     |<-- 6. Return leaderboard ------|
     |                                |
     |-- 7. POST /api/scores -------->|
     |    {name, score, fingerprint}  |
     |<-- 8. Return updated scores ---|
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

### Version 1.0.0 (Current)

**Date**: 2026-02-16

**Features**:
- Initial release
- Anonymous fingerprint-based scoring system
- Rate limiting: 10 scores/hour per device
- Name locking: 1 name per device per hour
- YouTube video integration
- Mobile responsive design
- Test high score button (for development)

**Security**:
- Device fingerprinting for anonymous tracking
- IP hash for additional rate limiting
- Input sanitization on name field

**Deployment**:
- Render.com compatible
- Environment-based port configuration
- Blueprint file (`render.yaml`)

### Known Issues / TODO

- [ ] YouTube API sometimes fails to load on slow connections
- [ ] Free tier has 30-60s cold start time on Render
- [ ] Scores reset if Render instance restarts (disk is ephemeral on free tier)
- [ ] No admin panel for managing videos/scores

### Future Enhancements (Ideas)

- [ ] Add more pitch types (slider, changeup, etc.)
- [ ] User statistics page (personal best, average reaction time)
- [ ] Difficulty levels (faster windows, more pitch types)
- [ ] Admin panel for adding new videos
- [ ] Export scores to CSV
- [ ] Dark/light theme toggle
- [ ] Sound effects for correct/wrong answers

---

## Troubleshooting

### Local Development Issues

| Issue | Solution |
|-------|----------|
| `Error: Cannot find module 'express'` | Run `npm install` |
| Port 3000 already in use | Change `PORT` in server.js or kill other process |
| Changes not reflecting | Clear browser cache, hard refresh (Ctrl+Shift+R) |

### Render Deployment Issues

| Issue | Solution |
|-------|----------|
| Build fails | Check that `package.json` has correct `"start"` script |
| "Application Error" | Check Render logs (Dashboard → Logs) |
| Site slow to load | Normal for free tier after idle; first request wakes server |
| Scores not persisting | Expected on free tier (disk is ephemeral) |
| High scores not updating | Check browser console for API errors |

### Git Push Issues

| Issue | Solution |
|-------|----------|
| "Repository not found" | Create the repo on GitHub first |
| "src refspec main does not match" | Use `git push -u origin master` (not main) |
| Authentication fails | Use Personal Access Token, not password |

### Game Issues

| Issue | Solution |
|-------|----------|
| Video not loading | Check YouTube URL in `videos.json` |
| Buttons don't appear | Check browser console for JavaScript errors |
| Score not submitting | Check if rate limit reached (10/hour) |
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

**Last Updated**: 2026-02-16
