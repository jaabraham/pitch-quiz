const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(__dirname));
app.use(express.json());

// Auto-initialize log file
async function initializeLogFile() {
    const logPath = path.join(__dirname, 'log.json');
    try {
        await fs.promises.access(logPath);
    } catch {
        await fs.promises.writeFile(logPath, '[]');
        console.log('Created new log.json file');
    }
}

// Endpoint to receive session logs
app.post('/log', async (req, res) => {
    const { fingerprint, username, sessionStart, sessionEnd, score, events, videoId, totalClips } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const ipHash = hashIP(clientIP);
    
    if (!fingerprint || !sessionStart || !events) {
        return res.status(400).json({
            success: false,
            error: 'Missing required fields'
        });
    }
    
    try {
        const logPath = path.join(__dirname, 'log.json');
        const logData = await fs.promises.readFile(logPath, 'utf8');
        let logs = JSON.parse(logData);
        
        const sessionLog = {
            id: crypto.randomUUID(),
            fingerprint: fingerprint.substring(0, 16),
            ipHash: ipHash,
            username: username || 'Anonymous',
            videoId: videoId || 'unknown',
            sessionStart: sessionStart,
            sessionEnd: sessionEnd || new Date().toISOString(),
            score: score || 0,
            totalClips: totalClips || 0,
            durationSeconds: sessionEnd 
                ? Math.round((new Date(sessionEnd) - new Date(sessionStart)) / 1000)
                : null,
            events: events,
            userAgent: req.headers['user-agent']?.substring(0, 100) || 'unknown',
            loggedAt: new Date().toISOString()
        };
        
        logs.push(sessionLog);
        
        // Keep only last 1000 sessions to prevent file bloat
        if (logs.length > 1000) {
            logs = logs.slice(-1000);
        }
        
        await fs.promises.writeFile(logPath, JSON.stringify(logs, null, 2));
        
        res.json({ success: true, sessionId: sessionLog.id });
        
    } catch (err) {
        console.error('Error saving log:', err);
        res.status(500).json({
            success: false,
            error: 'Failed to save log'
        });
    }
});

// Endpoint to get logs (dev/admin only - you can add auth later)
app.get('/log.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'log.json'));
});

// Configuration
const MAX_SCORES_PER_HOUR = 10;
const NAME_LOCK_DURATION_HOURS = 24;

// Auto-initialize scores file
async function initializeScoresFile() {
    const scoresPath = path.join(__dirname, 'topscores.json');
    try {
        await fs.promises.access(scoresPath);
    } catch {
        await fs.promises.writeFile(scoresPath, '[]');
        console.log('Created new topscores.json file');
    }
}

// Helper: Generate hash from IP
function hashIP(ip) {
    return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

// Helper: Check rate limit
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
    
    const recentScoresFromThisDevice = scores.filter(s => {
        const scoreTime = new Date(s.date).getTime();
        return s.fingerprint === fingerprint && scoreTime > oneHourAgo;
    });
    
    if (recentScoresFromThisDevice.length > 0) {
        recentScoresFromThisDevice.sort((a, b) => new Date(b.date) - new Date(a.date));
        const lastUsedName = recentScoresFromThisDevice[0].username.toLowerCase().trim();
        
        if (normalizedName !== lastUsedName) {
            return {
                allowed: false,
                message: `You must use the same name "${recentScoresFromThisDevice[0].username}" for 1 hour after submitting.`
            };
        }
        return { allowed: true };
    }
    
    const recentNameUses = scores.filter(s => 
        s.username.toLowerCase().trim() === normalizedName &&
        new Date(s.date).getTime() > twentyFourHoursAgo
    );
    
    if (recentNameUses.length > 0) {
        const sameFingerprintUse = recentNameUses.find(s => s.fingerprint === fingerprint);
        if (!sameFingerprintUse) {
            return { 
                allowed: false, 
                message: `Name "${name}" is already in use. Please choose a different name.`
            };
        }
    }
    
    return { allowed: true };
}

// Endpoint to get top scores (Nginx maps /api/topscores.json to /topscores.json)
app.get('/topscores.json', (req, res) => {
    res.sendFile(path.join(__dirname, 'topscores.json'));
});

// FIXED: Removed '/api' prefix to match Nginx proxy_pass
app.post('/scores', async (req, res) => {
    const { username, score, fingerprint } = req.body;
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    const ipHash = hashIP(clientIP);
    
    if (!username || typeof score !== 'number' || !fingerprint) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing required fields' 
        });
    }
    
    if (!/^[a-zA-Z0-9 ]{2,20}$/.test(username.trim())) {
        return res.status(400).json({ 
            success: false, 
            error: 'Name must be 2-20 characters (letters, numbers, spaces only)' 
        });
    }
    
    try {
        const scoresPath = path.join(__dirname, 'topscores.json');
        const scoresData = await fs.promises.readFile(scoresPath, 'utf8');
        let scores = JSON.parse(scoresData);
        
        if (!checkRateLimit(scores, fingerprint)) {
            return res.status(429).json({ 
                success: false, 
                error: 'Rate limit exceeded. Maximum 10 scores per hour.' 
            });
        }
        
        const nameCheck = checkNameRestrictions(scores, username, fingerprint);
        if (!nameCheck.allowed) {
            return res.status(403).json({ 
                success: false, 
                error: nameCheck.message 
            });
        }
        
        const newScore = {
            username: username.trim(),
            score: Math.floor(score),
            fingerprint: fingerprint,
            ipHash: ipHash,
            date: new Date().toISOString()
        };
        
        scores.push(newScore);
        scores.sort((a, b) => b.score - a.score);
        const top100 = scores.slice(0, 100);
        
        await fs.promises.writeFile(scoresPath, JSON.stringify(top100, null, 2));
        
        const top10 = top100.slice(0, 10);
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
            error: 'Failed to save score' 
        });
    }
});

// FIXED: Removed '/api' prefix to match Nginx proxy_pass
app.delete('/scores/:index', async (req, res) => {
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
        
        const deleted = scores.splice(index, 1)[0];
        await fs.promises.writeFile(scoresPath, JSON.stringify(scores, null, 2));
        
        res.json({ 
            success: true, 
            deleted: deleted 
        });
    } catch (err) {
        console.error('Error deleting score:', err);
        res.status(500).json({ success: false, error: 'Failed to delete score' });
    }
});

// Initialize and start
Promise.all([initializeScoresFile(), initializeLogFile()]).then(() => {
    app.listen(PORT, () => {
        console.log(`Server running at http://localhost:${PORT}`);
    });
});