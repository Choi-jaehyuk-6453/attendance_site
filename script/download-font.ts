import fs from 'fs';
import path from 'path';
import https from 'https';
import { exec } from 'child_process';

// Use raw.githubusercontent.com directly
const ttfUrl = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR-Regular.ttf";

const destDir = path.join(process.cwd(), 'client', 'public', 'fonts');
const destFile = path.join(destDir, 'NotoSansKR-Regular.ttf');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

console.log(`Downloading font from ${ttfUrl}...`);

const file = fs.createWriteStream(destFile);

function download(url: string) {
    const options = {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
    };

    https.get(url, options, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
            console.log(`Redirecting to ${response.headers.location}...`);
            download(response.headers.location!);
            return;
        }

        if (response.statusCode !== 200) {
            console.error(`Failed to download: status ${response.statusCode}`);
            file.close();
            fs.unlink(destFile, () => { });
            process.exit(1);
            return;
        }

        response.pipe(file);
        file.on('finish', () => {
            file.close();
            console.log('Font downloaded successfully to ' + destFile);
        });
    }).on('error', (err) => {
        fs.unlink(destFile, () => { });
        console.error('Error downloading font:', err.message);
        process.exit(1);
    });
}

download(ttfUrl);
