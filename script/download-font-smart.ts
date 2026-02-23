import fs from 'fs';
import path from 'path';
import https from 'https';

const cssUrl = "https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400&display=swap";
const destDir = path.join(process.cwd(), 'client', 'public', 'fonts');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// User-Agent to request TTF if possible, or we handle WOFF2
// Using a very old UA often yields TTF
const userAgent = "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko"; // IE11 - supports WOFF
// Safari 5.1 (Windows)
const userAgentTTF = "Mozilla/5.0 (Windows NT 6.1) AppleWebKit/534.57.2 (KHTML, like Gecko) Version/5.1.7 Safari/534.57.2";

function downloadData(url: string, headers: any): Promise<string> {
    return new Promise((resolve, reject) => {
        https.get(url, { headers }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => resolve(data));
            res.on('error', reject);
        });
    });
}

function downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                downloadFile(res.headers.location!, dest).then(resolve).catch(reject);
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function run() {
    try {
        console.log("Fetching CSS to find font URL...");
        const css = await downloadData(cssUrl, { 'User-Agent': userAgentTTF });

        // Look for url(...)
        const match = css.match(/src:\s*url\(([^)]+)\)/);
        if (!match) {
            console.error("Could not find font URL in CSS:", css);
            process.exit(1);
        }

        const fontUrl = match[1];
        console.log("Found font URL:", fontUrl);

        let ext = '.ttf';
        if (fontUrl.endsWith('.woff2')) ext = '.woff2';
        if (fontUrl.endsWith('.woff')) ext = '.woff';

        const destFile = path.join(destDir, `NotoSansKR-Regular${ext}`);

        console.log(`Downloading to ${destFile}...`);
        await downloadFile(fontUrl, destFile);
        console.log("Download complete.");

        // Check size
        const stats = fs.statSync(destFile);
        console.log(`File size: ${stats.size} bytes`);

    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
}

run();
