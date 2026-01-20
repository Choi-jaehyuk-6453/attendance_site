import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { ThemeToggle } from "@/components/theme-toggle";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  ArrowLeft,
  LogOut,
  CalendarDays,
  Plus,
  Calendar,
  Clock,
} from "lucide-react";
import miraeLogoPath from "@assets/미래ABM_LOGO_1768444471519.png";
import dawonLogoPath from "@assets/다원PMC_LOGO_1768444471518.png";
import type { VacationRequest } from "@shared/schema";

interface LeaveBalance {
  totalAccrued: number;
  totalUsed: number;
  totalRemaining: number;
  yearsOfService: number;
  monthsOfService: number;
  message?: string;
}

export default function GuardVacation() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [vacationType, setVacationType] = useState("annual");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");

  const { data: vacations = [], isLoading: vacationsLoading } = useQuery<VacationRequest[]>({
    queryKey: ["/api/vacations/my"],
  });

  const { data: balance } = useQuery<LeaveBalance>({
    queryKey: ["/api/vacations/balance"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: {
      vacationType: string;
      startDate: string;
      endDate: string;
      reason: string;
    }) => {
      const res = await apiRequest("POST", "/api/vacations", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vacations/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vacations/balance"] });
      setIsDialogOpen(false);
      setVacationType("annual");
      setStartDate("");
      setEndDate("");
      setReason("");
      toast({
        title: "휴가 신청 완료",
        description: "휴가 신청이 접수되었습니다. 관리자 승인을 기다려주세요.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "휴가 신청 실패",
        description: error.message || "휴가 신청 중 오류가 발생했습니다.",
      });
    },
  });

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "시작일과 종료일을 입력해주세요.",
      });
      return;
    }

    if (new Date(startDate) > new Date(endDate)) {
      toast({
        variant: "destructive",
        title: "입력 오류",
        description: "종료일은 시작일보다 같거나 나중이어야 합니다.",
      });
      return;
    }

    createMutation.mutate({
      vacationType,
      startDate,
      endDate,
      reason,
    });
  };

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">대기중</Badge>;
      case "approved":
        return <Badge className="bg-green-500 hover:bg-green-600">승인</Badge>;
      case "rejected":
        return <Badge variant="destructive">반려</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeName = (type: string) => {
    switch (type) {
      case "annual": return "연차";
      case "half_day": return "반차";
      case "sick": return "병가";
      case "other": return "기타";
      default: return type;
    }
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

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 h-16 border-b bg-card/95 backdrop-blur">
        <div className="h-full max-w-md mx-auto px-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setLocation("/guard")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
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
        <div className="text-center">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            휴가 관리
          </h1>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">연차 현황</CardTitle>
          </CardHeader>
          <CardContent>
            {balance?.message ? (
              <p className="text-muted-foreground text-sm">{balance.message}</p>
            ) : (
              <div className="grid grid-cols-3 gap-4 text-center">
                <div>
                  <p className="text-2xl font-bold text-primary">{balance?.totalAccrued || 0}</p>
                  <p className="text-xs text-muted-foreground">총 연차</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-orange-500">{balance?.totalUsed || 0}</p>
                  <p className="text-xs text-muted-foreground">사용</p>
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-500">{balance?.totalRemaining || 0}</p>
                  <p className="text-xs text-muted-foreground">잔여</p>
                </div>
              </div>
            )}
            {balance && !balance.message && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                근속기간: {balance.yearsOfService}년 {balance.monthsOfService % 12}개월
              </p>
            )}
          </CardContent>
        </Card>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="w-full h-14 text-lg rounded-xl" data-testid="button-new-vacation">
              <Plus className="h-5 w-5 mr-2" />
              휴가 신청하기
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>휴가 신청</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>휴가 유형</Label>
                <Select value={vacationType} onValueChange={setVacationType}>
                  <SelectTrigger data-testid="select-vacation-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="annual">연차</SelectItem>
                    <SelectItem value="half_day">반차</SelectItem>
                    <SelectItem value="sick">병가</SelectItem>
                    <SelectItem value="other">기타</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>시작일</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="input-start-date"
                />
              </div>
              <div className="space-y-2">
                <Label>종료일</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="input-end-date"
                />
              </div>
              <div className="space-y-2">
                <Label>사유</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="휴가 사유를 입력해주세요"
                  data-testid="input-reason"
                />
              </div>
              <Button
                className="w-full"
                onClick={handleSubmit}
                disabled={createMutation.isPending}
                data-testid="button-submit-vacation"
              >
                {createMutation.isPending ? "신청 중..." : "신청하기"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              휴가 신청 내역
            </CardTitle>
          </CardHeader>
          <CardContent>
            {vacationsLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : vacations.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">
                휴가 신청 내역이 없습니다.
              </p>
            ) : (
              <div className="space-y-3">
                {vacations
                  .sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime())
                  .map((vacation) => (
                    <div
                      key={vacation.id}
                      className="p-3 rounded-lg border bg-card"
                      data-testid={`vacation-item-${vacation.id}`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-medium">{getTypeName(vacation.vacationType || "annual")}</span>
                        {getStatusBadge(vacation.status)}
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(vacation.startDate), "yyyy.M.d", { locale: ko })} ~{" "}
                          {format(new Date(vacation.endDate), "yyyy.M.d", { locale: ko })}
                          <span className="ml-1">({vacation.days}일)</span>
                        </p>
                        {vacation.reason && <p>사유: {vacation.reason}</p>}
                        {vacation.status === "rejected" && vacation.rejectionReason && (
                          <p className="text-destructive">반려 사유: {vacation.rejectionReason}</p>
                        )}
                      </div>
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
    </div>
  );
}
