import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, format, isToday, getDate } from "date-fns";
import { AttendanceGrid } from "@/components/attendance-grid";
import { StatsCards } from "@/components/stats-cards";
import { MonthSelector } from "@/components/month-selector";
import { ExportButtons } from "@/components/export-buttons";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2 } from "lucide-react";
import type { User, AttendanceLog, Site } from "@shared/schema";

export default function AdminDashboard() {
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [selectedCompany, setSelectedCompany] = useState<string>("all");
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const { data: attendanceLogs = [], isLoading: logsLoading } = useQuery<AttendanceLog[]>({
    queryKey: ["/api/attendance", format(selectedMonth, "yyyy-MM")],
    queryFn: async () => {
      const res = await fetch(`/api/attendance?month=${format(selectedMonth, "yyyy-MM")}`);
      if (!res.ok) return [];
      return res.json();
    },
  });

  const isLoading = usersLoading || sitesLoading || logsLoading;

  const filteredSites = useMemo(() => {
    if (selectedCompany === "all") return sites;
    return sites.filter(s => s.company === selectedCompany);
  }, [sites, selectedCompany]);

  const stats = useMemo(() => {
    let filteredUsers = users.filter((u) => u.role === "guard" && u.isActive);
    let filteredLogs = attendanceLogs;
    let filteredSitesForStats = sites.filter((s) => s.isActive);

    if (selectedCompany !== "all") {
      filteredUsers = filteredUsers.filter(u => u.company === selectedCompany);
      filteredSitesForStats = filteredSitesForStats.filter(s => s.company === selectedCompany);
      const siteIds = filteredSitesForStats.map(s => s.id);
      filteredLogs = filteredLogs.filter(log => siteIds.includes(log.siteId));
    }

    if (selectedSiteId !== "all") {
      filteredUsers = filteredUsers.filter(u => u.siteId === selectedSiteId);
      filteredLogs = filteredLogs.filter(log => log.siteId === selectedSiteId);
      filteredSitesForStats = filteredSitesForStats.filter(s => s.id === selectedSiteId);
    }

    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const todayAttendance = filteredLogs.filter(
      (log) => log.checkInDate === todayStr
    ).length;

    const daysInMonth = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      0
    ).getDate();
    const currentDay = isToday(selectedMonth) ? getDate(today) : daysInMonth;
    const expectedAttendance = filteredUsers.length * currentDay;
    const actualAttendance = filteredLogs.length;
    const rate = expectedAttendance > 0
      ? Math.round((actualAttendance / expectedAttendance) * 100)
      : 0;

    return {
      totalGuards: filteredUsers.length,
      todayAttendance,
      monthlyAttendanceRate: rate,
      totalSites: filteredSitesForStats.length,
    };
  }, [users, sites, attendanceLogs, selectedMonth, selectedCompany, selectedSiteId]);

  const handleCompanyChange = (value: string) => {
    setSelectedCompany(value);
    setSelectedSiteId("all");
  };

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
          현장별 출근 현황을 확인하세요
        </p>
      </div>

      <StatsCards {...stats} />

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 flex-wrap">
          <MonthSelector
            selectedMonth={selectedMonth}
            onMonthChange={setSelectedMonth}
          />
          <Select value={selectedCompany} onValueChange={handleCompanyChange}>
            <SelectTrigger className="w-[180px]" data-testid="select-company">
              <SelectValue placeholder="법인 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 법인</SelectItem>
              <SelectItem value="mirae_abm">미래에이비엠</SelectItem>
              <SelectItem value="dawon_pmc">다원피엠씨</SelectItem>
            </SelectContent>
          </Select>
          <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
            <SelectTrigger className="w-[180px]" data-testid="select-site">
              <SelectValue placeholder="현장 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 현장</SelectItem>
              {filteredSites.filter(s => s.isActive).map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ExportButtons
          users={users}
          attendanceLogs={attendanceLogs}
          sites={sites}
          selectedMonth={selectedMonth}
          selectedSiteId={selectedSiteId === "all" ? undefined : selectedSiteId}
        />
      </div>

      <div className="space-y-6">
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
          <>
            {(selectedCompany === "all" || selectedCompany === "mirae_abm") && (
              <AttendanceGrid
                users={users}
                attendanceLogs={attendanceLogs}
                sites={sites}
                selectedMonth={selectedMonth}
                selectedSiteId={selectedSiteId}
                company="mirae_abm"
              />
            )}
            {(selectedCompany === "all" || selectedCompany === "dawon_pmc") && (
              <AttendanceGrid
                users={users}
                attendanceLogs={attendanceLogs}
                sites={sites}
                selectedMonth={selectedMonth}
                selectedSiteId={selectedSiteId}
                company="dawon_pmc"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
