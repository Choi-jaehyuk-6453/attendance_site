import fs from 'fs';
import https from 'https';

const url = "https://fonts.google.com/download?family=Noto%20Sans%20KR";
const dest = "font.zip";

function download(url: string, dest: string) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (res) => {
            if (res.statusCode === 302 || res.statusCode === 301) {
                console.log(`Redirecting to ${res.headers.location}...`);
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
                console.log(`Downloaded ${stats.size} bytes`);
                resolve(null);
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

download(url, dest).catch(e => {
    console.error(e);
    process.exit(1);
});
