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
      const boldFontPath = path.join(process.cwd(), "client/public/fonts/NotoSansKR-Bold.ttf");
      
      if (fs.existsSync(fontPath)) {
        try {
          doc.registerFont("Korean", fontPath);
          if (fs.existsSync(boldFontPath)) {
            doc.registerFont("KoreanBold", boldFontPath);
          }
          doc.font("Korean");
        } catch (fontError) {
          console.warn("Failed to load Korean font:", fontError);
          doc.font("Helvetica");
        }
      } else {
        doc.font("Helvetica");
      }
      
      const pageWidth = doc.page.width;
      const margin = 50;
      const contentWidth = pageWidth - margin * 2;
      
      const companyName = user.company === "dawon_pmc" ? "다원피엠씨" : "미래에이비엠";
      const logoFileName = user.company === "dawon_pmc" 
        ? "다원PMC_LOGO_1768955499272.png"
        : "미래ABM_LOGO_1768955495420.png";
      const logoPath = path.join(process.cwd(), "attached_assets", logoFileName);
      
      if (fs.existsSync(logoPath)) {
        try {
          const logoWidth = 120;
          const logoX = (pageWidth - logoWidth) / 2;
          doc.image(logoPath, logoX, 40, { width: logoWidth });
          doc.moveDown(4);
        } catch (logoError) {
          console.warn("Failed to load logo:", logoError);
        }
      }
      
      doc.y = 100;
      doc.fontSize(22);
      if (fs.existsSync(boldFontPath)) {
        doc.font("KoreanBold");
      }
      doc.text("휴가 사용신청서", { align: "center" });
      doc.font("Korean");
      doc.moveDown(1.5);
      
      const startY = doc.y;
      const labelWidth = 100;
      const valueWidth = contentWidth - labelWidth - 120;
      const rowHeight = 35;
      const tableX = margin;
      
      const approvalBoxX = pageWidth - margin - 100;
      const approvalBoxY = startY;
      doc.rect(approvalBoxX, approvalBoxY, 100, 50).stroke();
      doc.fontSize(10).text("승인", approvalBoxX, approvalBoxY + 8, { width: 100, align: "center" });
      doc.fontSize(9).text("여부", approvalBoxX, approvalBoxY + 22, { width: 100, align: "center" });
      
      const statusText = vacation.status === "approved" ? "승인" : 
                        vacation.status === "rejected" ? "보류" : "대기";
      doc.fontSize(11).text(`( ${statusText} )`, approvalBoxX, approvalBoxY + 36, { width: 100, align: "center" });
      
      let currentY = startY + 10;
      
      const drawTableRow = (label: string, value: string, height: number = rowHeight) => {
        doc.rect(tableX, currentY, labelWidth, height).stroke();
        doc.rect(tableX + labelWidth, currentY, valueWidth, height).stroke();
        
        doc.fontSize(11).text(label, tableX + 10, currentY + (height / 2) - 6, { 
          width: labelWidth - 20 
        });
        doc.fontSize(11).text(value, tableX + labelWidth + 10, currentY + (height / 2) - 6, { 
          width: valueWidth - 20 
        });
        
        currentY += height;
      };
      
      drawTableRow("소 속", site?.name || "(미배정)");
      
      doc.rect(tableX, currentY, labelWidth / 2, rowHeight).stroke();
      doc.rect(tableX + labelWidth / 2, currentY, labelWidth / 2, rowHeight).stroke();
      doc.rect(tableX + labelWidth, currentY, (valueWidth - labelWidth) / 2, rowHeight).stroke();
      doc.rect(tableX + labelWidth + (valueWidth - labelWidth) / 2, currentY, labelWidth / 2, rowHeight).stroke();
      doc.rect(tableX + labelWidth + (valueWidth - labelWidth) / 2 + labelWidth / 2, currentY, valueWidth - (valueWidth - labelWidth) / 2 - labelWidth / 2, rowHeight).stroke();
      
      doc.fontSize(11).text("직 책", tableX + 5, currentY + 12, { width: labelWidth / 2 - 10 });
      doc.fontSize(11).text("경비", tableX + labelWidth / 2 + 5, currentY + 12, { width: labelWidth / 2 - 10 });
      doc.fontSize(11).text("성 명", tableX + labelWidth + (valueWidth - labelWidth) / 2 + 5, currentY + 12, { width: labelWidth / 2 - 10 });
      doc.fontSize(11).text(user.name, tableX + labelWidth + (valueWidth - labelWidth) / 2 + labelWidth / 2 + 5, currentY + 12);
      currentY += rowHeight;
      
      const startDate = new Date(vacation.startDate);
      const endDate = new Date(vacation.endDate);
      const periodHeight = rowHeight * 2;
      
      doc.rect(tableX, currentY, labelWidth, periodHeight).stroke();
      doc.rect(tableX + labelWidth, currentY, valueWidth - 80, periodHeight).stroke();
      doc.rect(tableX + labelWidth + valueWidth - 80, currentY, 80, periodHeight).stroke();
      
      doc.fontSize(11).text("기 간", tableX + 10, currentY + periodHeight / 2 - 6, { width: labelWidth - 20 });
      
      doc.fontSize(10).text(
        `(20${format(startDate, "yy")}년  ${format(startDate, "M")}월  ${format(startDate, "d")}일부터)`,
        tableX + labelWidth + 10,
        currentY + 12
      );
      doc.fontSize(10).text(
        `(20${format(endDate, "yy")}년  ${format(endDate, "M")}월  ${format(endDate, "d")}일까지)`,
        tableX + labelWidth + 10,
        currentY + periodHeight / 2 + 8
      );
      
      const days = vacation.days || 1;
      const timeDisplay = vacation.vacationType === "half_day" ? "4" : String(days * 8);
      doc.fontSize(10).text(`(  ${timeDisplay}  ) 시간`, tableX + labelWidth + valueWidth - 75, currentY + periodHeight / 2 - 6);
      
      currentY += periodHeight;
      
      drawTableRow("휴가유형", getVacationTypeName(vacation.vacationType || "annual"));
      
      const reasonHeight = rowHeight * 3;
      doc.rect(tableX, currentY, labelWidth, reasonHeight).stroke();
      doc.rect(tableX + labelWidth, currentY, valueWidth, reasonHeight).stroke();
      
      doc.fontSize(11).text("사 유", tableX + 10, currentY + 12, { width: labelWidth - 20 });
      doc.fontSize(10).text(vacation.reason || "", tableX + labelWidth + 10, currentY + 12, { 
        width: valueWidth - 20,
        height: reasonHeight - 24
      });
      currentY += reasonHeight;
      
      const contactHeight = rowHeight * 1.5;
      doc.rect(tableX, currentY, labelWidth, contactHeight).stroke();
      doc.rect(tableX + labelWidth, currentY, 80, contactHeight / 2).stroke();
      doc.rect(tableX + labelWidth + 80, currentY, valueWidth - 80, contactHeight / 2).stroke();
      doc.rect(tableX + labelWidth, currentY + contactHeight / 2, 80, contactHeight / 2).stroke();
      doc.rect(tableX + labelWidth + 80, currentY + contactHeight / 2, valueWidth - 80, contactHeight / 2).stroke();
      
      doc.fontSize(10).text("연락처", tableX + 10, currentY + contactHeight / 2 - 6, { width: labelWidth - 20 });
      doc.fontSize(9).text("휴대전화", tableX + labelWidth + 5, currentY + 5, { width: 70 });
      doc.fontSize(10).text(user.phone || "", tableX + labelWidth + 85, currentY + 5);
      doc.fontSize(9).text("기타 연락처", tableX + labelWidth + 5, currentY + contactHeight / 2 + 5, { width: 70 });
      
      currentY += contactHeight;
      
      doc.moveDown(2);
      currentY = doc.y + 20;
      
      doc.fontSize(11).text(
        "본인 은 위 와 같 은 사유로 연 차휴 가를 사용하고자 하오니",
        margin,
        currentY,
        { align: "center", width: contentWidth }
      );
      doc.moveDown(0.5);
      doc.fontSize(11).text(
        "재 가하여 주 시기 바랍니다.",
        margin,
        doc.y,
        { align: "center", width: contentWidth }
      );
      
      doc.moveDown(3);
      
      const requestDate = new Date(vacation.requestedAt);
      doc.fontSize(11).text(
        `(20${format(requestDate, "yy")}년  ${format(requestDate, "M")}월  ${format(requestDate, "d")}일)`,
        margin,
        doc.y,
        { align: "center", width: contentWidth }
      );
      
      doc.moveDown(2);
      doc.fontSize(11).text(
        `신청 인 :   ${user.name}`,
        margin,
        doc.y,
        { align: "center", width: contentWidth }
      );
      
      doc.moveDown(4);
      doc.fontSize(12).text(
        `株式 會社 ${companyName} 귀중`,
        margin,
        doc.y,
        { align: "center", width: contentWidth }
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
          .filter(v => v.status === "approved" && v.vacationType !== "family_event" && v.vacationType !== "other")
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
