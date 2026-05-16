const { verifyIdToken, getFirestore } = require('./_services');
const { handleOptions, send } = require('./_http');

module.exports = async function (req, res) {
    if (handleOptions(req, res)) {
        return;
    }

    if (req.method !== 'GET') {
        return send(res, 405, { error: 'Method not allowed' });
    }

    let uid;
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return send(res, 401, { error: 'Unauthorized: Missing token' });
        }
        const token = authHeader.split(' ')[1];
        const decoded = await verifyIdToken(token);
        uid = decoded.uid;
    } catch (error) {
        return send(res, 401, { error: 'Unauthorized' });
    }

    try {
        const snapshot = await getFirestore()
            .collection('users')
            .doc(uid)
            .collection('orders')
            .where('paymentStatus', '==', 'paid')
            .limit(1)
            .get();

        if (snapshot.empty) {
            return send(res, 403, { hasAccess: false });
        }

        const order = snapshot.docs[0];
        return send(res, 200, {
            hasAccess: true,
            order_id: order.id,
            order: order.data(),
        });
    } catch (error) {
        console.error('Access Check Error:', error);
        return send(res, 500, { error: 'Internal Server Error' });
    }
};
