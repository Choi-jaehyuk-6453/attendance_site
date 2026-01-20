import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileSpreadsheet, Mail, Printer } from "lucide-react";
import { format, getDaysInMonth, startOfMonth, getDate } from "date-fns";
import { ko } from "date-fns/locale";
import type { User, AttendanceLog, Site, Contact } from "@shared/schema";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
  const { toast } = useToast();
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  
  const selectedSite = selectedSiteId ? sites.find(s => s.id === selectedSiteId) : null;
  const siteName = selectedSite?.name || "전체";

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const sendEmailMutation = useMutation({
    mutationFn: async (pdfBase64: string) => {
      const res = await apiRequest("POST", "/api/send-attendance-email", {
        contactIds: selectedContacts,
        pdfBase64,
        fileName: `출근기록부_${siteName}_${format(selectedMonth, "yyyy년_M월", { locale: ko })}.pdf`,
        month: format(selectedMonth, "yyyy년 M월", { locale: ko }),
        siteName,
      });
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "이메일 발송 실패");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setEmailDialogOpen(false);
      setSelectedContacts([]);
      toast({
        title: "이메일 발송 완료",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "이메일 발송 실패",
        description: error.message,
      });
    },
  });

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

  const generatePdfBlob = async (): Promise<{ blob: Blob; base64: string }> => {
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

    const blob = doc.output("blob");
    const base64 = doc.output("datauristring").split(",")[1];
    
    return { blob, base64 };
  };

  const handlePdfPrint = async () => {
    const { blob } = await generatePdfBlob();
    
    const fileName = selectedSiteId 
      ? `출근기록부_${siteName}_${format(selectedMonth, "yyyy년_M월", { locale: ko })}.pdf`
      : `출근기록부_${format(selectedMonth, "yyyy년_M월", { locale: ko })}.pdf`;
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleEmailClick = () => {
    if (contacts.length === 0) {
      toast({
        variant: "destructive",
        title: "담당자 없음",
        description: "먼저 기초관리 > 담당자 관리에서 담당자를 등록해주세요.",
      });
      return;
    }
    setEmailDialogOpen(true);
  };

  const handleSendEmail = async () => {
    if (selectedContacts.length === 0) {
      toast({
        variant: "destructive",
        title: "수신자 선택 필요",
        description: "이메일을 받을 담당자를 선택해주세요.",
      });
      return;
    }

    const { base64 } = await generatePdfBlob();
    sendEmailMutation.mutate(base64);
  };

  const toggleContact = (contactId: string) => {
    setSelectedContacts(prev => 
      prev.includes(contactId) 
        ? prev.filter(id => id !== contactId)
        : [...prev, contactId]
    );
  };

  const miraeContacts = contacts.filter(c => c.company === "mirae_abm");
  const dawonContacts = contacts.filter(c => c.company === "dawon_pmc");

  return (
    <>
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
        <Button
          variant="outline"
          onClick={handleEmailClick}
          data-testid="button-email-send"
          disabled={!selectedSiteId}
        >
          <Mail className="h-4 w-4 mr-2" />
          이메일 발송
        </Button>
      </div>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>출근기록부 이메일 발송</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              {siteName} - {format(selectedMonth, "yyyy년 M월", { locale: ko })} 출근기록부를 선택한 담당자에게 이메일로 발송합니다.
            </p>
            
            {miraeContacts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">미래에이비엠</h4>
                {miraeContacts.map(contact => (
                  <div key={contact.id} className="flex items-center gap-2">
                    <Checkbox
                      id={contact.id}
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                      data-testid={`checkbox-contact-${contact.id}`}
                    />
                    <label htmlFor={contact.id} className="text-sm cursor-pointer flex-1">
                      {contact.name} ({contact.department}) - {contact.email}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {dawonContacts.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-sm">다원피엠씨</h4>
                {dawonContacts.map(contact => (
                  <div key={contact.id} className="flex items-center gap-2">
                    <Checkbox
                      id={contact.id}
                      checked={selectedContacts.includes(contact.id)}
                      onCheckedChange={() => toggleContact(contact.id)}
                      data-testid={`checkbox-contact-${contact.id}`}
                    />
                    <label htmlFor={contact.id} className="text-sm cursor-pointer flex-1">
                      {contact.name} ({contact.department}) - {contact.email}
                    </label>
                  </div>
                ))}
              </div>
            )}

            {contacts.length === 0 && (
              <p className="text-center text-muted-foreground py-4">
                등록된 담당자가 없습니다
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setEmailDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              onClick={handleSendEmail}
              disabled={selectedContacts.length === 0 || sendEmailMutation.isPending}
              data-testid="button-confirm-send-email"
            >
              {sendEmailMutation.isPending ? "발송 중..." : `${selectedContacts.length}명에게 발송`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
