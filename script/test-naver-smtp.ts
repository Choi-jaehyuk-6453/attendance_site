import { config } from "dotenv";
config();
import nodemailer from "nodemailer";

async function testEmail() {
    console.log("Testing Naver SMTP...");
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || "smtp.naver.com",
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
            user: process.env.NODEMAILER_USER,
            pass: process.env.NODEMAILER_PASS,
        },
    });

    try {
        const info = await transporter.sendMail({
            from: `"미래에이비엠" <${process.env.NODEMAILER_USER}>`,
            to: process.env.NODEMAILER_USER, // Send to self
            subject: "Test Email Naver",
            html: "<h1>It works</h1>",
        });
        console.log("Success! Message ID:", info.messageId);
    } catch (err) {
        console.error("Failed to send:", err);
    }
}

testEmail();
