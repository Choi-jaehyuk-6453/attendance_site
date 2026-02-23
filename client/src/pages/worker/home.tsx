import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format, startOfMonth } from "date-fns";
import { ko } from "date-fns/locale";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { getKSTNow, getKSTToday } from "@shared/kst-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { QrCode, CheckCircle, Calendar, Clock, MapPin } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import type { AttendanceLog, Site } from "@shared/schema";

export default function WorkerHome() {
    const { user, logout } = useAuth();
    const { toast } = useToast();
    const [showScanner, setShowScanner] = useState(false);
    const today = getKSTToday();
    const monthStr = format(getKSTNow(), "yyyy-MM");

    const logoutMutation = useMutation({
        mutationFn: logout,
        onSuccess: () => {
            toast({ title: "로그아웃 되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "로그아웃 실패" });
        },
    });

    const { data: todayLog, isLoading: todayLoading } = useQuery<AttendanceLog | null>({
        queryKey: ["/api/attendance/today", user?.id],
        queryFn: async () => {
            if (!user?.id) return null;
            const res = await fetch(`/api/attendance/today/${user.id}`);
            if (!res.ok) return null;
            return res.json();
        },
        enabled: !!user?.id,
    });

    const { data: monthLogs = [] } = useQuery<AttendanceLog[]>({
        queryKey: ["/api/attendance/user", user?.id, monthStr],
        queryFn: async () => {
            if (!user?.id) return [];
            const res = await fetch(`/api/attendance/user/${user.id}?month=${monthStr}`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!user?.id,
    });

    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ["/api/sites"],
    });

    const checkInMutation = useMutation({
        mutationFn: async (data: { siteId: string; checkInDate: string; latitude?: string; longitude?: string }) => {
            const res = await apiRequest("POST", "/api/attendance/check-in", data);
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/attendance/today"] });
            queryClient.invalidateQueries({ queryKey: ["/api/attendance/user"] });
            setShowScanner(false);
            toast({
                title: "출근 완료!",
                description: `${data.siteName || "현장"}에 출근되었습니다.`,
            });
        },
        onError: (error: Error) => {
            toast({
                variant: "destructive",
                title: "출근 실패",
                description: error.message || "출근 처리 중 오류가 발생했습니다.",
            });
        },
    });

    const handleQrScan = (decodedText: string) => {
        try {
            const data = JSON.parse(decodedText);
            if (data.type === "attendance" && data.siteId) {
                navigator.geolocation.getCurrentPosition(
                    (position) => {
                        checkInMutation.mutate({
                            siteId: data.siteId,
                            checkInDate: today,
                            latitude: String(position.coords.latitude),
                            longitude: String(position.coords.longitude),
                        });
                    },
                    () => {
                        checkInMutation.mutate({
                            siteId: data.siteId,
                            checkInDate: today,
                        });
                    }
                );
            } else {
                toast({
                    variant: "destructive",
                    title: "잘못된 QR코드",
                    description: "출근용 QR 코드가 아닙니다.",
                });
            }
        } catch {
            toast({
                variant: "destructive",
                title: "QR 인식 실패",
                description: "QR 코드를 다시 스캔해주세요.",
            });
        }
    };

    useEffect(() => {
        if (!showScanner) return;

        const html5QrCode = new Html5Qrcode("qr-reader");
        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
            { facingMode: "environment" },
            config,
            (decodedText) => {
                html5QrCode.stop().then(() => {
                    handleQrScan(decodedText);
                }).catch(console.error);
            },
            (errorMessage) => {
                // ignore
            }
        ).catch(err => {
            console.error("Camera start failed", err);
            toast({
                variant: "destructive",
                title: "카메라 시작 실패",
                description: "권한을 확인하거나 뒤로가기 후 다시 시도해주세요."
            });
            setShowScanner(false);
        });

        return () => {
            if (html5QrCode.isScanning) {
                html5QrCode.stop().catch(console.error);
            }
            html5QrCode.clear();
        };
    }, [showScanner]);

    const attendanceStats = useMemo(() => {
        const normalDays = monthLogs.filter(l => l.attendanceType === "normal").length;
        const vacationDays = monthLogs.filter(l => l.attendanceType !== "normal").length;
        return { normalDays, vacationDays, totalDays: monthLogs.length };
    }, [monthLogs]);

    const siteName = user?.siteId
        ? sites.find(s => s.id === user.siteId)?.name || "미배정"
        : "미배정";

    const isCheckedIn = !!todayLog;

    if (todayLoading) {
        return (
            <div className="min-h-screen bg-background p-4 space-y-4">
                <Skeleton className="h-32" />
                <Skeleton className="h-48" />
                <Skeleton className="h-32" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Header */}
            <div className="bg-primary text-primary-foreground p-6">
                <div className="max-w-lg mx-auto flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">{user?.name}님, 안녕하세요</h1>
                        <p className="text-primary-foreground/80 text-sm mt-1">
                            {format(getKSTNow(), "yyyy년 M월 d일 EEEE", { locale: ko })}
                        </p>
                        <div className="flex items-center gap-2 mt-2 text-sm text-primary-foreground/70">
                            <MapPin className="h-4 w-4" />
                            <span>{siteName}</span>
                        </div>
                    </div>
                    <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => logoutMutation.mutate()}
                        disabled={logoutMutation.isPending}
                    >
                        로그아웃
                    </Button>
                </div>
            </div>

            <div className="max-w-lg mx-auto p-4 space-y-4 -mt-4">
                {/* Today's Status Card */}
                <Card className="shadow-lg">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="font-semibold text-lg">오늘 출근 현황</h2>
                            {isCheckedIn ? (
                                <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    출근 완료
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-orange-600 border-orange-600">
                                    <Clock className="h-3 w-3 mr-1" />
                                    미출근
                                </Badge>
                            )}
                        </div>

                        {isCheckedIn && todayLog?.checkInTime ? (
                            <div className="text-center py-4">
                                <p className="text-4xl font-bold text-primary">
                                    {format(new Date(todayLog.checkInTime), "HH:mm")}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">출근 시간</p>
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <Button
                                    size="lg"
                                    className="w-full h-16 text-lg"
                                    onClick={() => setShowScanner(true)}
                                    disabled={checkInMutation.isPending}
                                >
                                    <QrCode className="h-6 w-6 mr-3" />
                                    {checkInMutation.isPending ? "처리중..." : "QR 스캔으로 출근하기"}
                                </Button>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* QR Scanner */}
                {showScanner && (
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-base flex items-center gap-2">
                                <QrCode className="h-5 w-5" />
                                QR 코드 스캔
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div id="qr-reader" className="w-full" />
                            <Button
                                variant="outline"
                                className="w-full mt-4"
                                onClick={() => setShowScanner(false)}
                            >
                                취소
                            </Button>
                        </CardContent>
                    </Card>
                )}

                {/* Monthly Summary */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-base flex items-center gap-2">
                            <Calendar className="h-5 w-5" />
                            {format(getKSTNow(), "M월", { locale: ko })} 출근 현황
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                                <p className="text-2xl font-bold text-primary">{attendanceStats.normalDays}</p>
                                <p className="text-xs text-muted-foreground">출근일</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-blue-600">{attendanceStats.vacationDays}</p>
                                <p className="text-xs text-muted-foreground">휴가일</p>
                            </div>
                            <div>
                                <p className="text-2xl font-bold">{attendanceStats.totalDays}</p>
                                <p className="text-xs text-muted-foreground">총 기록</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Links */}
                <div className="grid grid-cols-1 gap-3">
                    <Button variant="outline" className="h-14 justify-start" asChild>
                        <a href="/worker/vacation">
                            <Calendar className="h-5 w-5 mr-3" />
                            휴가 신청
                        </a>
                    </Button>
                </div>
            </div>
        </div>
    );
}
