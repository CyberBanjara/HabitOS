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
        const doc = await getFirestore()
            .collection('users')
            .doc(uid)
            .get();

        const data = doc.exists ? doc.data() : {};
        const purchased = Boolean(data.purchased);

        return send(req, res, 200, {
            purchased,
            purchasedAt: data.purchasedAt || null,
            lastOrderId: data.lastOrderId || null,
        });
    } catch (error) {
        console.error('Purchase Status Error:', error);
        return send(req, res, 500, { error: 'Internal Server Error' });
    }
};
