# Pitch Recognition Quiz

A baseball pitch recognition game where players identify fastballs vs offspeed pitches from video clips.

## Features

- 🎥 YouTube video integration for pitch recognition drills
- 🏆 Anonymous high score system with device fingerprinting
- 🔒 Rate limiting: 10 scores/hour per device
- 🔐 Name locking: One name per device per hour
- 📱 Mobile-responsive design

## Local Development

```bash
npm install
npm start
# Open http://localhost:3000
```

## Deploy to Render (Free Tier)

### Step 1: Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/pitch-quiz.git
git push -u origin main
```

### Step 2: Create Render Account

1. Go to [render.com](https://render.com) and sign up (free)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository

### Step 3: Configure Render Service

| Setting | Value |
|---------|-------|
| **Name** | pitch-recognition-quiz |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free |

Click "Create Web Service"

### Step 4: Wait for Deployment

Render will automatically:
- Install dependencies (`npm install`)
- Start the server (`npm start`)
- Assign a URL like `https://pitch-recognition-quiz.onrender.com`

### Step 5: Test Your App

Visit your assigned URL and play!

## Important Notes for Render Free Tier

⚠️ **Free tier spins down after 15 minutes of inactivity.**
- First request after inactivity may take 30-60 seconds to wake up
- High scores are persisted to disk and will survive restarts

## File Structure

```
├── index.html       # Main UI
├── script.js        # Quiz logic
├── style.css        # Styling
├── server.js        # Express server
├── videos.json      # Video configurations
├── topscores.json   # High scores (auto-updated)
└── package.json     # Dependencies
```

## How Scoring Works

- Each correct guess: up to 1000 points
- Faster reaction = more points
- 15-24 pitches per video depending on selection
- Top 10 scores appear on the leaderboard

## Security Features

- **Device Fingerprinting**: Anonymous browser-based ID
- **Rate Limiting**: Max 10 scores/hour per device
- **Name Locking**: One name per device for 1 hour after first submission
- **Name Reservation**: Names locked to devices for 24 hours
