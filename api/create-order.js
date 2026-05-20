const Razorpay = require('razorpay');
const { verifyIdToken } = require('./_services');
const { guard, handleOptions, requireAuthHeader, send } = require('./_http');

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

module.exports = async function (req, res) {
    if (handleOptions(req, res)) {
        return;
    }
    if (guard(req, res, ['POST'])) {
        return;
    }

    let uid;
    try {
        const token = requireAuthHeader(req);
        if (!token) {
            return send(req, res, 401, { error: 'Unauthorized' });
        }
        const decoded = await verifyIdToken(token);
        uid = decoded.uid;
    } catch (error) {
        console.error('Auth error:', error);
        return send(req, res, 401, { error: 'Unauthorized' });
    }

    try {
        const options = {
            amount: PRODUCT_PRICE_PAISE,
            currency: 'INR',
            receipt: `order_${Date.now()}_${uid.substring(0, 5)}`,
            payment_capture: 1,
            notes: {
                product: 'HabitOS Google Sheets Habit Tracker',
                uid
            }
        };

        const razorpay = getRazorpayClient();
        const order = await razorpay.orders.create(options);

        return send(req, res, 200, {
            order_id: order.id,
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID,
        });

    } catch (error) {
        console.error('Create Order Error:', error);
        const statusCode = error && (error.statusCode || error.status);
        if (statusCode === 401) {
            return send(req, res, 401, { error: 'Payment provider authentication failed' });
        }
        return send(req, res, 500, { error: 'Internal Server Error' });
    }
};
