
import { apiRequest } from "@/lib/queryClient";
import * as XLSX from "xlsx";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import type { VacationRequest, User } from "@shared/schema";
import { createRoot } from "react-dom/client";
import { VacationRequestTemplate } from "@/components/print/VacationRequestTemplate";
import { VacationStatusTemplate } from "@/components/print/VacationStatusTemplate";

export async function sendEmailWithAttachment(to: string, subject: string, html: string, attachment: { filename: string, content: Blob }) {
    // Convert Blob to Base64
    const reader = new FileReader();
    reader.readAsDataURL(attachment.content);

    return new Promise((resolve, reject) => {
        reader.onloadend = async () => {
            const base64data = reader.result?.toString().split(',')[1];
            if (!base64data) return reject("Failed to convert blob to base64");

            try {
                // to field can be "a@b.com, c@d.com" - nodemailer handles this
                const res = await apiRequest("POST", "/api/email/send", {
                    to,
                    subject,
                    html,
                    attachments: [
                        {
                            filename: attachment.filename,
                            content: base64data,
                            encoding: 'base64'
                        }
                    ]
                });
                if (!res.ok) throw new Error("Email send failed");
                resolve(await res.json());
            } catch (e) {
                reject(e);
            }
        };
        reader.onerror = reject;
    });
}

export function generateVacationStatusExcel(data: any[], year: string) {
    const ws = XLSX.utils.json_to_sheet(data.map(row => ({
        "이름": row.name,
        "현장": row.siteName,
        "입사일": row.hireDate,
        "총 연차": row.totalEntitlement,
        "사용 연차": row.usedDays,
        "잔여 연차": row.remainingDays,
        "휴가 내역": row.vacationHistory.map((h: any) => `${h.startDate}~${h.endDate}(${h.type})`).join(", ")
    })));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "휴가현황");
    const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    return new Blob([wbout], { type: "application/octet-stream" });
}

// Helper to generate PDF from React Component
async function generatePdfFromComponent(component: React.ReactNode, filename: string) {
    const container = document.createElement("div");
    container.style.position = "absolute";
    container.style.top = "-9999px";
    container.style.left = "-9999px";
    document.body.appendChild(container);

    const root = createRoot(container);
    root.render(component);

    // Wait for render
    await new Promise(resolve => setTimeout(resolve, 500));

    try {
        const canvas = await html2canvas(container.firstChild as HTMLElement, {
            scale: 2,
            useCORS: true,
            logging: false,
            windowWidth: 210 * 3.7795275591, // A4 width in px (approx)
        });

        const imgData = canvas.toDataURL("image/png");
        const pdf = new jsPDF("p", "mm", "a4");
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = pdf.internal.pageSize.getHeight();

        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
        return pdf.output("blob");
    } finally {
        // Cleanup
        root.unmount();
        document.body.removeChild(container);
    }
}

export async function generateVacationRequestPDF(request: VacationRequest, user: User, siteName: string, companyId?: string) {
    // We pass companyId to the template
    return generatePdfFromComponent(
        <VacationRequestTemplate request={ request } user = { user } siteName = { siteName } companyId = { companyId } />,
        `vacation_request_${user.name}.pdf`
    );
}

export async function generateVacationStatusPDF(data: any[], year: string) {
    return generatePdfFromComponent(
        <VacationStatusTemplate data={ data } year = { year } />, // Status template doesn't need company branding usually, or we can add it later if needed
        `vacation_status_${year}.pdf`
    );
}
