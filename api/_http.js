function setCorsHeaders(res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,Accept');
    res.setHeader('Access-Control-Max-Age', '86400');
}

function send(res, statusCode, data) {
    setCorsHeaders(res);
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(data));
}

function handleOptions(req, res) {
    if (req.method !== 'OPTIONS') {
        return false;
    }
    setCorsHeaders(res);
    res.statusCode = 204;
    res.end();
    return true;
}

module.exports = {
    handleOptions,
    send,
    setCorsHeaders,
};
