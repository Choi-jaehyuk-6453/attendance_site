import nodemailer from "nodemailer";

console.log("Email config - NAVER_EMAIL:", process.env.NAVER_EMAIL);
console.log("Email config - PASSWORD exists:", !!process.env.NAVER_EMAIL_PASSWORD);
console.log("Email config - PASSWORD length:", process.env.NAVER_EMAIL_PASSWORD?.length || 0);

const transporter = nodemailer.createTransport({
  host: "smtp.naver.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.NAVER_EMAIL,
    pass: process.env.NAVER_EMAIL_PASSWORD,
  },
});

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType: string;
}

interface SendEmailOptions {
  to: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const mailOptions = {
      from: process.env.NAVER_EMAIL,
      to: options.to.join(", "),
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType,
      })),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent:", info.messageId);
    return true;
  } catch (error) {
    console.error("Failed to send email:", error);
    return false;
  }
}

export async function verifyEmailConnection(): Promise<boolean> {
  try {
    await transporter.verify();
    console.log("Email connection verified");
    return true;
  } catch (error) {
    console.error("Email connection failed:", error);
    return false;
  }
}
