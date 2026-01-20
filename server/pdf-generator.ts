import PDFDocument from "pdfkit";
import { format, getDaysInMonth, startOfMonth, getDate } from "date-fns";
import { ko } from "date-fns/locale";
import fs from "fs";
import path from "path";
import type { User, AttendanceLog, Site } from "@shared/schema";

interface GeneratePdfOptions {
  users: User[];
  attendanceLogs: AttendanceLog[];
  sites: Site[];
  selectedMonth: Date;
  selectedSiteId: string;
}

export async function generateAttendancePdf(options: GeneratePdfOptions): Promise<Buffer> {
  const { users, attendanceLogs, sites, selectedMonth, selectedSiteId } = options;
  
  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const siteName = selectedSite?.name || "전체";
  
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
          console.log("Korean font loaded successfully");
        } catch (fontError) {
          console.warn("Failed to load Korean font, using Helvetica:", fontError);
          doc.font("Helvetica");
        }
      } else {
        console.warn("Font file not found:", fontPath);
        doc.font("Helvetica");
      }
      
      const generateData = (company: "mirae_abm" | "dawon_pmc") => {
        const daysInMonth = getDaysInMonth(selectedMonth);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
        
        let filteredUsers = users.filter((u) => u.company === company && u.role === "guard");
        
        if (selectedSiteId) {
          filteredUsers = filteredUsers.filter(u => u.siteId === selectedSiteId);
        }

        const attendanceMap = new Map<string, Set<number>>();
        
        attendanceLogs.forEach((log) => {
          if (selectedSiteId && log.siteId !== selectedSiteId) return;
          const user = users.find((u) => u.id === log.userId);
          if (user?.company !== company) return;
          
          const logDate = new Date(log.checkInDate);
          const monthStart = startOfMonth(selectedMonth);
          if (
            logDate.getFullYear() === monthStart.getFullYear() &&
            logDate.getMonth() === monthStart.getMonth()
          ) {
            const key = log.userId;
            const day = getDate(logDate);
            
            if (!attendanceMap.has(key)) {
              attendanceMap.set(key, new Set());
            }
            attendanceMap.get(key)!.add(day);
          }
        });

        return { daysInMonth, days, filteredUsers, attendanceMap };
      };

      const companies: Array<"mirae_abm" | "dawon_pmc"> = ["mirae_abm", "dawon_pmc"];
      let firstPage = true;

      for (const company of companies) {
        const { days, filteredUsers, attendanceMap } = generateData(company);
        
        if (filteredUsers.length === 0) continue;
        
        if (!firstPage) {
          doc.addPage();
        }
        firstPage = false;

        const companyName = company === "mirae_abm" ? "미래에이비엠" : "다원피엠씨";
        const monthString = format(selectedMonth, "yyyy년 M월", { locale: ko });
        
        doc.fontSize(14).text(
          `${companyName} 근무자 출근기록부 - ${monthString}`,
          30,
          30
        );
        doc.fontSize(10).text(
          `현장: ${siteName}  |  인원: ${filteredUsers.length}명`,
          30,
          50
        );

        const tableTop = 70;
        const nameColWidth = 70;
        const dayColWidth = 20;
        const rowHeight = 16;
        
        doc.fontSize(7);
        
        doc.rect(30, tableTop, nameColWidth, rowHeight).fillAndStroke("#2980b9", "#2980b9");
        doc.fillColor("white").text("성명", 35, tableTop + 4, { width: nameColWidth - 10 });
        
        days.forEach((day, i) => {
          const x = 30 + nameColWidth + (i * dayColWidth);
          doc.rect(x, tableTop, dayColWidth, rowHeight).fillAndStroke("#2980b9", "#2980b9");
          doc.fillColor("white").text(String(day), x + 2, tableTop + 4, { width: dayColWidth - 4, align: "center" });
        });
        
        filteredUsers.forEach((user, rowIndex) => {
          const y = tableTop + rowHeight + (rowIndex * rowHeight);
          const userAttendance = attendanceMap.get(user.id) || new Set();
          
          doc.rect(30, y, nameColWidth, rowHeight).stroke("#cccccc");
          doc.fillColor("black").text(user.name, 35, y + 4, { width: nameColWidth - 10 });
          
          days.forEach((day, i) => {
            const x = 30 + nameColWidth + (i * dayColWidth);
            doc.rect(x, y, dayColWidth, rowHeight).stroke("#cccccc");
            if (userAttendance.has(day)) {
              doc.fillColor("black").text("O", x + 2, y + 4, { width: dayColWidth - 4, align: "center" });
            }
          });
        });
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
