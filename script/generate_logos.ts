import fs from 'fs';
import path from 'path';

function toBase64(filePath: string) {
    const data = fs.readFileSync(filePath);
    return `data:image/png;base64,${data.toString('base64')}`;
}

const logoMirae = toBase64(path.resolve('./client/public/assets/images/logo_mirae_abm.png'));
const logoDawon = toBase64(path.resolve('./client/public/assets/images/logo_dawon_pmc.png'));
// Use mirae as the fallback since there is no generic logo.png in that folder
const logo = logoMirae;

const content = `export const logoBase64 = "${logo}";\nexport const logoMiraeBase64 = "${logoMirae}";\nexport const logoDawonBase64 = "${logoDawon}";\n`;
fs.writeFileSync(path.resolve('./client/src/lib/logos.ts'), content);

console.log('Successfully created logos.ts');
