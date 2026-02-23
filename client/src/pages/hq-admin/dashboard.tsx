import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, format, isToday, getDate, getDaysInMonth, endOfMonth } from "date-fns";
import { getKSTNow } from "@shared/kst-utils";
import { StatsCards } from "@/components/stats-cards";
import { MonthSelector } from "@/components/month-selector";
import { AttendanceGrid } from "@/components/attendance-grid";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Download, Mail, FileSpreadsheet, FileText } from "lucide-react";
import type { User, AttendanceLog, Site, Department } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { exportToPDF, exportToExcel, sendEmail } from "@/lib/export";
import { EmailRecipientSelector } from "@/components/ui/email-recipient-selector";

import { useCompany } from "@/lib/company";

export default function HqAdminDashboard() {
    const { company } = useCompany();
    const { toast } = useToast();
    const [selectedMonth, setSelectedMonth] = useState(startOfMonth(getKSTNow()));
    const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
    const [emailDialogOpen, setEmailDialogOpen] = useState(false);
    const [emailTo, setEmailTo] = useState("");
    const [isSendingEmail, setIsSendingEmail] = useState(false);

    const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
        queryKey: ["/api/users", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/users?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch users");
            return res.json();
        }
    });

    const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
        queryKey: ["/api/sites", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/sites?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch sites");
            return res.json();
        }
    });

    const { data: attendanceLogs = [], isLoading: logsLoading } = useQuery<AttendanceLog[]>({
        queryKey: ["/api/attendance", format(selectedMonth, "yyyy-MM"), selectedSiteId, company.id],
        queryFn: async () => {
            let url = `/api/attendance?month=${format(selectedMonth, "yyyy-MM")}&company=${company.id}`;
            if (selectedSiteId !== "all") {
                url += `&siteId=${selectedSiteId}`;
            }
            const res = await fetch(url);
            if (!res.ok) return [];
            return res.json();
        },
    });

    // Fetch departments for grouping
    const { data: departments = [], isLoading: deptsLoading } = useQuery<Department[]>({
        queryKey: ["/api/departments", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/departments?company=${company.id}`);
            if (!res.ok) return [];
            return res.json();
        }
    });

    const isLoading = usersLoading || sitesLoading || logsLoading || deptsLoading;

    // ... stats calculation code ...

    // Helper: format attendance log to display text
    const getAttendanceSymbol = (log: AttendanceLog) => {
        switch (log.attendanceType) {
            case "normal": return "O";
            case "annual": return "연";
            case "half_day": return "반";
            case "sick": return "병";
            case "family_event": return "경";
            case "other": return "기";
            default: return log.attendanceType;
        }
    };

    // Helper: format attendance log with check-in time for Excel
    const getAttendanceExcelValue = (log: AttendanceLog) => {
        if (log.attendanceType === "normal") {
            // Show check-in time for normal attendance
            let timeStr = "";
            if (log.checkInTime) {
                const d = new Date(log.checkInTime);
                const hours = String(d.getHours()).padStart(2, "0");
                const minutes = String(d.getMinutes()).padStart(2, "0");
                timeStr = `${hours}:${minutes}`;
            } else {
                timeStr = "O";
            }
            // Append (수동) for manual entries
            if (log.source === "manual") {
                timeStr += "(수동)";
            }
            return timeStr;
        }
        // Leave types keep their symbols
        return getAttendanceSymbol(log);
    };

    const getFilteredUsersAndMap = () => {
        const daysInMonth = getDaysInMonth(selectedMonth);
        const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

        let activeUsers = users.filter((u) => (u.role === "worker" || u.role === "site_manager") && u.isActive);
        if (selectedSiteId !== "all") {
            activeUsers = activeUsers.filter(u => u.siteId === selectedSiteId);
        }

        activeUsers.sort((a, b) => {
            const siteA = sites.find(s => s.id === a.siteId)?.name || "";
            const siteB = sites.find(s => s.id === b.siteId)?.name || "";
            return siteA.localeCompare(siteB) || a.name.localeCompare(b.name);
        });

        const attendanceMap = new Map<string, Map<string, AttendanceLog>>();
        attendanceLogs.forEach(log => {
            if (!attendanceMap.has(log.userId)) {
                attendanceMap.set(log.userId, new Map());
            }
            attendanceMap.get(log.userId)?.set(log.checkInDate, log);
        });

        return { days, daysInMonth, activeUsers, attendanceMap };
    };

    // PDF export data: grouped by department like the HTML grid
    const getPdfExportData = () => {
        const { days, activeUsers, attendanceMap } = getFilteredUsersAndMap();

        const header = ["현장 / 성명", ...days.map(d => `${d}`)];

        const data: any[][] = [];

        if (selectedSiteId && selectedSiteId !== "all") {
            // Single site: group by department
            const siteDepts = departments
                .filter(d => d.siteId === selectedSiteId)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            const siteUsers = activeUsers.filter(u => u.siteId === selectedSiteId);

            const deptUserMap = new Map<string, User[]>();
            const usersNoDept: User[] = [];

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

                // Department header row (first cell = dept name + count, rest empty)
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
        } else {
            // All sites: group by site
            const siteUserMap = new Map<string, { siteName: string; users: User[] }>();
            activeUsers.forEach(u => {
                const siteId = u.siteId || "none";
                if (!siteUserMap.has(siteId)) {
                    const name = sites.find(s => s.id === siteId)?.name || "미배치";
                    siteUserMap.set(siteId, { siteName: name, users: [] });
                }
                siteUserMap.get(siteId)!.users.push(u);
            });

            Array.from(siteUserMap.entries())
                .sort(([, a], [, b]) => a.siteName.localeCompare(b.siteName, "ko"))
                .forEach(([, { siteName: name, users }]) => {
                    data.push([`__GROUP__${name} (${users.length}명)`, ...days.map(() => "")]);
                    const sorted = [...users].sort((a, b) => a.name.localeCompare(b.name, "ko"));
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
        }

        return { header, data };
    };

    // Excel export data: grouped like HTML grid, shows check-in time for normal, (수동) for manual
    const getExcelExportData = () => {
        const { days, activeUsers, attendanceMap } = getFilteredUsersAndMap();

        const header = ["소속(현장)", "이름", "직책", ...days.map(d => `${d}`)];
        const data: any[][] = [];

        const buildUserRow = (u: User, affiliation: string) => {
            const userLogs = attendanceMap.get(u.id);
            const attendanceRow = days.map(day => {
                const dateStr = format(new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), day), "yyyy-MM-dd");
                const log = userLogs?.get(dateStr);
                if (!log) return "";
                return getAttendanceExcelValue(log);
            });
            return [affiliation, u.name, u.jobTitle || "-", ...attendanceRow];
        };

        if (selectedSiteId && selectedSiteId !== "all") {
            // Single site: group by department
            const siteDepts = departments
                .filter(d => d.siteId === selectedSiteId)
                .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
            const siteUsers = activeUsers.filter(u => u.siteId === selectedSiteId);

            const deptUserMap = new Map<string, User[]>();
            const usersNoDept: User[] = [];
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
        } else {
            // All sites: group by site
            const siteUserMap = new Map<string, { siteName: string; users: User[] }>();
            activeUsers.forEach(u => {
                const siteId = u.siteId || "none";
                if (!siteUserMap.has(siteId)) {
                    const name = sites.find(s => s.id === siteId)?.name || "미배치";
                    siteUserMap.set(siteId, { siteName: name, users: [] });
                }
                siteUserMap.get(siteId)!.users.push(u);
            });

            Array.from(siteUserMap.entries())
                .sort(([, a], [, b]) => a.siteName.localeCompare(b.siteName, "ko"))
                .forEach(([, { siteName: name, users }]) => {
                    [...users].sort((a, b) => a.name.localeCompare(b.name, "ko"))
                        .forEach(u => data.push(buildUserRow(u, name)));
                });
        }

        return { header, data };
    };

    const handleExportPDF = async () => {
        try {
            const { header, data } = getPdfExportData();
            const todayStr = format(getKSTNow(), "yyyy-MM-dd");
            const siteName = selectedSiteId === "all"
                ? "전체현장"
                : sites.find(s => s.id === selectedSiteId)?.name || "현장";
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
            const siteName = selectedSiteId === "all"
                ? "전체현장"
                : sites.find(s => s.id === selectedSiteId)?.name || "현장";
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

            // Build simple HTML table
            let html = `<h2>${format(selectedMonth, "yyyy년 MM월")} 출근기록부</h2>`;
            html += `<table border="1" style="border-collapse: collapse; width: 100%;"><thead><tr>`;
            header.forEach(h => html += `<th style="padding: 8px; background-color: #f2f2f2;">${h}</th>`);
            html += `</tr></thead><tbody>`;

            data.forEach(row => {
                html += `<tr>`;
                row.forEach(cell => html += `<td style="padding: 8px; text-align: center;">${cell}</td>`);
                html += `</tr>`;
            });
            html += `</tbody></table>`;

            await sendEmail(emailTo, `${format(selectedMonth, "yyyy년 MM월")} 출근기록부`, html);
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
        // Include both workers and site managers in statistics
        let filteredUsers = users.filter((u) => (u.role === "worker" || u.role === "site_manager") && u.isActive);
        let filteredLogs = attendanceLogs;

        if (selectedSiteId !== "all") {
            filteredUsers = filteredUsers.filter(u => u.siteId === selectedSiteId);
            filteredLogs = filteredLogs.filter(log => log.siteId === selectedSiteId);
        }

        const today = getKSTNow();
        const todayStr = format(today, "yyyy-MM-dd");
        const todayAttendance = filteredLogs.filter(
            (log) => log.checkInDate === todayStr && log.attendanceType === "normal"
        ).length;

        const daysInMonth = new Date(
            selectedMonth.getFullYear(),
            selectedMonth.getMonth() + 1,
            0
        ).getDate();
        const currentDay = isToday(selectedMonth) ? getDate(today) : daysInMonth;
        const expectedAttendance = filteredUsers.length * currentDay;
        const actualAttendance = filteredLogs.filter(l => l.attendanceType === "normal").length;
        const rate = expectedAttendance > 0
            ? Math.round((actualAttendance / expectedAttendance) * 100)
            : 0;

        return {
            totalGuards: filteredUsers.length,
            todayAttendance,
            monthlyAttendanceRate: rate,
            totalSites: sites.filter(s => s.isActive).length,
        };
    }, [users, sites, attendanceLogs, selectedMonth, selectedSiteId]);

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => (
                        <Skeleton key={i} className="h-24" />
                    ))}
                </div>
                <Skeleton className="h-[400px]" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">출근기록부</h1>
                <p className="text-muted-foreground">
                    전체 현장의 출근 현황을 확인하세요
                </p>
            </div>

            <StatsCards {...stats} />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                        <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="현장 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">전체 현장</SelectItem>
                            {sites.map((site) => (
                                <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <MonthSelector
                        selectedMonth={selectedMonth}
                        onMonthChange={setSelectedMonth}
                    />
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

            {selectedSiteId === "all" ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-lg border bg-card">
                    <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium mb-2">현장을 선택해주세요</h3>
                    <p className="text-muted-foreground text-center">
                        출근기록부를 확인하려면 위의 현장 선택 드롭다운에서<br />
                        현장을 선택해주세요.
                    </p>
                </div>
            ) : (
                <AttendanceGrid
                    users={users}
                    attendanceLogs={attendanceLogs}
                    sites={sites}
                    departments={departments}
                    selectedMonth={selectedMonth}
                    selectedSiteId={selectedSiteId === "all" ? undefined : selectedSiteId}
                    isAdmin={true}
                />
            )}


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
                                    if (selectedSiteId === "all") return [];
                                    const site = sites.find(s => s.id === selectedSiteId);
                                    return site?.managerEmail ? site.managerEmail.split(',').map(s => s.trim()) : [];
                                })()}
                                value={emailTo}
                                onChange={setEmailTo}
                                placeholder="example@company.com, another@company.com"
                            />
                            {(() => {
                                if (selectedSiteId === "all") return null;
                                const site = sites.find(s => s.id === selectedSiteId);
                                return !site?.managerEmail && (
                                    <p className="text-xs text-muted-foreground mt-2 text-orange-500">
                                        * 등록된 현장 관리자 이메일이 없습니다. [현장 관리] 메뉴에서 이메일을 등록하면 목록에서 선택할 수 있습니다.
                                    </p>
                                );
                            })()}
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
