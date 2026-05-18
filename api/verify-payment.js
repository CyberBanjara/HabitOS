const crypto = require('crypto');
const { verifyIdToken, getFirestore } = require('./_services');
const { handleOptions, send } = require('./_http');

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

    if (req.method !== 'POST') {
        return send(res, 405, { error: 'Method not allowed' });
    }

    // 1. Verify User
    let uid;
    let tokenPhone = '';
    let tokenEmail = '';
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return send(res, 401, { error: 'Unauthorized: Missing token' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = await verifyIdToken(token);
        uid = decoded.uid;
        tokenPhone = decoded.phone_number || '';
        tokenEmail = decoded.email || '';
    } catch (error) {
        return send(res, 401, { error: 'Unauthorized' });
    }

    // 2. Validate Input
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, product, phone } = req.body || {};
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return send(res, 400, { error: 'Missing payment details' });
    }

    try {
        // 3. Verify Signature
        const secret = process.env.RAZORPAY_KEY_SECRET;
        if (!secret) {
            throw new Error('Missing Razorpay secret');
        }

        const generatedSignature = crypto
            .createHmac('sha256', secret)
            .update(razorpay_order_id + '|' + razorpay_payment_id)
            .digest('hex');

        if (!signaturesMatch(generatedSignature, razorpay_signature)) {
            return send(res, 400, { error: 'Payment verification failed: Invalid signature' });
        }

        // 4. Store Order in Firestore
        const db = getFirestore();
        const ordersRef = db.collection('users').doc(uid).collection('orders');

        // For Habit Tracker product: ₹9 = 900 paise
        const orderData = {
            razorpay_order_id,
            razorpay_payment_id,
            amount: 9, // INR
            amountPaise: 900,
            currency: 'INR',
            product: product || 'HabitOS Google Sheets Habit Tracker',
            customerPhone: phone || tokenPhone,
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

        // Create order document
        const newOrderRef = ordersRef.doc();
        await newOrderRef.set(orderData);

        // Denormalize purchase status on user doc for fast page-load checks
        await db.collection('users').doc(uid).set({
            purchased: true,
            purchasedAt: new Date().toISOString(),
            lastOrderId: newOrderRef.id,
            razorpayOrderId: razorpay_order_id,
            email: tokenEmail,
            phone: phone || tokenPhone,
        }, { merge: true });

        return send(res, 200, { 
            success: true, 
            message: 'Payment verified and order created',
            order_id: newOrderRef.id
        });

    } catch (error) {
        console.error('Verify Payment Error:', error);
        return send(res, 500, { error: 'Internal Server Error' });
    }
};
