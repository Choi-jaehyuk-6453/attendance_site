import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
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
  
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  
  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const siteName = selectedSite?.name || "전체";
  
  let fontLoaded = false;
  
  try {
    const fontPath = path.join(process.cwd(), "client/public/fonts/NotoSansKR-Regular.ttf");
    if (fs.existsSync(fontPath)) {
      const fontData = fs.readFileSync(fontPath);
      const base64Font = fontData.toString("base64");
      
      doc.addFileToVFS("NotoSansKR-Regular.ttf", base64Font);
      doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "normal");
      doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "bold");
      doc.setFont("NotoSansKR", "normal");
      fontLoaded = true;
      console.log("Korean font loaded successfully for PDF generation");
    }
  } catch (error) {
    console.warn("Failed to load Korean font:", error);
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

    if (fontLoaded) {
      doc.setFont("NotoSansKR", "normal");
    }
    doc.setFontSize(14);
    doc.text(
      `${companyName} 근무자 출근기록부 - ${format(selectedMonth, "yyyy년 M월", { locale: ko })}`,
      14,
      15
    );
    doc.setFontSize(10);
    doc.text(`현장: ${siteName}  |  인원: ${filteredUsers.length}명`, 14, 22);

    const tableData = filteredUsers.map((user) => {
      const userAttendance = attendanceMap.get(user.id) || new Set();
      return [user.name, ...days.map((day) => (userAttendance.has(day) ? "O" : ""))];
    });

    const fontName = fontLoaded ? "NotoSansKR" : "helvetica";
    
    autoTable(doc, {
      startY: 28,
      head: [["성명", ...days.map(String)]],
      body: tableData,
      styles: { 
        fontSize: 7, 
        cellPadding: 1,
        font: fontName,
        fontStyle: "normal",
      },
      headStyles: { 
        fillColor: [41, 128, 185], 
        font: fontName,
        fontStyle: "normal",
      },
      bodyStyles: {
        font: fontName,
        fontStyle: "normal",
      },
      columnStyles: { 
        0: { 
          cellWidth: 25,
          font: fontName,
          fontStyle: "normal",
        } 
      },
    });
  }

  const pdfArrayBuffer = doc.output("arraybuffer");
  return Buffer.from(pdfArrayBuffer);
}
