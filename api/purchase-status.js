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
        const doc = await getFirestore()
            .collection('users')
            .doc(uid)
            .get();

        const data = doc.exists ? doc.data() : {};
        const purchased = Boolean(data.purchased);

        return send(res, 200, {
            purchased,
            purchasedAt: data.purchasedAt || null,
            lastOrderId: data.lastOrderId || null,
        });
    } catch (error) {
        console.error('Purchase Status Error:', error);
        return send(res, 500, { error: 'Internal Server Error' });
    }
};
