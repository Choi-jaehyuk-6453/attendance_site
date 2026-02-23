const { default: app, setupApp } = require('../dist/index.cjs');

let isInitialized = false;

module.exports = async (req, res) => {
    if (!isInitialized) {
        await setupApp();
        isInitialized = true;
    }
    return app(req, res);
};
