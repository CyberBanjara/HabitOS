const Razorpay = require('razorpay');
const { verifyIdToken } = require('./_services');
const { handleOptions, send } = require('./_http');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

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
        // For fixed-price product (Habit Tracker Excel Sheet = ₹9)
        // Amount in paise: ₹9 = 900 paise
        const PRODUCT_PRICE_PAISE = 900;

        // 2. Create Razorpay Order for fixed price
        const requestPhone = req.body && typeof req.body.phone === 'string' ? req.body.phone : '';
        const options = {
            amount: PRODUCT_PRICE_PAISE,
            currency: 'INR',
            receipt: `order_${Date.now()}_${uid.substring(0, 5)}`,
            payment_capture: 1,
            notes: {
                product: 'HabitOS Google Sheets Habit Tracker',
                phone: requestPhone || customerPhone,
                uid
            }
        };

        const order = await razorpay.orders.create(options);

        // 3. Return Order Details
        return send(res, 200, {
            id: order.id,
            amount: order.amount,
            currency: order.currency,
            key: process.env.RAZORPAY_KEY_ID
        });

    } catch (error) {
        console.error('Create Order Error:', error);
        return send(res, 500, { error: 'Internal Server Error' });
    }
};
