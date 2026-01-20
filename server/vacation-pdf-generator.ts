import PDFDocument from "pdfkit";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import fs from "fs";
import path from "path";
import type { User, VacationRequest, Site } from "@shared/schema";
import { getVacationTypeName, getVacationStatusName, calculateAnnualLeave } from "@shared/leave-utils";

interface GenerateVacationPdfOptions {
  vacation: VacationRequest;
  user: User;
  site: Site | null;
}

export async function generateVacationPdf(options: GenerateVacationPdfOptions): Promise<Buffer> {
  const { vacation, user, site } = options;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: "A4", 
        margin: 50
      });
      
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      
      const fontPath = path.join(process.cwd(), "client/public/fonts/NotoSansKR-Regular.ttf");
      
      if (fs.existsSync(fontPath)) {
        try {
          doc.registerFont("Korean", fontPath);
          doc.font("Korean");
        } catch (fontError) {
          console.warn("Failed to load Korean font:", fontError);
          doc.font("Helvetica");
        }
      } else {
        doc.font("Helvetica");
      }
      
      doc.fontSize(20).text("휴가신청서", { align: "center" });
      doc.moveDown(2);
      
      const startY = 150;
      const labelX = 80;
      const valueX = 200;
      const lineHeight = 30;
      
      const drawRow = (y: number, label: string, value: string) => {
        doc.rect(labelX, y, 100, lineHeight).stroke();
        doc.rect(valueX, y, 280, lineHeight).stroke();
        doc.fontSize(11).text(label, labelX + 10, y + 9);
        doc.fontSize(11).text(value, valueX + 10, y + 9);
      };
      
      drawRow(startY, "성명", user.name);
      drawRow(startY + lineHeight, "소속", site?.name || "미배정");
      drawRow(startY + lineHeight * 2, "휴가유형", getVacationTypeName(vacation.vacationType || "annual"));
      drawRow(startY + lineHeight * 3, "시작일", format(new Date(vacation.startDate), "yyyy년 M월 d일", { locale: ko }));
      drawRow(startY + lineHeight * 4, "종료일", format(new Date(vacation.endDate), "yyyy년 M월 d일", { locale: ko }));
      drawRow(startY + lineHeight * 5, "일수", `${vacation.days}일`);
      drawRow(startY + lineHeight * 6, "사유", vacation.reason || "-");
      drawRow(startY + lineHeight * 7, "상태", getVacationStatusName(vacation.status));
      
      if (vacation.status === "approved" && vacation.respondedAt) {
        drawRow(startY + lineHeight * 8, "승인일", format(new Date(vacation.respondedAt), "yyyy년 M월 d일", { locale: ko }));
      }
      
      doc.moveDown(4);
      doc.fontSize(10).fillColor("#666").text(
        `신청일: ${format(new Date(vacation.requestedAt), "yyyy년 M월 d일 HH:mm", { locale: ko })}`,
        { align: "center" }
      );
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

interface GenerateVacationStatusPdfOptions {
  users: User[];
  sites: Site[];
  vacations: VacationRequest[];
  siteId?: string;
  year: number;
}

export async function generateVacationStatusPdf(options: GenerateVacationStatusPdfOptions): Promise<Buffer> {
  const { users, sites, vacations, siteId, year } = options;
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ 
        size: "A4", 
        layout: "landscape",
        margin: 30
      });
      
      const chunks: Buffer[] = [];
      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      
      const fontPath = path.join(process.cwd(), "client/public/fonts/NotoSansKR-Regular.ttf");
      
      if (fs.existsSync(fontPath)) {
        try {
          doc.registerFont("Korean", fontPath);
          doc.font("Korean");
        } catch (fontError) {
          console.warn("Failed to load Korean font:", fontError);
          doc.font("Helvetica");
        }
      } else {
        doc.font("Helvetica");
      }
      
      const selectedSite = siteId ? sites.find(s => s.id === siteId) : null;
      const siteName = selectedSite?.name || "전체";
      
      let filteredUsers = users.filter(u => u.role === "guard" && u.isActive);
      if (siteId) {
        filteredUsers = filteredUsers.filter(u => u.siteId === siteId);
      }
      
      doc.fontSize(14).text(`휴가 현황 - ${siteName} (${year}년)`, 30, 30);
      doc.fontSize(10).text(`인원: ${filteredUsers.length}명`, 30, 50);
      
      const tableTop = 70;
      const colWidths = [80, 80, 60, 60, 60, 60, 200];
      const headers = ["성명", "현장", "총 연차", "사용", "잔여", "대기", "휴가 내역"];
      const rowHeight = 20;
      
      let x = 30;
      doc.fontSize(8);
      headers.forEach((header, i) => {
        doc.rect(x, tableTop, colWidths[i], rowHeight).fillAndStroke("#2980b9", "#2980b9");
        doc.fillColor("white").text(header, x + 5, tableTop + 6, { width: colWidths[i] - 10 });
        x += colWidths[i];
      });
      
      filteredUsers.forEach((user, rowIndex) => {
        const y = tableTop + rowHeight + (rowIndex * rowHeight);
        const userSite = sites.find(s => s.id === user.siteId);
        
        const userVacations = vacations.filter(v => 
          v.userId === user.id && 
          new Date(v.startDate).getFullYear() === year
        );
        
        const approvedDays = userVacations
          .filter(v => v.status === "approved")
          .reduce((sum, v) => sum + (v.days || 1), 0);
        
        const pendingDays = userVacations
          .filter(v => v.status === "pending")
          .reduce((sum, v) => sum + (v.days || 1), 0);
        
        let totalAccrued = 0;
        if (user.hireDate) {
          const balance = calculateAnnualLeave(new Date(user.hireDate), approvedDays);
          totalAccrued = balance.totalAccrued;
        }
        
        const remaining = Math.max(0, totalAccrued - approvedDays);
        
        const vacationDetails = userVacations
          .filter(v => v.status === "approved")
          .map(v => `${format(new Date(v.startDate), "M/d")}~${format(new Date(v.endDate), "M/d")}`)
          .join(", ");
        
        const rowData = [
          user.name,
          userSite?.name || "-",
          String(totalAccrued),
          String(approvedDays),
          String(remaining),
          String(pendingDays),
          vacationDetails || "-"
        ];
        
        x = 30;
        rowData.forEach((data, i) => {
          doc.rect(x, y, colWidths[i], rowHeight).stroke("#cccccc");
          doc.fillColor("black").text(data, x + 5, y + 6, { width: colWidths[i] - 10 });
          x += colWidths[i];
        });
      });
      
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
