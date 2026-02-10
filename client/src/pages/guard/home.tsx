import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { getKSTNow, getKSTToday, getKSTCurrentMonth } from "@shared/kst-utils";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { QRScanner } from "@/components/qr-scanner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  QrCode,
  LogOut,
  CheckCircle2,
  Calendar,
  Clock,
  MapPin,
  User,
  XCircle,
  CalendarDays,
} from "lucide-react";
import miraeLogoPath from "@assets/미래ABM_LOGO_1768444471519.png";
import dawonLogoPath from "@assets/다원PMC_LOGO_1768444471518.png";
import type { AttendanceLog, Site } from "@shared/schema";

export default function GuardHome() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [showScanner, setShowScanner] = useState(false);
  const [todayCheckedIn, setTodayCheckedIn] = useState(false);
  const [location, setGeoLocation] = useState<{ lat: string; lng: string } | null>(null);

  const today = getKSTToday();
  const currentMonth = getKSTCurrentMonth();

  const { data: todayLog } = useQuery<AttendanceLog | null>({
    queryKey: ["/api/attendance/today", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const res = await fetch(`/api/attendance/today/${user.id}`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!user,
  });

  const { data: monthLogs = [] } = useQuery<AttendanceLog[]>({
    queryKey: ["/api/attendance/user", user?.id, currentMonth],
    queryFn: async () => {
      if (!user?.id) return [];
      const res = await fetch(`/api/attendance/user/${user.id}?month=${currentMonth}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!user,
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  useEffect(() => {
    if (todayLog) {
      setTodayCheckedIn(true);
    }
  }, [todayLog]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setGeoLocation({
            lat: position.coords.latitude.toString(),
            lng: position.coords.longitude.toString(),
          });
        },
        (error) => {
          console.log("Geolocation error:", error);
        }
      );
    }
  }, []);

  const checkInMutation = useMutation({
    mutationFn: async (data: { siteId: string; latitude?: string; longitude?: string }) => {
      const res = await apiRequest("POST", "/api/attendance/check-in", {
        ...data,
        userId: user?.id,
        checkInDate: today,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setTodayCheckedIn(true);
      setShowScanner(false);
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/today", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendance/user", user?.id, currentMonth] });
      toast({
        title: "출근 완료!",
        description: `${data.siteName}에 출근 처리되었습니다.`,
      });
    },
    onError: (error: Error) => {
      setShowScanner(false);
      toast({
        variant: "destructive",
        title: "출근 실패",
        description: error.message || "출근 처리 중 오류가 발생했습니다.",
      });
    },
  });

  const handleScan = useCallback((data: string) => {
    setShowScanner(false);
    try {
      const qrData = JSON.parse(data);
      if (qrData.type === "attendance" && qrData.siteId) {
        // Check if user has an assigned site
        if (!user?.siteId) {
          toast({
            variant: "destructive",
            title: "현장 미배정",
            description: "배정된 현장이 없습니다. 관리자에게 문의하세요.",
          });
          return;
        }
        
        // Check if QR code site matches user's assigned site
        if (qrData.siteId !== user.siteId) {
          const scannedSite = sites.find((s) => s.id === qrData.siteId);
          toast({
            variant: "destructive",
            title: "다른 현장의 QR 코드",
            description: `이 QR 코드는 "${scannedSite?.name || "다른 현장"}"의 코드입니다. 본인 현장의 QR 코드를 스캔해주세요.`,
          });
          return;
        }
        
        checkInMutation.mutate({
          siteId: qrData.siteId,
          latitude: location?.lat,
          longitude: location?.lng,
        });
      } else {
        toast({
          variant: "destructive",
          title: "잘못된 QR 코드",
          description: "올바른 출근용 QR 코드가 아닙니다.",
        });
      }
    } catch {
      toast({
        variant: "destructive",
        title: "QR 코드 인식 실패",
        description: "QR 코드를 다시 스캔해주세요.",
      });
    }
  }, [location, toast, checkInMutation, user, sites]);

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>로그인이 필요합니다.</p>
      </div>
    );
  }

  const companyName = user.company === "mirae_abm" ? "미래에이비엠" : "다원피엠씨";
  const logoPath = user.company === "mirae_abm" ? miraeLogoPath : dawonLogoPath;
  const userSite = sites.find((s) => s.id === user.siteId);
  const displayLocation = userSite ? `${companyName} ${userSite.name}` : companyName;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 h-16 border-b bg-card/95 backdrop-blur">
        <div className="h-full max-w-md mx-auto px-4 flex items-center justify-between">
          <img src={logoPath} alt={companyName} className="h-8 object-contain" />
          <div className="flex items-center gap-2">
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

      <main className="flex-1 max-w-md mx-auto px-4 py-6 w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">{user.name}님</h1>
          </div>
          <p className="text-muted-foreground">{displayLocation}</p>
          <p className="text-sm text-muted-foreground">
            {format(getKSTNow(), "yyyy년 M월 d일 (EEEE)", { locale: ko })}
          </p>
        </div>

        <Card className={todayCheckedIn ? "border-green-500/50 bg-green-500/5" : ""}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-5 w-5" />
              오늘의 출근 현황
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayCheckedIn ? (
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-green-500/10">
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                </div>
                <div>
                  <p className="font-semibold text-green-600">출근 완료</p>
                  {todayLog && (
                    <>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(todayLog.checkInTime), "HH:mm")} 출근
                      </p>
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {sites.find((s) => s.id === todayLog.siteId)?.name || "현장"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-full bg-muted">
                  <XCircle className="h-10 w-10 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-semibold">미출근</p>
                  <p className="text-sm text-muted-foreground">
                    QR 코드를 스캔하여 출근해주세요
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Button
          size="lg"
          className="w-full h-20 text-xl rounded-2xl"
          disabled={todayCheckedIn || checkInMutation.isPending}
          onClick={() => setShowScanner(true)}
          data-testid="button-check-in"
        >
          {checkInMutation.isPending ? (
            <span className="flex items-center gap-3">
              <span className="animate-spin rounded-full h-6 w-6 border-b-2 border-white" />
              처리 중...
            </span>
          ) : todayCheckedIn ? (
            <span className="flex items-center gap-3">
              <CheckCircle2 className="h-8 w-8" />
              출근 완료
            </span>
          ) : (
            <span className="flex items-center gap-3">
              <QrCode className="h-8 w-8" />
              출근하기
            </span>
          )}
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="w-full h-14 text-lg rounded-xl"
          onClick={() => setLocation("/guard/vacation")}
          data-testid="button-vacation-request"
        >
          <span className="flex items-center gap-3">
            <CalendarDays className="h-6 w-6" />
            휴가신청
          </span>
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              이번 달 출근 기록
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {format(getKSTNow(), "yyyy년 M월", { locale: ko })}
              </span>
              <span className="text-2xl font-bold">
                {monthLogs.length}
                <span className="text-base font-normal text-muted-foreground ml-1">회</span>
              </span>
            </div>
            {monthLogs.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1">
                {monthLogs.map((log) => (
                  <div
                    key={log.id}
                    className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-xs font-medium text-primary"
                    title={format(new Date(log.checkInDate), "M월 d일")}
                  >
                    {format(new Date(log.checkInDate), "d")}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="h-12 border-t flex items-center justify-center text-xs text-muted-foreground">
        <p>&copy; 2024 {companyName}</p>
      </footer>

      {showScanner && (
        <QRScanner
          onScan={handleScan}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}
