const WINDOW_MS = 60 * 1000;
const RATE_LIMITS = {
    GET: 120,
    POST: 30,
};

const buckets = new Map();

function getAllowedOrigins() {
    const configured = process.env.ALLOWED_ORIGINS || process.env.APP_ALLOWED_ORIGINS || '';
    const defaults = [
        'https://www.habbitos.store',
        'https://habbitos.store',
        'http://localhost:3000',
        'http://127.0.0.1:3000',
    ];

    return new Set(
        defaults
            .concat(configured.split(','))
            .map((origin) => origin.trim())
            .filter(Boolean)
    );
}

function getRequestOrigin(req) {
    return (req.headers && (req.headers.origin || req.headers.Origin)) || '';
}

function isAllowedOrigin(req) {
    const origin = getRequestOrigin(req);
    if (!origin) {
        return true;
    }
    return getAllowedOrigins().has(origin);
}

function setCorsHeaders(req, res) {
    const origin = getRequestOrigin(req);
    res.setHeader('Vary', 'Origin');
    if (origin && isAllowedOrigin(req)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');
    res.setHeader('Access-Control-Max-Age', '600');
}

function getClientIp(req) {
    const forwardedFor = req.headers && (req.headers['x-forwarded-for'] || req.headers['X-Forwarded-For']);
    if (typeof forwardedFor === 'string' && forwardedFor) {
        return forwardedFor.split(',')[0].trim();
    }
    return (req.socket && req.socket.remoteAddress) || 'unknown';
}

function checkRateLimit(req) {
    const method = req.method || 'GET';
    const limit = RATE_LIMITS[method] || 60;
    const key = `${getClientIp(req)}:${method}:${req.url || ''}`;
    const now = Date.now();
    const current = buckets.get(key);

    if (!current || current.expiresAt <= now) {
        buckets.set(key, { count: 1, expiresAt: now + WINDOW_MS });
        return { allowed: true };
    }

    current.count += 1;
    if (current.count > limit) {
        return {
            allowed: false,
            retryAfter: Math.max(1, Math.ceil((current.expiresAt - now) / 1000)),
        };
    }

    return { allowed: true };
}

function send(req, res, statusCode, data) {
    setCorsHeaders(req, res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.end(JSON.stringify(data));
}

function reject(req, res, statusCode, message) {
    send(req, res, statusCode, { error: message });
    return true;
}

function handleOptions(req, res) {
    if (req.method !== 'OPTIONS') {
        return false;
    }
    if (!isAllowedOrigin(req)) {
        return reject(req, res, 403, 'Forbidden');
    }
    setCorsHeaders(req, res);
    res.statusCode = 204;
    res.end();
    return true;
}

function guard(req, res, allowedMethods) {
    if (!isAllowedOrigin(req)) {
        return reject(req, res, 403, 'Forbidden');
    }

    if (Array.isArray(allowedMethods) && allowedMethods.indexOf(req.method) === -1) {
        res.setHeader('Allow', allowedMethods.join(','));
        return reject(req, res, 405, 'Method not allowed');
    }

    const rate = checkRateLimit(req);
    if (!rate.allowed) {
        res.setHeader('Retry-After', String(rate.retryAfter));
        return reject(req, res, 429, 'Too many requests');
    }

    return false;
}

function requireAuthHeader(req) {
    const authHeader = req.headers && req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return '';
    }
    return authHeader.slice('Bearer '.length).trim();
}

module.exports = {
    guard,
    handleOptions,
    requireAuthHeader,
    send,
    setCorsHeaders,
};
