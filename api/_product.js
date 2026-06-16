function getRequiredEnv(name) {
    const value = process.env[name];
    if (!value) {
        throw new Error(`Missing ${name}`);
    }
    return value;
}

function getProductConfig() {
    const pricePaise = Number(getRequiredEnv('APP_PRODUCT_PRICE_PAISE'));
    if (!Number.isInteger(pricePaise) || pricePaise < 100) {
        throw new Error('APP_PRODUCT_PRICE_PAISE must be an integer of at least 100');
    }

    return {
        name: getRequiredEnv('APP_PRODUCT_NAME'),
        description: process.env.APP_PRODUCT_DESCRIPTION || '',
        pricePaise,
        price: pricePaise / 100,
        currency: process.env.APP_PRODUCT_CURRENCY || 'INR',
    };
}

module.exports = {
    getProductConfig,
};
