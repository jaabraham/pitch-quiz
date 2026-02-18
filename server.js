const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());

// CORS Configuration for GitHub Pages
// Update this to match your GitHub Pages URL exactly
const ALLOWED_ORIGIN = 'https://jaabraham.github.io';  // GitHub Pages origin

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
    res.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Configuration
const MAX_SCORES_PER_HOUR = 10;
const NAME_LOCK_DURATION_HOURS = 24;

// Helper: Generate hash from IP (for additional rate limiting)
function hashIP(ip) {
    return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

// Helper: Check rate limit for a fingerprint
function checkRateLimit(scores, fingerprint) {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const recentScores = scores.filter(s => 
        s.fingerprint === fingerprint && 
        new Date(s.date).getTime() > oneHourAgo
    );
    return recentScores.length < MAX_SCORES_PER_HOUR;
}

// Helper: Check name restrictions
function checkNameRestrictions(scores, name, fingerprint) {
    const normalizedName = name.toLowerCase().trim();
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    const twentyFourHoursAgo = Date.now() - (NAME_LOCK_DURATION_HOURS * 60 * 60 * 1000);
    
    // Check 1: Has this fingerprint submitted ANY score in the last hour?
    // If so, they must use the same name
    const recentScoresFromThisDevice = scores.filter(s => {
        const scoreTime = new Date(s.date).getTime();
        return s.fingerprint === fingerprint && scoreTime > oneHourAgo;
    });
    
    if (recentScoresFromThisDevice.length > 0) {
        // Device has submitted recently - must use same name
        // Sort by date descending to get most recent
        recentScoresFromThisDevice.sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastUsedName = recentScoresFromThisDevice[0].username.toLowerCase().trim();
        
        if (normalizedName !== lastUsedName) {
            return {
                allowed: false,
                message: `You must use the same name "${recentScoresFromThisDevice[0].username}" for 1 hour after submitting. Please wait before changing names.`
            };
        }
        // Name matches - allowed
        return { allowed: true };
    }
    
    // Check 2: Is this name locked to a different fingerprint?
    const recentNameUses = scores.filter(s => 
        s.username.toLowerCase().trim() === normalizedName &&
        new Date(s.date).getTime() > twentyFourHoursAgo
    );
    
    if (recentNameUses.length > 0) {
        const sameFingerprintUse = recentNameUses.find(s => s.fingerprint === fingerprint);
        if (!sameFingerprintUse) {
            // Name is locked to a different fingerprint
            return { 
                allowed: false, 
                message: `Name "${name}" is already in use. Please choose a different name.`
            };
        }
    }
    
    // Name is free and device can use it
    return { allowed: true };
}

// Endpoint to get top scores
app.get('/topscores.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'topscores.json'));
});

