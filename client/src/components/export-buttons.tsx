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
  const generateData = (company: "mirae_abm" | "dawon_pmc") => {
    const daysInMonth = getDaysInMonth(selectedMonth);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const filteredUsers = users.filter((u) => u.company === company && u.role === "guard");

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
        if (!attendanceMap.has(key)) {
          attendanceMap.set(key, new Set());
        }
        attendanceMap.get(key)!.add(getDate(logDate));
      }
    });

    return { daysInMonth, days, filteredUsers, attendanceMap };
  };

  const handleExcelDownload = () => {
    const wb = XLSX.utils.book_new();
    const companies: Array<"mirae_abm" | "dawon_pmc"> = ["mirae_abm", "dawon_pmc"];

    companies.forEach((company) => {
      const { days, filteredUsers, attendanceMap } = generateData(company);
      const companyName = company === "mirae_abm" ? "미래에이비엠" : "다원피엠씨";
      const siteName = selectedSiteId
        ? sites.find((s) => s.id === selectedSiteId)?.name || "전체"
        : "전체";

      const header = ["성명", ...days.map(String)];
      const data = filteredUsers.map((user) => {
        const userAttendance = attendanceMap.get(user.id) || new Set();
        return [
          user.name,
          ...days.map((day) => (userAttendance.has(day) ? "O" : "")),
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

    XLSX.writeFile(
      wb,
      `출근기록부_${format(selectedMonth, "yyyy년_M월", { locale: ko })}.xlsx`
    );
  };

  const handlePdfPrint = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const companies: Array<"mirae_abm" | "dawon_pmc"> = ["mirae_abm", "dawon_pmc"];
    let firstPage = true;

    companies.forEach((company) => {
      if (!firstPage) {
        doc.addPage();
      }
      firstPage = false;

      const { days, filteredUsers, attendanceMap } = generateData(company);
      const companyName = company === "mirae_abm" ? "미래에이비엠" : "다원피엠씨";
      const siteName = selectedSiteId
        ? sites.find((s) => s.id === selectedSiteId)?.name || "전체"
        : "전체";

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

      autoTable(doc, {
        startY: 28,
        head: [["성명", ...days.map(String)]],
        body: tableData,
        styles: { fontSize: 7, cellPadding: 1 },
        headStyles: { fillColor: [41, 128, 185] },
        columnStyles: { 0: { cellWidth: 25 } },
      });
    });

    doc.save(`출근기록부_${format(selectedMonth, "yyyy년_M월", { locale: ko })}.pdf`);
  };

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        onClick={handleExcelDownload}
        data-testid="button-excel-download"
      >
        <FileSpreadsheet className="h-4 w-4 mr-2" />
        엑셀 다운로드
      </Button>
      <Button
        variant="outline"
        onClick={handlePdfPrint}
        data-testid="button-pdf-print"
      >
        <Printer className="h-4 w-4 mr-2" />
        PDF 인쇄
      </Button>
    </div>
  );
}
