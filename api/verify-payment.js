const crypto = require('crypto');
const { verifyIdToken, getFirestore } = require('./_services');
const { guard, handleOptions, requireAuthHeader, send } = require('./_http');

function signaturesMatch(expected, actual) {
    const expectedBuffer = Buffer.from(expected, 'hex');
    const actualBuffer = Buffer.from(actual, 'hex');

    if (expectedBuffer.length !== actualBuffer.length) {
        return false;
    }

    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
}

module.exports = async function (req, res) {
    if (handleOptions(req, res)) {
        return;
    }
    if (guard(req, res, ['POST'])) {
        return;
    }

    let uid;
    let tokenEmail = '';
    try {
        const token = requireAuthHeader(req);
        if (!token) {
            return send(req, res, 401, { error: 'Unauthorized' });
        }
        const decoded = await verifyIdToken(token);
        uid = decoded.uid;
        tokenEmail = decoded.email || '';
    } catch (error) {
        return send(req, res, 401, { error: 'Unauthorized' });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, product } = req.body || {};
    if (
        !/^order_[A-Za-z0-9]+$/.test(razorpay_order_id || '') ||
        !/^pay_[A-Za-z0-9]+$/.test(razorpay_payment_id || '') ||
        !/^[a-f0-9]{64}$/i.test(razorpay_signature || '')
    ) {
        return send(req, res, 400, { error: 'Invalid payment details' });
    }

    try {
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            throw new Error('Missing Razorpay secret');
        }

        const generatedSignature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (!signaturesMatch(generatedSignature, razorpay_signature)) {
            return send(req, res, 400, { error: 'Payment verification failed' });
        }

        const db = getFirestore();
        const ordersRef = db.collection('users').doc(uid).collection('orders');

        const orderData = {
            razorpay_order_id,
            razorpay_payment_id,
            amount: 9,
            amountPaise: 900,
            currency: 'INR',
            product: 'HabitOS Google Sheets Habit Tracker',
            customerEmail: tokenEmail,
            items: [{
                name: 'HabitOS Google Sheets Habit Tracker',
                description: 'Professional habit tracking template with automatic formulas',
                price: 9,
                quantity: 1
            }],
            paymentStatus: 'paid',
            paymentMethod: 'razorpay',
            order_status: 'completed',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const newOrderRef = ordersRef.doc();
        await newOrderRef.set(orderData);

        await db.collection('users').doc(uid).set({
            purchased: true,
            purchasedAt: new Date().toISOString(),
            lastOrderId: newOrderRef.id,
            razorpayOrderId: razorpay_order_id,
            email: tokenEmail,
        }, { merge: true });

        return send(req, res, 200, {
            success: true, 
            message: 'Payment verified and order created',
            order_id: newOrderRef.id
        });

    } catch (error) {
        console.error('Verify Payment Error:', error);
        return send(req, res, 500, { error: 'Internal Server Error' });
    }
};
