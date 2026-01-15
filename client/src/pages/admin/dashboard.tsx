import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { startOfMonth, format, isToday, getDate } from "date-fns";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/lib/auth";
import { ThemeToggle } from "@/components/theme-toggle";
import { AttendanceGrid } from "@/components/attendance-grid";
import { StatsCards } from "@/components/stats-cards";
import { MonthSelector } from "@/components/month-selector";
import { ExportButtons } from "@/components/export-buttons";
import { SiteSelector } from "@/components/site-selector";
import { Skeleton } from "@/components/ui/skeleton";
import { LogOut, QrCode, Users, Building2, LayoutDashboard } from "lucide-react";
import miraeLogoPath from "@assets/미래ABM_LOGO_1768444471519.png";
import dawonLogoPath from "@assets/다원PMC_LOGO_1768444471518.png";
import type { User, AttendanceLog, Site } from "@shared/schema";

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [selectedMonth, setSelectedMonth] = useState(startOfMonth(new Date()));
  const [selectedSiteId, setSelectedSiteId] = useState<string | undefined>();
  const [activeTab, setActiveTab] = useState("dashboard");

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

  const stats = useMemo(() => {
    const guards = users.filter((u) => u.role === "guard" && u.isActive);
    const today = new Date();
    const todayStr = format(today, "yyyy-MM-dd");
    const todayAttendance = attendanceLogs.filter(
      (log) => log.checkInDate === todayStr
    ).length;

    const daysInMonth = new Date(
      selectedMonth.getFullYear(),
      selectedMonth.getMonth() + 1,
      0
    ).getDate();
    const currentDay = isToday(selectedMonth) ? getDate(today) : daysInMonth;
    const expectedAttendance = guards.length * currentDay;
    const actualAttendance = attendanceLogs.length;
    const rate = expectedAttendance > 0
      ? Math.round((actualAttendance / expectedAttendance) * 100)
      : 0;

    return {
      totalGuards: guards.length,
      todayAttendance,
      monthlyAttendanceRate: rate,
      totalSites: sites.filter((s) => s.isActive).length,
    };
  }, [users, sites, attendanceLogs, selectedMonth]);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>접근 권한이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-50 h-16 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="h-full max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <img src={miraeLogoPath} alt="미래에이비엠" className="h-6 object-contain" />
              <span className="text-muted-foreground">/</span>
              <img src={dawonLogoPath} alt="다원피엠씨" className="h-6 object-contain" />
            </div>
            <span className="hidden md:inline font-semibold">출근 관리 시스템</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:inline">
              {user.name}님
            </span>
            <ThemeToggle />
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              data-testid="button-logout"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="dashboard" data-testid="tab-dashboard">
              <LayoutDashboard className="h-4 w-4 mr-2" />
              대시보드
            </TabsTrigger>
            <TabsTrigger value="qr" data-testid="tab-qr">
              <QrCode className="h-4 w-4 mr-2" />
              QR 관리
            </TabsTrigger>
            <TabsTrigger value="users" data-testid="tab-users">
              <Users className="h-4 w-4 mr-2" />
              근무자
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="space-y-6">
            {isLoading ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
                <Skeleton className="h-[400px]" />
              </div>
            ) : (
              <>
                <StatsCards {...stats} />

                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-4 flex-wrap">
                    <MonthSelector
                      selectedMonth={selectedMonth}
                      onMonthChange={setSelectedMonth}
                    />
                    <SiteSelector
                      sites={sites}
                      selectedSiteId={selectedSiteId}
                      onSiteChange={setSelectedSiteId}
                    />
                  </div>
                  <ExportButtons
                    users={users}
                    attendanceLogs={attendanceLogs}
                    sites={sites}
                    selectedMonth={selectedMonth}
                    selectedSiteId={selectedSiteId}
                  />
                </div>

                <div className="space-y-6">
                  <AttendanceGrid
                    users={users}
                    attendanceLogs={attendanceLogs}
                    sites={sites}
                    selectedMonth={selectedMonth}
                    selectedSiteId={selectedSiteId}
                    company="mirae_abm"
                  />
                  <AttendanceGrid
                    users={users}
                    attendanceLogs={attendanceLogs}
                    sites={sites}
                    selectedMonth={selectedMonth}
                    selectedSiteId={selectedSiteId}
                    company="dawon_pmc"
                  />
                </div>
              </>
            )}
          </TabsContent>

          <TabsContent value="qr">
            <QRManagement sites={sites} isLoading={sitesLoading} />
          </TabsContent>

          <TabsContent value="users">
            <UserManagement users={users} sites={sites} isLoading={usersLoading} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

