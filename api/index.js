let appModule;
let isInitialized = false;

export default async function handler(req, res) {
    if (!isInitialized) {
        appModule = await import('../dist/index.cjs');
        await appModule.setupApp();
        isInitialized = true;
    }
    return appModule.default(req, res);
}
