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
      
      const tableStartY = 110;
      const tableWidth = 420;
      const tableX = (pageWidth - tableWidth) / 2;
      const labelWidth = 70;
      const valueWidth = tableWidth - labelWidth;
      const smallRowHeight = 32;
      const largeRowHeight = 70;
      
      const statusText = vacation.status === "approved" ? "승인" : 
                        vacation.status === "rejected" ? "보류" : "대기";
      doc.fontSize(11).text(`승인여부 : ${statusText}`, tableX + tableWidth - 100, tableStartY, { width: 100, align: "right" });
      
      let currentY = tableStartY + 25;
      
      doc.rect(tableX, currentY, labelWidth, smallRowHeight).stroke();
      doc.rect(tableX + labelWidth, currentY, valueWidth, smallRowHeight).stroke();
      doc.fontSize(11).text("소  속", tableX + 10, currentY + 10);
      doc.fontSize(11).text(site?.name || "(미배정)", tableX + labelWidth + 10, currentY + 10);
      currentY += smallRowHeight;
      
      const col1Width = labelWidth;
      const col2Width = (valueWidth) / 3;
      const col3Width = labelWidth;
      const col4Width = valueWidth - col2Width - col3Width;
      
      doc.rect(tableX, currentY, col1Width, smallRowHeight).stroke();
      doc.rect(tableX + col1Width, currentY, col2Width, smallRowHeight).stroke();
      doc.rect(tableX + col1Width + col2Width, currentY, col3Width, smallRowHeight).stroke();
      doc.rect(tableX + col1Width + col2Width + col3Width, currentY, col4Width, smallRowHeight).stroke();
      
      doc.fontSize(11).text("직  책", tableX + 10, currentY + 10);
      doc.fontSize(11).text("경비원", tableX + col1Width + 10, currentY + 10);
      doc.fontSize(11).text("성  명", tableX + col1Width + col2Width + 10, currentY + 10);
      doc.fontSize(11).text(user.name, tableX + col1Width + col2Width + col3Width + 10, currentY + 10);
      currentY += smallRowHeight;
      
      const startDate = new Date(vacation.startDate);
      const endDate = new Date(vacation.endDate);
      const periodRowHeight = 50;
      
      doc.rect(tableX, currentY, labelWidth, periodRowHeight).stroke();
      doc.rect(tableX + labelWidth, currentY, valueWidth - 80, periodRowHeight).stroke();
      doc.rect(tableX + labelWidth + valueWidth - 80, currentY, 80, periodRowHeight).stroke();
      
      doc.fontSize(11).text("기  간", tableX + 10, currentY + 18);
      
      const startYear = format(startDate, "yyyy");
      const startMonth = format(startDate, "M");
      const startDay = format(startDate, "d");
      const endYear = format(endDate, "yyyy");
      const endMonth = format(endDate, "M");
      const endDay = format(endDate, "d");
      
      doc.fontSize(10).text(`${startYear}년  ${startMonth}월  ${startDay}일부터`, tableX + labelWidth + 15, currentY + 10);
      doc.fontSize(10).text(`${endYear}년  ${endMonth}월  ${endDay}일 까지`, tableX + labelWidth + 15, currentY + 30);
      
      const days = vacation.days || 1;
      const dayDisplay = vacation.vacationType === "half_day" ? "0.5" : String(days);
      doc.fontSize(10).text(`(   ${dayDisplay}   )일`, tableX + labelWidth + valueWidth - 75, currentY + 18);
      currentY += periodRowHeight;
      
      doc.rect(tableX, currentY, labelWidth, smallRowHeight).stroke();
      doc.rect(tableX + labelWidth, currentY, valueWidth, smallRowHeight).stroke();
      doc.fontSize(11).text("휴가유형", tableX + 8, currentY + 10);
      doc.fontSize(11).text(getVacationTypeName(vacation.vacationType || "annual"), tableX + labelWidth + 10, currentY + 10);
      currentY += smallRowHeight;
      
      const reasonRowHeight = largeRowHeight;
      doc.rect(tableX, currentY, labelWidth, reasonRowHeight).stroke();
      doc.rect(tableX + labelWidth, currentY, valueWidth, reasonRowHeight).stroke();
      doc.fontSize(11).text("사  유", tableX + 15, currentY + 28);
      doc.fontSize(10).text(vacation.reason || "", tableX + labelWidth + 10, currentY + 10, { 
        width: valueWidth - 20,
        height: reasonRowHeight - 20
      });
      
      if (fs.existsSync(logoPath)) {
        try {
          doc.save();
          doc.opacity(0.15);
          const logoWidth = 180;
          const logoX = tableX + labelWidth + (valueWidth - logoWidth) / 2;
          const logoY = currentY + (reasonRowHeight - 60) / 2;
          doc.image(logoPath, logoX, logoY, { width: logoWidth });
          doc.restore();
        } catch (logoError) {
          console.warn("Failed to load logo:", logoError);
        }
      }
      currentY += reasonRowHeight;
      
      const contactRowHeight = 50;
      doc.rect(tableX, currentY, labelWidth, contactRowHeight).stroke();
      doc.rect(tableX + labelWidth, currentY, 70, contactRowHeight / 2).stroke();
      doc.rect(tableX + labelWidth + 70, currentY, valueWidth - 70, contactRowHeight / 2).stroke();
      doc.rect(tableX + labelWidth, currentY + contactRowHeight / 2, 70, contactRowHeight / 2).stroke();
      doc.rect(tableX + labelWidth + 70, currentY + contactRowHeight / 2, valueWidth - 70, contactRowHeight / 2).stroke();
      
      doc.fontSize(11).text("연락처", tableX + 12, currentY + 18);
      doc.fontSize(9).text("휴대전화", tableX + labelWidth + 8, currentY + 6);
      doc.fontSize(10).text(user.phone || "", tableX + labelWidth + 75, currentY + 6);
      doc.fontSize(9).text("기타 연락처", tableX + labelWidth + 5, currentY + contactRowHeight / 2 + 6);
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
        `${format(requestDate, "yyyy")}년  ${format(requestDate, "M")}월  ${format(requestDate, "d")}일`,
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
