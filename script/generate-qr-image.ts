
import QRCode from 'qrcode';
import path from 'path';

const url = 'http://192.168.0.87:5000';
const outputPath = path.resolve('mobile_qr.png');

QRCode.toFile(outputPath, url, {
    color: {
        dark: '#000000',
        light: '#ffffff'
    },
    width: 300
}, function (err) {
    if (err) throw err
    console.log('QR Code generated at:', outputPath);
})
