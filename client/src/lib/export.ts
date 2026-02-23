import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { apiRequest } from "@/lib/queryClient";

// Fonts can be added here if needed for Korean support in PDF
// For now, we rely on default fonts or might need a custom font for Korean characters to render correctly in jsPDF.
// Note: jsPDF default fonts do NOT support Korean. We might need to handle this.
// A common workaround without bundling a huge font file is to use the browser's print functionality for PDF, 
// or accept that pure jsPDF might not render Korean text without a font plugin.
// HOWEVER, the user asked for "PDF Output", which usually implies a downloadable file.
// Let's try to use a CDN font or just standard implementation and warn if Korean fails.
// actually, for Korean support in jsPDF, we usually need to add a font.
// Since we can't easily download a font file here, we might stick to CSV/Excel for data and Browser Print for PDF if jsPDF is too complex for this environment.
// But let's try standard jsPDF-autotable first.

export async function exportToPDF(title: string, columns: string[], data: any[][], fileName: string, returnBlob: boolean = false) {
    const doc = new jsPDF({ orientation: "landscape" });

    try {
        const response = await fetch("/fonts/NotoSansKR-Regular.ttf");

        if (!response.ok) {
            throw new Error("Local font file not found: " + response.statusText);
        }

        const fontBuffer = await response.arrayBuffer();
        const fontFileName = "NotoSansKR-Regular.ttf";

        let binary = '';
        const bytes = new Uint8Array(fontBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64String = window.btoa(binary);

        doc.addFileToVFS(fontFileName, base64String);
        doc.addFont(fontFileName, "NotoSansKR", "normal");
        doc.addFont(fontFileName, "NotoSansKR", "bold");
        doc.setFont("NotoSansKR");

    } catch (e) {
        console.error("Failed to load Korean font:", e);
        alert("한글 폰트(NotoSansKR) 로드에 실패했습니다. PDF 글자가 깨질 수 있습니다.");
    }

    // Strip __GROUP__ prefix from display data
    const processedData = data.map(row => {
        const firstCell = String(row[0] || "");
        if (firstCell.startsWith("__GROUP__")) {
            return [firstCell.replace("__GROUP__", ""), ...row.slice(1)];
        }
        return row;
    });

    // Track which rows are group headers
    const groupRowIndices = new Set<number>();
    data.forEach((row, idx) => {
        const firstCell = String(row[0] || "");
        if (firstCell.startsWith("__GROUP__")) {
            groupRowIndices.add(idx);
        }
    });

    doc.setFontSize(18);
    doc.setFont("NotoSansKR");
    doc.text(title, 14, 22);

    doc.setFontSize(10);
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, 14, 30);

    autoTable(doc, {
        startY: 36,
        head: [columns],
        body: processedData,
        styles: {
            font: "NotoSansKR",
            fontStyle: "normal",
            fontSize: 8,
            cellPadding: 1,
            valign: 'middle',
            halign: 'center',
            overflow: 'hidden',
        },
        headStyles: {
            fillColor: [66, 66, 66],
            textColor: 255,
            font: "NotoSansKR",
            fontStyle: 'normal',
            halign: 'center',
            valign: 'middle',
        },
        columnStyles: {
            0: { halign: 'left', cellWidth: 40 },
        },
        showHead: 'everyPage',
        didParseCell: function (cellData) {
            if (cellData.section === 'body') {
                const rowIndex = cellData.row.index;
                const colIndex = cellData.column.index;
                const text = String(cellData.cell.raw || "");

                // Style group header rows
                if (groupRowIndices.has(rowIndex)) {
                    cellData.cell.styles.fillColor = [235, 245, 255]; // Light blue bg
                    cellData.cell.styles.fontStyle = 'bold';
                    cellData.cell.styles.textColor = [37, 99, 235]; // Blue text
                    return;
                }

                // Attendance symbol colors (non-group rows, day columns only)
                if (colIndex > 0) {
                    if (text === 'O' || text === '연') {
                        cellData.cell.styles.textColor = [37, 99, 235]; // Blue
                    } else if (text === '반') {
                        cellData.cell.styles.textColor = [8, 145, 178]; // Cyan
                    } else if (text === '병') {
                        cellData.cell.styles.textColor = [234, 88, 12]; // Orange
                    } else if (text === '경') {
                        cellData.cell.styles.textColor = [147, 51, 234]; // Purple
                    } else if (text === '기') {
                        cellData.cell.styles.textColor = [75, 85, 99]; // Gray
                    }
                }
            }
        }
    });

    if (returnBlob) {
        return doc.output("blob");
    }
    doc.save(`${fileName}.pdf`);
}

export function exportToExcel(header: string[], data: any[][], fileName: string) {
    // Use aoa_to_sheet (array of arrays) to preserve exact column order
    // json_to_sheet reorders numeric keys before string keys in JS
    const aoa = [header, ...data];
    const worksheet = XLSX.utils.aoa_to_sheet(aoa);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sheet1");
    XLSX.writeFile(workbook, `${fileName}.xlsx`);
}

export async function sendEmail(to: string, subject: string, html: string) {
    try {
        const res = await apiRequest("POST", "/api/email/send", { to, subject, html });
        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(errorData.error || "Email send failed");
        }
        return true;
    } catch (error) {
        console.error("Failed to send email:", error);
        throw error;
    }
}
