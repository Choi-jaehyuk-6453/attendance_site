import { Button } from "@/components/ui/button";
import { FileSpreadsheet, Printer } from "lucide-react";
import { format, getDaysInMonth, startOfMonth, getDate } from "date-fns";
import { ko } from "date-fns/locale";
import type { User, AttendanceLog, Site } from "@shared/schema";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface ExportButtonsProps {
  users: User[];
  attendanceLogs: AttendanceLog[];
  sites: Site[];
  selectedMonth: Date;
  selectedSiteId?: string;
}

export function ExportButtons({
  users,
  attendanceLogs,
  sites,
  selectedMonth,
  selectedSiteId,
}: ExportButtonsProps) {
  const selectedSite = selectedSiteId ? sites.find(s => s.id === selectedSiteId) : null;
  const siteName = selectedSite?.name || "전체";

  const generateData = (company: "mirae_abm" | "dawon_pmc") => {
    const daysInMonth = getDaysInMonth(selectedMonth);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    let filteredUsers = users.filter((u) => u.company === company && u.role === "guard");
    
    if (selectedSiteId) {
      filteredUsers = filteredUsers.filter(u => u.siteId === selectedSiteId);
    }

    const attendanceMap = new Map<string, Set<number>>();
    const attendanceTimeMap = new Map<string, Map<number, string>>();
    
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
        
        if (!attendanceTimeMap.has(key)) {
          attendanceTimeMap.set(key, new Map());
        }
        const checkInDate = new Date(log.checkInTime);
        const checkInTime = format(checkInDate, "HH:mm");
        attendanceTimeMap.get(key)!.set(day, checkInTime);
      }
    });

    return { daysInMonth, days, filteredUsers, attendanceMap, attendanceTimeMap };
  };

  const handleExcelDownload = () => {
    const wb = XLSX.utils.book_new();
    const companies: Array<"mirae_abm" | "dawon_pmc"> = ["mirae_abm", "dawon_pmc"];

    companies.forEach((company) => {
      const { days, filteredUsers, attendanceTimeMap } = generateData(company);
      const companyName = company === "mirae_abm" ? "미래에이비엠" : "다원피엠씨";

      const header = ["성명", ...days.map(String)];
      const data = filteredUsers.map((user) => {
        const userTimeMap = attendanceTimeMap.get(user.id) || new Map<number, string>();
        return [
          user.name,
          ...days.map((day) => userTimeMap.get(day) || ""),
        ];
      });

      const ws = XLSX.utils.aoa_to_sheet([
        [`${companyName} 근무자 출근기록부 - ${format(selectedMonth, "yyyy년 M월", { locale: ko })}`],
        [`현장: ${siteName}`, `인원: ${filteredUsers.length}명`],
        [],
        header,
        ...data,
      ]);

      XLSX.utils.book_append_sheet(wb, ws, companyName);
    });

    const fileName = selectedSiteId 
      ? `출근기록부_${siteName}_${format(selectedMonth, "yyyy년_M월", { locale: ko })}.xlsx`
      : `출근기록부_${format(selectedMonth, "yyyy년_M월", { locale: ko })}.xlsx`;
    
    XLSX.writeFile(wb, fileName);
  };

  const handlePdfPrint = async () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    
    let fontLoaded = false;
    
    const fontUrls = [
      "/fonts/NotoSansKR-Regular.ttf",
      "https://cdn.jsdelivr.net/npm/@aspect-build/aspect-rules-jest@0.19.6/scripts/fonts/NotoSansKR-Regular.ttf",
      "https://fastly.jsdelivr.net/gh/nicenorm/noto-sans-korean@main/fonts/NotoSansKR-Regular.ttf",
    ];
    
    for (const fontUrl of fontUrls) {
      if (fontLoaded) break;
      try {
        const response = await fetch(fontUrl);
        if (!response.ok) continue;
        
        const arrayBuffer = await response.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
          binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64 = btoa(binaryString);
        
        doc.addFileToVFS("NotoSansKR-Regular.ttf", base64);
        doc.addFont("NotoSansKR-Regular.ttf", "NotoSansKR", "normal");
        doc.setFont("NotoSansKR");
        fontLoaded = true;
        console.log("Korean font loaded successfully from:", fontUrl);
      } catch (error) {
        console.warn("Failed to load font from:", fontUrl, error);
      }
    }
    
    if (!fontLoaded) {
      console.error("Could not load Korean font from any source");
    }
    
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
        doc.setFont("NotoSansKR");
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
        },
        headStyles: { 
          fillColor: [41, 128, 185], 
          font: fontName,
        },
        bodyStyles: {
          font: fontName,
        },
        columnStyles: { 
          0: { 
            cellWidth: 25,
            font: fontName,
          } 
        },
      });
    }

    const fileName = selectedSiteId 
      ? `출근기록부_${siteName}_${format(selectedMonth, "yyyy년_M월", { locale: ko })}.pdf`
      : `출근기록부_${format(selectedMonth, "yyyy년_M월", { locale: ko })}.pdf`;
    
    doc.save(fileName);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleExcelDownload}
        data-testid="button-excel-download"
        disabled={!selectedSiteId}
      >
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        엑셀 다운로드
      </Button>
      <Button
        variant="outline"
        onClick={handlePdfPrint}
        data-testid="button-pdf-print"
        disabled={!selectedSiteId}
      >
        <Printer className="h-4 w-4 mr-2" />
        PDF 인쇄
      </Button>
    </div>
  );
}
