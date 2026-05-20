const { verifyIdToken, getFirestore } = require('./_services');
const { guard, handleOptions, requireAuthHeader, send } = require('./_http');

module.exports = async function (req, res) {
    if (handleOptions(req, res)) {
        return;
    }
    if (guard(req, res, ['GET'])) {
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
        return send(req, res, 401, { error: 'Unauthorized' });
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
            return send(req, res, 403, { hasAccess: false });
        }

        const order = snapshot.docs[0];
        return send(req, res, 200, {
            hasAccess: true,
            order_id: order.id,
        });
    } catch (error) {
        console.error('Access Check Error:', error);
        return send(req, res, 500, { error: 'Internal Server Error' });
    }
};
