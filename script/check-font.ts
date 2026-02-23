import fs from 'fs';
import path from 'path';
import https from 'https';

const filePath = path.join(process.cwd(), 'client', 'public', 'fonts', 'NotoSansKR-Regular.ttf');
const ttfUrl = "https://raw.githubusercontent.com/google/fonts/main/ofl/notosanskr/NotoSansKR-Regular.ttf";

async function checkFile() {
    if (!fs.existsSync(filePath)) {
        console.log("File not found.");
        return false;
    }

    const buffer = Buffer.alloc(4);
    const fd = fs.openSync(filePath, 'r');
    fs.readSync(fd, buffer, 0, 4, 0);
    fs.closeSync(fd);

    const hex = buffer.toString('hex');
    const ascii = buffer.toString('ascii');

    console.log(`File signature: Hex=${hex}, ASCII=${ascii}`);

    if (hex === '00010000' || ascii === 'OTTO') {
        console.log("Valid TTF signature.");
        return true;
    } else if (ascii === 'wOF2') {
        console.log("File is WOFF2, not TTF!");
        return false;
    } else if (ascii === 'wOFF') {
        console.log("File is WOFF, not TTF!");
        return false;
    } else {
        console.log("Unknown file signature.");
        return false;
    }
}

function download(url: string, dest: string) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                download(res.headers.location!, dest).then(resolve).catch(reject);
                return;
            }
            if (res.statusCode !== 200) {
                file.close();
                fs.unlink(dest, () => { });
                reject(new Error(`Status ${res.statusCode}`));
                return;
            }
            res.pipe(file);
            file.on('finish', () => {
                file.close();
                const stats = fs.statSync(dest);
                console.log(`Downloaded ${stats.size} bytes from ${url}`);
                resolve(null);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

async function run() {
    const isValid = await checkFile();
    if (isValid) {
        console.log("Existing file is valid TTF.");
        return;
    }

    // List of candidate URLs
    const candidates = [
        "https://raw.githubusercontent.com/google/fonts/main/ofl/nanumgothic/NanumGothic-Regular.ttf",
        "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSansKR/NotoSansKR-Regular.ttf",
        "https://cdn.jsdelivr.net/gh/googlefonts/noto-cjk@main/Sans/OTF/Korean/NotoSansCJKkr-Regular.otf",
        "https://github.com/google/fonts/raw/main/ofl/nanumgothic/NanumGothic-Regular.ttf",
        "https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSansKR/NotoSansKR-Regular.ttf"
    ];

    console.log("Attempting to find a valid TTF/OTF from candidates...");

    for (const url of candidates) {
        try {
            console.log(`Downloading from ${url}...`);
            await download(url, filePath);
            if (await checkFile()) {
                console.log("Success! Valid font downloaded.");
                return;
            }
        } catch (e) {
            console.log(`Failed to download from ${url}:`, e);
        }
    }

    console.error("Could not find a valid font automatically.");
}

run();
