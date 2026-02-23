import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { getKSTNow } from "@shared/kst-utils";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, CheckCircle, CalendarDays, Building2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, AttendanceLog, Site, Department } from "@shared/schema";

export default function SiteManagerDashboard() {
    const { user } = useAuth();

    const { data: workers = [], isLoading: workersLoading } = useQuery<User[]>({
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

    const todayStr = format(getKSTNow(), "yyyy-MM-dd");
    const monthStr = format(getKSTNow(), "yyyy-MM");

    const { data: attendanceLogs = [], isLoading: logsLoading } = useQuery<AttendanceLog[]>({
        queryKey: ["/api/attendance", monthStr],
        queryFn: async () => {
            const res = await fetch(`/api/attendance?month=${monthStr}`);
            if (!res.ok) return [];
            return res.json();
        },
    });

    const activeWorkers = useMemo(() => {
        return workers.filter(w => (w.role === "worker" || w.role === "site_manager") && w.isActive);
    }, [workers]);

    const todayCheckins = useMemo(() => {
        return attendanceLogs.filter(log => log.checkInDate === todayStr && log.attendanceType === "normal").length;
    }, [attendanceLogs, todayStr]);

    const siteName = sites.find(s => s.id === user?.siteId)?.name || "현장";

    const isLoading = workersLoading || logsLoading;

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">{siteName} 대시보드</h1>
                <p className="text-muted-foreground">현장 근태 현황을 확인하세요</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">총 근로자</CardTitle>
                        <Users className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{activeWorkers.length}명</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">오늘 출근</CardTitle>
                        <CheckCircle className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{todayCheckins}명</div>
                        <p className="text-xs text-muted-foreground">
                            / {activeWorkers.length}명
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">조직 수</CardTitle>
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{departments.length}개</div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">이번 달 기록</CardTitle>
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{attendanceLogs.length}건</div>
                    </CardContent>
                </Card>
            </div>

            {/* Department breakdown */}
            {departments.length > 0 && (
                <div>
                    <h2 className="text-lg font-semibold mb-3">조직별 현황</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {departments.map(dept => {
                            const deptWorkers = activeWorkers.filter(w => w.departmentId === dept.id);
                            const deptTodayCheckins = attendanceLogs.filter(
                                log => log.checkInDate === todayStr &&
                                    log.attendanceType === "normal" &&
                                    deptWorkers.some(w => w.id === log.userId)
                            ).length;

                            return (
                                <Card key={dept.id}>
                                    <CardHeader className="pb-2">
                                        <CardTitle className="text-sm font-medium">{dept.name}</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <p className="text-sm text-muted-foreground">
                                            근로자 {deptWorkers.length}명 · 오늘 출근 {deptTodayCheckins}명
                                        </p>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