function QRManagement({ sites, isLoading }: { sites: Site[]; isLoading: boolean }) {
  const [, setLocation] = useLocation();
  const [showForm, setShowForm] = useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-80" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">QR 코드 관리</h2>
          <p className="text-muted-foreground">
            각 현장별 QR 코드를 생성하고 다운로드할 수 있습니다
          </p>
        </div>
        <Button onClick={() => setLocation("/admin/sites")} data-testid="button-manage-sites">
          <Building2 className="h-4 w-4 mr-2" />
          현장 관리
        </Button>
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <QrCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">등록된 현장이 없습니다</p>
          <p className="text-sm">현장을 먼저 등록해주세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites
            .filter((s) => s.isActive)
            .map((site) => (
              <QRCodeCard key={site.id} site={site} />
            ))}
        </div>
      )}
    </div>
  );
}

function QRCodeCard({ site }: { site: Site }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(true);

  useState(() => {
    const generateQR = async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const qrData = JSON.stringify({
          siteId: site.id,
          siteName: site.name,
          type: "attendance",
        });
        const url = await QRCode.toDataURL(qrData, {
          width: 256,
          margin: 2,
          color: { dark: "#1e40af", light: "#ffffff" },
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error("QR generation error:", err);
      }
      setIsGenerating(false);
    };
    generateQR();
  });

  const handleDownload = () => {
    const link = document.createElement("a");
    link.download = `QR_${site.name}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const companyName = site.company === "mirae_abm" ? "미래에이비엠" : "다원피엠씨";

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid={`card-qr-${site.id}`}>
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">{site.name}</h3>
            <p className="text-xs text-muted-foreground">{companyName}</p>
          </div>
        </div>
        {site.address && (
          <p className="text-sm text-muted-foreground mt-2">{site.address}</p>
        )}
      </div>
      <div className="p-4 space-y-4">
        <div className="flex justify-center p-4 bg-white rounded-lg">
          {isGenerating ? (
            <Skeleton className="w-48 h-48" />
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt={`${site.name} QR`} className="w-48 h-48" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-muted-foreground">
              생성 실패
            </div>
          )}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleDownload}
          disabled={!qrDataUrl}
          data-testid={`button-download-qr-${site.id}`}
        >
          <Building2 className="h-4 w-4 mr-2" />
          QR 코드 다운로드
        </Button>
      </div>
    </div>
  );
}

function UserManagement({
  users,
  sites,
  isLoading,
}: {
  users: User[];
  sites: Site[];
  isLoading: boolean;
}) {
  const guards = users.filter((u) => u.role === "guard");
  const miraeGuards = guards.filter((u) => u.company === "mirae_abm");
  const dawonGuards = guards.filter((u) => u.company === "dawon_pmc");

  if (isLoading) {
    return <Skeleton className="h-[400px]" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">근무자 관리</h2>
          <p className="text-muted-foreground">
            총 {guards.length}명의 근무자가 등록되어 있습니다
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <UserTable
          title="미래에이비엠"
          users={miraeGuards}
          company="mirae_abm"
        />
        <UserTable
          title="다원피엠씨"
          users={dawonGuards}
          company="dawon_pmc"
        />
      </div>
    </div>
  );
}

function UserTable({
  title,
  users,
  company,
}: {
  title: string;
  users: User[];
  company: string;
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm text-muted-foreground">{users.length}명</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium">이름</th>
              <th className="p-3 text-left font-medium">아이디</th>
              <th className="p-3 text-left font-medium">연락처</th>
              <th className="p-3 text-center font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  등록된 근무자가 없습니다
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t hover-elevate">
                  <td className="p-3 font-medium">{user.name}</td>
                  <td className="p-3 text-muted-foreground">{user.username}</td>
                  <td className="p-3 text-muted-foreground">{user.phone || "-"}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? "bg-green-500/10 text-green-600"
                          : "bg-red-500/10 text-red-600"
                      }`}
                    >
                      {user.isActive ? "활성" : "비활성"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
