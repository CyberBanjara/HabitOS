const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const createOrder = require('./api/create-order');
const verifyPayment = require('./api/verify-payment');
const access = require('./api/access');
const purchaseStatus = require('./api/purchase-status');
const envHandler = require('./api/env');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());

// Mock Request/Response objects for Vercel functions
const createVercelHandler = (handler) => async (req, res) => {
    // Vercel functions look like (req, res) => ...
    // Express req/res are compatible enough for this basic usage
    try {
        await handler(req, res);
    } catch (error) {
        console.error('API Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: error.message });
        }
    }
};

// Routes
app.get('/api/env', createVercelHandler(envHandler));
app.post('/api/create-order', createVercelHandler(createOrder));
app.post('/api/verify-payment', createVercelHandler(verifyPayment));
app.get('/api/access', createVercelHandler(access));
app.get('/api/purchase-status', createVercelHandler(purchaseStatus));

app.use(express.static(path.join(__dirname, '.')));

// Serve index.html for the root
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// 404 fallback for unmatched routes
app.use((req, res) => {
    res.status(404).send('Not Found');
});

app.listen(PORT, () => {
    console.log(`Local Development Server running on http://localhost:${PORT}`);
    console.log(`API Endpoints available at http://localhost:${PORT}/api/create-order`);
});
