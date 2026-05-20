const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const createOrder = require('./api/create-order');
const verifyPayment = require('./api/verify-payment');
const access = require('./api/access');
const purchaseStatus = require('./api/purchase-status');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '32kb' }));

// Mock Request/Response objects for Vercel functions
const createVercelHandler = (handler) => async (req, res) => {
    // Vercel functions look like (req, res) => ...
    // Express req/res are compatible enough for this basic usage
    try {
        await handler(req, res);
    } catch (error) {
        console.error('API Error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }
};

// Routes
app.all('/api/create-order', createVercelHandler(createOrder));
app.all('/api/verify-payment', createVercelHandler(verifyPayment));
app.all('/api/payments/create-order', createVercelHandler(createOrder));
app.all('/api/payments/verify', createVercelHandler(verifyPayment));
app.all('/api/access', createVercelHandler(access));
app.all('/api/purchase-status', createVercelHandler(purchaseStatus));

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
    console.log(`API Endpoints available at http://localhost:${PORT}/api/payments/create-order`);
});
