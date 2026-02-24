import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, format, getDaysInMonth } from "date-fns";
import { getKSTNow } from "@shared/kst-utils";
import { useAuth } from "@/lib/auth";
import { MonthSelector } from "@/components/month-selector";
import { AttendanceGrid } from "@/components/attendance-grid";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileSpreadsheet, FileText, Mail } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel, sendEmail } from "@/lib/export";
import { sendEmailWithAttachment } from "@/lib/exportUtils";
import { EmailRecipientSelector } from "@/components/ui/email-recipient-selector";
import type { User, AttendanceLog, Site, Department } from "@shared/schema";

export default function SiteManagerAttendance() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [selectedMonth, setSelectedMonth] = useState(startOfMonth(getKSTNow()));
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailTo, setEmailTo] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
        queryKey: ["/api/users"],
    });

    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ["/api/sites"],
    });

    const { data: departments = [] } = useQuery<Department[]>({
        queryKey: ["/api/departments", user?.siteId],
        queryFn: async () => {
            if (!user?.siteId) return [];
            const res = await fetch(`/api/departments/${user.siteId}`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!user?.siteId,
    });

    const { data: attendanceLogs = [], isLoading: logsLoading } = useQuery<AttendanceLog[]>({
        queryKey: ["/api/attendance", format(selectedMonth, "yyyy-MM")],
        queryFn: async () => {
            const res = await fetch(`/api/attendance?month=${format(selectedMonth, "yyyy-MM")}`);
            if (!res.ok) return [];
            return res.json();
        },
    });

    const isLoading = usersLoading || logsLoading;

    // Include both workers and site_managers in the count
    const activeWorkers = users.filter(u => (u.role === "worker" || u.role === "site_manager") && u.isActive);

    const siteName = user?.siteId
        ? sites.find(s => s.id === user.siteId)?.name || "현장"
        : "현장";

    // ============ Export Helpers ============
    const getAttendanceSymbol = (info: any) => {
        switch (info.type) {
            case "normal": return "O";
            case "annual": return "연";
            case "half_day": return "반";
            case "sick": return "병";
            case "family_event": return "경";
            case "other": return "기";
            default: return info.type;
        }
    };

    const getAttendanceExcelValue = (info: any) => {
        if (info.type === "normal") {
            let timeStr = "";
            if (info.status === "in_only" && info.checkInTime) {
                const d = new Date(info.checkInTime);
                timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            } else if (info.status === "out_only" && info.checkOutTime) {
                const d = new Date(info.checkOutTime);
                timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
            } else if (info.status === "completed" && info.checkInTime && info.checkOutTime) {
                const inD = new Date(info.checkInTime);
                const outD = new Date(info.checkOutTime);
                timeStr = `${String(inD.getHours()).padStart(2, "0")}:${String(inD.getMinutes()).padStart(2, "0")}\n${String(outD.getHours()).padStart(2, "0")}:${String(outD.getMinutes()).padStart(2, "0")}`;
            } else {
                timeStr = "O";
            }
            if (info.source === "manual") {
                timeStr += "(수동)";
            }
            return timeStr;
        }
        return getAttendanceSymbol(info);
    };

    const getFilteredUsersAndMap = () => {
        const daysInMonth = getDaysInMonth(selectedMonth);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        const siteUsers = activeWorkers
            .filter(u => u.siteId === user?.siteId)
            .sort((a, b) => a.name.localeCompare(b.name, "ko"));

        const attendanceMap = new Map<string, Map<string, any>>();
        attendanceLogs.forEach(log => {
            const inDate = new Date(log.checkInDate);
            const outDate = log.checkOutTime ? new Date(log.checkOutTime) : null;
            const inDateStr = format(inDate, "yyyy-MM-dd");
            const outDateStr = outDate ? format(outDate, "yyyy-MM-dd") : null;

            const key = log.userId;
            if (!attendanceMap.has(key)) {
                attendanceMap.set(key, new Map());
            }

            if (log.attendanceType === "normal") {
                const isSameDay = outDateStr && inDateStr === outDateStr;

                if (!outDateStr) {
                    attendanceMap.get(key)?.set(inDateStr, { type: "normal", status: "in_only", checkInTime: log.checkInTime, checkOutTime: null, source: log.source });
                } else if (isSameDay) {
                    attendanceMap.get(key)?.set(inDateStr, { type: "normal", status: "completed", checkInTime: log.checkInTime, checkOutTime: log.checkOutTime, source: log.source });
                } else {
                    attendanceMap.get(key)?.set(inDateStr, { type: "normal", status: "in_only", checkInTime: log.checkInTime, checkOutTime: null, source: log.source });
                    attendanceMap.get(key)?.set(outDateStr, { type: "normal", status: "out_only", checkInTime: null, checkOutTime: log.checkOutTime, source: log.source });
                }
            } else {
                attendanceMap.get(key)?.set(inDateStr, { type: log.attendanceType || "normal", status: "", checkInTime: null, checkOutTime: null, source: log.source });
            }
        });

        return { days, siteUsers, attendanceMap };
    };

    // PDF: grouped by department like the HTML grid
    const getPdfExportData = () => {
        const { days, siteUsers, attendanceMap } = getFilteredUsersAndMap();

        const header = ["현장 / 성명", ...days.map(d => `${d}`)];
        const data: any[][] = [];

        // Group by department
        const siteDepts = departments
            .filter(d => d.siteId === user?.siteId)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        const deptUserMap = new Map<string, typeof siteUsers>();
        const usersNoDept: typeof siteUsers = [];

        siteUsers.forEach(u => {
            if (u.departmentId) {
                const existing = deptUserMap.get(u.departmentId) || [];
                existing.push(u);
                deptUserMap.set(u.departmentId, existing);
            } else {
                usersNoDept.push(u);
            }
        });

        siteDepts.forEach(dept => {
            const users = deptUserMap.get(dept.id) || [];
            if (users.length === 0) return;
            const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name, "ko"));

            // Dept header row
            data.push([`__GROUP__${dept.name} (${users.length}명)`, ...days.map(() => "")]);

            sorted.forEach(u => {
                const userLogs = attendanceMap.get(u.id);
                const attendanceRow = days.map(day => {
                    const dateStr = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day), "yyyy-MM-dd");
                    const log = userLogs?.get(dateStr);
                    if (!log) return "";
                    return getAttendanceSymbol(log);
                });
                const nameDisplay = u.jobTitle ? `  ${u.name} (${u.jobTitle})` : `  ${u.name}`;
                data.push([nameDisplay, ...attendanceRow]);
            });
        });

        if (usersNoDept.length > 0) {
            data.push([`__GROUP__미배치 (${usersNoDept.length}명)`, ...days.map(() => "")]);
            const sorted = [...usersNoDept].sort((a, b) => a.name.localeCompare(b.name, "ko"));
            sorted.forEach(u => {
                const userLogs = attendanceMap.get(u.id);
                const attendanceRow = days.map(day => {
                    const dateStr = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day), "yyyy-MM-dd");
                    const log = userLogs?.get(dateStr);
                    if (!log) return "";
                    return getAttendanceSymbol(log);
                });
                const nameDisplay = u.jobTitle ? `  ${u.name} (${u.jobTitle})` : `  ${u.name}`;
                data.push([nameDisplay, ...attendanceRow]);
            });
        }

        return { header, data };
    };

    // Excel: grouped like HTML grid, check-in time for normal attendance, (수동) for manual
    const getExcelExportData = () => {
        const { days, siteUsers, attendanceMap } = getFilteredUsersAndMap();

        const header = ["소속", "이름", "직책", ...days.map(d => `${d}`)];
        const data: any[][] = [];

        const buildUserRow = (u: typeof siteUsers[0], deptName: string) => {
            const userLogs = attendanceMap.get(u.id);
            const attendanceRow = days.map(day => {
                const dateStr = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day), "yyyy-MM-dd");
                const log = userLogs?.get(dateStr);
                if (!log) return "";
                return getAttendanceExcelValue(log);
            });
            return [deptName, u.name, u.jobTitle || "-", ...attendanceRow];
        };

        // Group by department
        const siteDepts = departments
            .filter(d => d.siteId === user?.siteId)
            .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

        const deptUserMap = new Map<string, typeof siteUsers>();
        const usersNoDept: typeof siteUsers = [];
        siteUsers.forEach(u => {
            if (u.departmentId) {
                const existing = deptUserMap.get(u.departmentId) || [];
                existing.push(u);
                deptUserMap.set(u.departmentId, existing);
            } else {
                usersNoDept.push(u);
            }
        });

        siteDepts.forEach(dept => {
            const users = deptUserMap.get(dept.id) || [];
            if (users.length === 0) return;
            [...users].sort((a, b) => a.name.localeCompare(b.name, "ko"))
                .forEach(u => data.push(buildUserRow(u, dept.name)));
        });
        if (usersNoDept.length > 0) {
            [...usersNoDept].sort((a, b) => a.name.localeCompare(b.name, "ko"))
                .forEach(u => data.push(buildUserRow(u, "미배치")));
        }

        return { header, data };
    };

    // ============ Export Handlers ============
    const handleExportPDF = async () => {
        try {
            const { header, data } = getPdfExportData();
            const todayStr = format(getKSTNow(), "yyyy-MM-dd");
            const title = `${siteName} ${format(selectedMonth, "yyyy년 MM월")} 출근기록부`;
            const fileName = `${siteName}_출근기록부(${todayStr})`;

            await exportToPDF(title, header, data, fileName);
            toast({ title: "PDF 다운로드 완료" });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "PDF 생성 실패" });
        }
    };

    const handleExportExcel = () => {
        try {
            const { header, data } = getExcelExportData();
            const todayStr = format(getKSTNow(), "yyyy-MM-dd");
            const fileName = `${siteName}_출근기록부(${todayStr})`;

            exportToExcel(header, data, fileName);
            toast({ title: "Excel 다운로드 완료" });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "Excel 생성 실패" });
        }
    };

    const handleSendEmail = async () => {
        if (!emailTo) {
            toast({ variant: "destructive", title: "이메일 주소를 입력해주세요" });
            return;
        }

        try {
            setIsSendingEmail(true);
            const { header, data } = getPdfExportData();

            const todayStr = format(getKSTNow(), "yyyy-MM-dd");
            const title = `${siteName} ${format(selectedMonth, "yyyy년 MM월")} 출근기록부`;
            const fileName = `${siteName}_출근기록부(${todayStr})`;

            const pdfBlob = await exportToPDF(title, header, data, fileName, true) as Blob;

            const html = `<p>${siteName} ${format(selectedMonth, "yyyy년 MM월")} 출근기록부(PDF)를 첨부하여 보내드립니다.</p>`;

            await sendEmailWithAttachment(
                emailTo,
                `${siteName} ${format(selectedMonth, "yyyy년 MM월")} 출근기록부`,
                html,
                { filename: `${fileName}.pdf`, content: pdfBlob }
            );
            toast({ title: "이메일이 전송되었습니다" });
            setEmailDialogOpen(false);
            setEmailTo("");
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "이메일 전송 실패" });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const stats = useMemo(() => {
        const todayStr = format(getKSTNow(), "yyyy-MM-dd");
        const todayAttendance = attendanceLogs.filter(
            log => log.checkInDate === todayStr && log.attendanceType === "normal"
        ).length;

        return {
            totalGuards: activeWorkers.length,
            todayAttendance,
            monthlyAttendanceRate: 0,
            totalSites: 1,
        };
    }, [activeWorkers, attendanceLogs]);

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">출근기록부</h1>
                <p className="text-muted-foreground">현장 근로자 출근 현황을 확인하세요</p>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <MonthSelector
                        selectedMonth={selectedMonth}
                        onMonthChange={setSelectedMonth}
                    />
                    <span className="text-sm text-muted-foreground">총 {activeWorkers.length}명</span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleExportExcel}>
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={handleExportPDF}>
                        <FileText className="h-4 w-4 mr-2" />
                        PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setEmailDialogOpen(true)}>
                        <Mail className="h-4 w-4 mr-2" />
                        Email
                    </Button>
                </div>
            </div>

            <AttendanceGrid
                users={users}
                attendanceLogs={attendanceLogs}
                sites={sites}
                departments={departments}
                selectedMonth={selectedMonth}
                selectedSiteId={user?.siteId || ""}
                isAdmin={true}
            />

            <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>이메일 발송</DialogTitle>
                        <DialogDescription>
                            현재 조회된 출근기록부를 이메일로 전송합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">받는 사람 이메일</Label>
                            <EmailRecipientSelector
                                presets={(() => {
                                    const site = sites.find(s => s.id === user?.siteId);
                                    return site?.managerEmail ? site.managerEmail.split(',').map(s => s.trim()) : [];
                                })()}
                                value={emailTo}
                                onChange={setEmailTo}
                                placeholder="example@company.com, another@company.com"
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>취소</Button>
                        <Button onClick={handleSendEmail} disabled={isSendingEmail}>
                            {isSendingEmail ? "전송 중..." : "전송하기"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
