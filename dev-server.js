const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 3000;

// Helper: Generate hash from IP
function hashIP(ip) {
    return crypto.createHash('sha256').update(ip).digest('hex').substring(0, 16);
}

// Ensure log.json exists
if (!fs.existsSync('log.json')) {
    fs.writeFileSync('log.json', '[]');
}

// Ensure topscores.json exists
if (!fs.existsSync('topscores.json')) {
    fs.writeFileSync('topscores.json', '[]');
}

const server = http.createServer((req, res) => {
    console.log(new Date().toISOString(), req.method, req.url);
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // Handle POST /api/log
    if (req.url === '/api/log' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const logs = JSON.parse(fs.readFileSync('log.json', 'utf8') || '[]');
                
                const clientIP = req.connection.remoteAddress || 'unknown';
                const ipHash = hashIP(clientIP);
                
                const sessionLog = {
                    id: crypto.randomUUID(),
                    fingerprint: data.fingerprint?.substring(0, 16) || 'unknown',
                    ipHash: ipHash,
                    username: data.username || 'Anonymous',
                    videoId: data.videoId || 'unknown',
                    sessionStart: data.sessionStart,
                    sessionEnd: data.sessionEnd || new Date().toISOString(),
                    score: data.score || 0,
                    totalClips: data.totalClips || 0,
                    durationSeconds: data.sessionEnd 
                        ? Math.round((new Date(data.sessionEnd) - new Date(data.sessionStart)) / 1000)
                        : null,
                    events: data.events || [],
                    userAgent: req.headers['user-agent']?.substring(0, 100) || 'unknown',
                    loggedAt: new Date().toISOString()
                };
                
                logs.push(sessionLog);
                
                // Keep only last 1000 sessions
                if (logs.length > 1000) {
                    logs = logs.slice(-1000);
                }
                
                fs.writeFileSync('log.json', JSON.stringify(logs, null, 2));
                console.log('Log saved:', sessionLog.username, 'Score:', sessionLog.score);
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, sessionId: sessionLog.id }));
            } catch (e) {
                console.error('Log error:', e);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }
    
    // Handle GET /api/log.json
    if (req.url === '/api/log.json' && req.method === 'GET') {
        try {
            const logs = fs.readFileSync('log.json', 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(logs);
        } catch (e) {
            res.writeHead(500);
            res.end('Error reading log');
        }
        return;
    }
    
    // Handle GET /api/topscores.json
    if (req.url === '/api/topscores.json' && req.method === 'GET') {
        try {
            const scores = fs.readFileSync('topscores.json', 'utf8');
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(scores);
        } catch (e) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end('[]');
        }
        return;
    }
    
    // Handle POST /api/scores
    if (req.url === '/api/scores' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const scores = JSON.parse(fs.readFileSync('topscores.json', 'utf8') || '[]');
                
                const clientIP = req.connection.remoteAddress || 'unknown';
                
                scores.push({
                    username: data.username,
                    score: Math.floor(data.score),
                    fingerprint: data.fingerprint,
                    ipHash: hashIP(clientIP),
                    date: new Date().toISOString()
                });
                
                scores.sort((a, b) => b.score - a.score);
                const top100 = scores.slice(0, 100);
                
                fs.writeFileSync('topscores.json', JSON.stringify(top100, null, 2));
                
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true }));
            } catch (e) {
                res.writeHead(500);
                res.end('Error');
            }
        });
        return;
    }
    
    // Handle DELETE /api/scores/:index
    if (req.url.startsWith('/api/scores/') && req.method === 'DELETE') {
        try {
            const index = parseInt(req.url.split('/').pop());
            const scores = JSON.parse(fs.readFileSync('topscores.json', 'utf8') || '[]');
            scores.splice(index, 1);
            fs.writeFileSync('topscores.json', JSON.stringify(scores, null, 2));
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true }));
        } catch (e) {
            res.writeHead(500);
            res.end('Error');
        }
        return;
    }
    
    // Static files
    let filePath = req.url === '/' ? 'index.html' : req.url;
    filePath = filePath.split('?')[0]; // Remove query params
    
    const fullPath = path.join(__dirname, filePath);
    const ext = path.extname(fullPath);
    const contentType = {
        '.html': 'text/html',
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.json': 'application/json',
        '.ico': 'image/x-icon'
    }[ext] || 'text/plain';
    
    try {
        const content = fs.readFileSync(fullPath);
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
    } catch (e) {
        console.log('Not found:', fullPath);
        res.writeHead(404);
        res.end('Not found');
    }
});

server.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════╗
║  PitchApp Dev Server running!                  ║
║                                                ║
║  Open: http://localhost:${PORT}                    ║
║                                                ║
║  Press Ctrl+C to stop                         ║
╚════════════════════════════════════════════════╝
    `);
});
