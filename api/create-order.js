const Razorpay = require('razorpay');
const { verifyIdToken } = require('./_services');
const { handleOptions, send } = require('./_http');

const PRODUCT_PRICE_PAISE = 900;

function getRazorpayClient() {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Missing Razorpay credentials');
    }

    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
}

function normalizeAmount(value) {
    if (value === undefined || value === null || value === '') {
        return PRODUCT_PRICE_PAISE;
    }

    const amount = Number(value);
    if (!Number.isInteger(amount) || amount < 100) {
        return null;
    }

    return amount;
}

module.exports = async function (req, res) {
    if (handleOptions(req, res)) {
        return;
    }

    // Allow only POST
    if (req.method !== 'POST') {
        return send(res, 405, { error: 'Method not allowed' });
    }

    // 1. Verify User
    let uid;
    let customerPhone = '';
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return send(res, 401, { error: 'Unauthorized: Missing token' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = await verifyIdToken(token);
        uid = decoded.uid;
        customerPhone = decoded.phone_number || '';
    } catch (error) {
        console.error('Auth error:', error);
        return send(res, 401, { error: 'Unauthorized: Invalid token' });
    }

    try {
        const amount = normalizeAmount(req.body && req.body.amount);
        if (!amount) {
            return send(res, 400, { error: 'Amount must be an integer of at least 100 paise' });
        }

        const requestPhone = req.body && typeof req.body.phone === 'string' ? req.body.phone : '';
        const requestedReceipt = req.body && typeof req.body.receipt === 'string' ? req.body.receipt.trim() : '';
        const currency = req.body && typeof req.body.currency === 'string'
            ? req.body.currency.trim().toUpperCase()
            : 'INR';

        const options = {
            amount,
            currency,
            receipt: requestedReceipt || `order_${Date.now()}_${uid.substring(0, 5)}`,
            payment_capture: 1,
            notes: {
                product: 'HabitOS Google Sheets Habit Tracker',
                phone: requestPhone || customerPhone,
                uid
            }
        };

        const razorpay = getRazorpayClient();
        const order = await razorpay.orders.create(options);

        return send(res, 200, {
            order_id: order.id,
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Create Order Error:', error);
        const statusCode = error && (error.statusCode || error.status);
        if (statusCode === 401) {
            return send(res, 401, { error: 'Razorpay authentication failed' });
        }
        return send(res, 500, { error: 'Internal Server Error' });
    }
};
