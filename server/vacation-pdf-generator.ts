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
      const pageHeight = doc.page.height;
      const margin = 50;
      const contentWidth = pageWidth - margin * 2;
      
      const companyName = user.company === "dawon_pmc" ? "다원피엠씨" : "미래에이비엠";
      const logoFileName = user.company === "dawon_pmc" 
        ? "다원PMC_LOGO_1768955499272.png"
        : "미래ABM_LOGO_1768955495420.png";
      const logoPath = path.join(process.cwd(), "attached_assets", logoFileName);
      
      doc.fontSize(24);
      if (fs.existsSync(boldFontPath)) {
        doc.font("KoreanBold");
      }
      doc.text("휴가 사용신청서", margin, 60, { align: "center", width: contentWidth });
      doc.font("Korean");
      
      const tableStartY = 120;
      const labelWidth = 70;
      const tableWidth = contentWidth;
      const valueWidth = tableWidth - labelWidth;
      const smallRowHeight = 32;
      const largeRowHeight = 70;
      
      const approvalBoxWidth = 80;
      const approvalBoxHeight = 50;
      const approvalBoxX = margin + tableWidth - approvalBoxWidth;
      const approvalBoxY = tableStartY;
      
      doc.rect(approvalBoxX, approvalBoxY, approvalBoxWidth, approvalBoxHeight / 2).stroke();
      doc.rect(approvalBoxX, approvalBoxY + approvalBoxHeight / 2, approvalBoxWidth, approvalBoxHeight / 2).stroke();
      
      doc.fontSize(10).text("승인", approvalBoxX, approvalBoxY + 6, { width: approvalBoxWidth, align: "center" });
      doc.fontSize(9).text("여부", approvalBoxX, approvalBoxY + 18, { width: approvalBoxWidth, align: "center" });
      
      const statusText = vacation.status === "approved" ? "승인" : 
                        vacation.status === "rejected" ? "보류" : "대기";
      doc.fontSize(10).text(`(${statusText})`, approvalBoxX, approvalBoxY + approvalBoxHeight / 2 + 10, { width: approvalBoxWidth, align: "center" });
      
      let currentY = tableStartY + approvalBoxHeight + 10;
      
      doc.rect(margin, currentY, labelWidth, smallRowHeight).stroke();
      doc.rect(margin + labelWidth, currentY, valueWidth - labelWidth, smallRowHeight).stroke();
      doc.fontSize(11).text("소  속", margin + 10, currentY + 10);
      doc.fontSize(11).text(site?.name || "(미배정)", margin + labelWidth + 10, currentY + 10);
      currentY += smallRowHeight;
      
      const halfLabelWidth = labelWidth / 2;
      const halfValueWidth = (valueWidth - labelWidth) / 2;
      
      doc.rect(margin, currentY, halfLabelWidth, smallRowHeight).stroke();
      doc.rect(margin + halfLabelWidth, currentY, halfLabelWidth + 30, smallRowHeight).stroke();
      doc.rect(margin + labelWidth + 30, currentY, halfLabelWidth, smallRowHeight).stroke();
      doc.rect(margin + labelWidth + halfLabelWidth + 30, currentY, valueWidth - labelWidth - halfLabelWidth - 30, smallRowHeight).stroke();
      
      doc.fontSize(11).text("직  책", margin + 5, currentY + 10);
      doc.fontSize(11).text("경비원", margin + halfLabelWidth + 10, currentY + 10);
      doc.fontSize(11).text("성  명", margin + labelWidth + 35, currentY + 10);
      doc.fontSize(11).text(user.name, margin + labelWidth + halfLabelWidth + 40, currentY + 10);
      currentY += smallRowHeight;
      
      const startDate = new Date(vacation.startDate);
      const endDate = new Date(vacation.endDate);
      const periodRowHeight = 50;
      
      doc.rect(margin, currentY, labelWidth, periodRowHeight).stroke();
      doc.rect(margin + labelWidth, currentY, valueWidth - labelWidth - 80, periodRowHeight).stroke();
      doc.rect(margin + valueWidth - 80, currentY, 80, periodRowHeight).stroke();
      
      doc.fontSize(11).text("기  간", margin + 10, currentY + 18);
      
      const startYear = format(startDate, "yyyy");
      const startMonth = format(startDate, "M");
      const startDay = format(startDate, "d");
      const endYear = format(endDate, "yyyy");
      const endMonth = format(endDate, "M");
      const endDay = format(endDate, "d");
      
      doc.fontSize(10).text(`${startYear}년  ${startMonth}월  ${startDay}일부터`, margin + labelWidth + 15, currentY + 10);
      doc.fontSize(10).text(`${endYear}년  ${endMonth}월  ${endDay}일 까지`, margin + labelWidth + 15, currentY + 30);
      
      const days = vacation.days || 1;
      const dayDisplay = vacation.vacationType === "half_day" ? "0.5" : String(days);
      doc.fontSize(10).text(`(   ${dayDisplay}   )일`, margin + valueWidth - 70, currentY + 18);
      currentY += periodRowHeight;
      
      doc.rect(margin, currentY, labelWidth, smallRowHeight).stroke();
      doc.rect(margin + labelWidth, currentY, valueWidth - labelWidth, smallRowHeight).stroke();
      doc.fontSize(11).text("휴가유형", margin + 8, currentY + 10);
      doc.fontSize(11).text(getVacationTypeName(vacation.vacationType || "annual"), margin + labelWidth + 10, currentY + 10);
      currentY += smallRowHeight;
      
      const reasonRowHeight = largeRowHeight;
      doc.rect(margin, currentY, labelWidth, reasonRowHeight).stroke();
      doc.rect(margin + labelWidth, currentY, valueWidth - labelWidth, reasonRowHeight).stroke();
      doc.fontSize(11).text("사  유", margin + 15, currentY + 28);
      doc.fontSize(10).text(vacation.reason || "", margin + labelWidth + 10, currentY + 10, { 
        width: valueWidth - labelWidth - 20,
        height: reasonRowHeight - 20
      });
      
      if (fs.existsSync(logoPath)) {
        try {
          doc.save();
          doc.opacity(0.15);
          const logoWidth = 180;
          const logoX = margin + labelWidth + (valueWidth - labelWidth - logoWidth) / 2;
          const logoY = currentY + (reasonRowHeight - 60) / 2;
          doc.image(logoPath, logoX, logoY, { width: logoWidth });
          doc.restore();
        } catch (logoError) {
          console.warn("Failed to load logo:", logoError);
        }
      }
      currentY += reasonRowHeight;
      
      const contactRowHeight = 50;
      doc.rect(margin, currentY, labelWidth, contactRowHeight).stroke();
      doc.rect(margin + labelWidth, currentY, 70, contactRowHeight / 2).stroke();
      doc.rect(margin + labelWidth + 70, currentY, valueWidth - labelWidth - 70, contactRowHeight / 2).stroke();
      doc.rect(margin + labelWidth, currentY + contactRowHeight / 2, 70, contactRowHeight / 2).stroke();
      doc.rect(margin + labelWidth + 70, currentY + contactRowHeight / 2, valueWidth - labelWidth - 70, contactRowHeight / 2).stroke();
      
      doc.fontSize(11).text("연락처", margin + 12, currentY + 18);
      doc.fontSize(9).text("휴대전화", margin + labelWidth + 8, currentY + 6);
      doc.fontSize(10).text(user.phone || "", margin + labelWidth + 75, currentY + 6);
      doc.fontSize(9).text("기타 연락처", margin + labelWidth + 5, currentY + contactRowHeight / 2 + 6);
      currentY += contactRowHeight;
      
      currentY += 40;
      doc.fontSize(11).text(
        "본인은 위와 같은 사유로 연차휴가를 사용하고자 하오니",
        margin,
        currentY,
        { align: "center", width: contentWidth }
      );
      currentY += 20;
      doc.fontSize(11).text(
        "재가하여 주시기 바랍니다.",
        margin,
        currentY,
        { align: "center", width: contentWidth }
      );
      
      currentY += 50;
      const requestDate = new Date(vacation.requestedAt);
      doc.fontSize(11).text(
        `(${format(requestDate, "yyyy")}년  ${format(requestDate, "M")}월  ${format(requestDate, "d")}일)(신청날짜)`,
        margin,
        currentY,
        { align: "center", width: contentWidth }
      );
      
      currentY += 35;
      doc.fontSize(11).text(
        `신청인 :  ${user.name}`,
        margin,
        currentY,
        { align: "center", width: contentWidth }
      );
      
      currentY += 50;
      doc.fontSize(13).text(
        `株式會社 ${companyName} 귀중`,
        margin,
        currentY,
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