// Endpoint to submit a score (with fingerprint validation)
app.post('/api/scores', async (req, res) => {
    const { username, score, fingerprint } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const ipHash = hashIP(clientIP);
    
    // Validate inputs
    if (!username || typeof score !== 'number' || !fingerprint) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields: username, score, fingerprint' 
        });
    }
    
    // Validate username (alphanumeric + spaces, 2-20 chars)
    if (!/^[a-zA-Z0-9 ]{2,20}$/.test(username.trim())) {
        return res.status(400).json({ 
            success: false, 
            error: 'Name must be 2-20 characters (letters, numbers, spaces only)' 
        });
    }
    
    try {
        // Load current scores
        const scoresPath = path.join(__dirname, 'topscores.json');
        const scoresData = await fs.promises.readFile(scoresPath, 'utf8');
        let scores = JSON.parse(scoresData);
        
        // Check rate limit (10 scores per hour)
        if (!checkRateLimit(scores, fingerprint)) {
            return res.status(429).json({ 
                success: false, 
                error: 'Rate limit exceeded. Maximum 10 scores per hour. Please try again later.' 
            });
        }
        
        // Check name restrictions (same name per device per hour, 24h name lock)
        const nameCheck = checkNameRestrictions(scores, username, fingerprint);
        if (!nameCheck.allowed) {
            return res.status(403).json({ 
                success: false, 
                error: nameCheck.message 
            });
        }
        
        // Add new score
        const newScore = {
            username: username.trim(),
            score: Math.floor(score),
            fingerprint: fingerprint,
            ipHash: ipHash,
            date: new Date().toISOString()
        };
        
        scores.push(newScore);
        
        // Sort by score descending and keep top 100 (for history, return top 10)
        scores.sort((a, b) => b.score - a.score);
        const top100 = scores.slice(0, 100);
        
        // Save to file
        await fs.promises.writeFile(scoresPath, JSON.stringify(top100, null, 2));
        
        // Get top 10 for response
        const top10 = top100.slice(0, 10);
        
        // Add "isCurrentUser" flag for display
        const responseScores = top10.map(s => ({
            username: s.username,
            score: s.score,
            date: s.date,
            isCurrentUser: s.fingerprint === fingerprint
        }));
        
        res.json({ 
            success: true, 
            scores: responseScores,
            rank: top100.findIndex(s => s === newScore) + 1
        });
        
    } catch (err) {
        console.error('Error saving score:', err);
        res.status(500).json({ 
            success: false, 
            error: 'Failed to save score. Please try again.' 
        });
    }
});

// Endpoint to check if a name is available
app.get('/api/check-name', async (req, res) => {
    const { name, fingerprint } = req.query;
    
    if (!name || !fingerprint) {
        return res.status(400).json({ error: 'Missing name or fingerprint' });
    }
    
    try {
        const scoresPath = path.join(__dirname, 'topscores.json');
        const scoresData = await fs.promises.readFile(scoresPath, 'utf8');
        const scores = JSON.parse(scoresData);
        
        const nameCheck = checkNameRestrictions(scores, name, fingerprint);
        
        res.json({
            available: nameCheck.allowed,
            message: nameCheck.message || null
        });
    } catch (err) {
        res.status(500).json({ error: 'Failed to check name availability' });
    }
});

// DELETE endpoint for removing scores (dev mode only - no auth for simplicity)
app.delete('/api/scores/:index', async (req, res) => {
    const index = parseInt(req.params.index, 10);
    
    if (isNaN(index) || index < 0) {
        return res.status(400).json({ success: false, error: 'Invalid index' });
    }
    
    try {
        const scoresPath = path.join(__dirname, 'topscores.json');
        const scoresData = await fs.promises.readFile(scoresPath, 'utf8');
        let scores = JSON.parse(scoresData);
        
        if (index >= scores.length) {
            return res.status(404).json({ success: false, error: 'Score not found' });
        }
        
        // Remove the score at index
        const deleted = scores.splice(index, 1)[0];
        
        // Save updated scores
        await fs.promises.writeFile(scoresPath, JSON.stringify(scores, null, 2));
        
        res.json({ 
            success: true, 
            deleted: deleted,
            message: `Deleted score for ${deleted.username}`
        });
    } catch (err) {
        console.error('Error deleting score:', err);
        res.status(500).json({ success: false, error: 'Failed to delete score' });
    }
});

// Legacy endpoint (kept for backward compatibility, redirects to new endpoint)
app.post('/topscores.json', (req, res) => {
    res.status(410).json({ 
        error: 'This endpoint is deprecated. Use POST /api/scores instead.' 
    });
});

// Endpoint to get users (legacy, not used with fingerprint system)
app.get('/users.json', (req, res) => {
    res.json([]); // Return empty array since we don't use user accounts anymore
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
    console.log(`Rate limit: ${MAX_SCORES_PER_HOUR} scores/hour per device`);
    console.log(`Name lock: ${NAME_LOCK_DURATION_HOURS} hours`);
});
