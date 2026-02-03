import { useMemo, Fragment, useState } from "react";
import { format, getDaysInMonth, startOfMonth, getDate } from "date-fns";
import { ko } from "date-fns/locale";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { User, AttendanceLog, Site } from "@shared/schema";
import miraeLogoPath from "@assets/미래ABM_LOGO_1768444471519.png";
import dawonLogoPath from "@assets/다원PMC_LOGO_1768444471518.png";

interface AttendanceGridProps {
  users: User[];
  attendanceLogs: AttendanceLog[];
  sites: Site[];
  selectedMonth: Date;
  selectedSiteId?: string;
  company: "mirae_abm" | "dawon_pmc";
  isAdmin?: boolean;
}

export function AttendanceGrid({
  users,
  attendanceLogs,
  sites,
  selectedMonth,
  selectedSiteId,
  company,
  isAdmin = false,
}: AttendanceGridProps) {
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "add" | "remove";
    userId: string;
    userName: string;
    siteId: string;
    date: string;
    day: number;
  } | null>(null);

  const daysInMonth = getDaysInMonth(selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const activeUsers = users.filter((u) => u.company === company && u.role === "guard" && u.isActive);
  const companySites = sites.filter((s) => s.company === company && s.isActive);
  
  const usersWithAttendanceInMonth = useMemo(() => {
    const monthStart = startOfMonth(selectedMonth);
    const userIdsWithAttendance = new Set<string>();
    
    attendanceLogs.forEach((log) => {
      if (selectedSiteId && log.siteId !== selectedSiteId) return;
      const logDate = new Date(log.checkInDate);
      if (
        logDate.getFullYear() === monthStart.getFullYear() &&
        logDate.getMonth() === monthStart.getMonth()
      ) {
        userIdsWithAttendance.add(log.userId);
      }
    });
    
    return users.filter((u) => 
      u.company === company && 
      u.role === "guard" && 
      !u.isActive && 
      userIdsWithAttendance.has(u.id)
    );
  }, [users, attendanceLogs, selectedMonth, selectedSiteId, company]);

  const filteredUsers = [...activeUsers, ...usersWithAttendanceInMonth];

  const sitesWithUsers = useMemo(() => {
    const siteUserMap = new Map<string, { site: Site; users: User[] }>();
    
    companySites.forEach((site) => {
      if (selectedSiteId && site.id !== selectedSiteId) return;
      siteUserMap.set(site.id, { site, users: [] });
    });

    filteredUsers.forEach((user) => {
      const siteId = user.siteId;
      if (siteId && siteUserMap.has(siteId)) {
        siteUserMap.get(siteId)!.users.push(user);
      }
    });

    const usersWithSite = new Set<string>();
    siteUserMap.forEach((data) => {
      data.users.forEach((u) => usersWithSite.add(u.id));
    });

    const usersWithoutSite = selectedSiteId 
      ? [] 
      : filteredUsers.filter((u) => !usersWithSite.has(u.id));

    return {
      sitesData: Array.from(siteUserMap.values()).filter((d) => d.users.length > 0),
      unassignedUsers: usersWithoutSite,
    };
  }, [companySites, filteredUsers, selectedSiteId]);

  // Map of userId -> Map of day -> attendance info (type and whether it exists)
  const attendanceMap = useMemo(() => {
    const map = new Map<string, Map<number, { type: string }>>();
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
        if (!map.has(key)) {
          map.set(key, new Map());
        }
        const attendanceType = (log as AttendanceLog & { attendanceType?: string }).attendanceType || "normal";
        map.get(key)!.set(getDate(logDate), { type: attendanceType });
      }
    });
    return map;
  }, [attendanceLogs, selectedMonth, selectedSiteId, company, users]);

  // Helper to get display text for attendance type
  const getAttendanceDisplay = (type: string) => {
    switch (type) {
      case "annual": return { text: "연", color: "text-blue-600" };
      case "half_day": return { text: "반", color: "text-cyan-600" };
      case "sick": return { text: "병", color: "text-orange-600" };
      case "family_event": return { text: "경", color: "text-purple-600" };
      case "other": return { text: "기", color: "text-gray-600" };
      default: return { text: "O", color: "text-primary" };
    }
  };

  const addAttendanceMutation = useMutation({
    mutationFn: async (data: { userId: string; siteId: string; checkInDate: string }) => {
      const res = await apiRequest("POST", "/api/admin/attendance", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({
        title: "출근 등록 완료",
        description: "출근 기록이 추가되었습니다.",
      });
      setConfirmDialog(null);
    },
    onError: (error: Error) => {
      toast({
        title: "오류",
        description: error.message || "출근 등록에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const removeAttendanceMutation = useMutation({
    mutationFn: async (data: { userId: string; checkInDate: string }) => {
      await apiRequest("DELETE", "/api/admin/attendance", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({
        title: "출근 취소 완료",
        description: "출근 기록이 삭제되었습니다.",
      });
      setConfirmDialog(null);
    },
    onError: (error: Error) => {
      toast({
        title: "오류",
        description: error.message || "출근 취소에 실패했습니다.",
        variant: "destructive",
      });
    },
  });

  const handleCellClick = (user: User, day: number, hasAttendance: boolean, siteId: string) => {
    if (!isAdmin) return;
    if (!siteId && !hasAttendance) {
      toast({
        title: "알림",
        description: "미배치 근무자는 현장 배정 후 출근 등록이 가능합니다.",
        variant: "destructive",
      });
      return;
    }
    
    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();
    const checkInDate = format(new Date(year, month, day), "yyyy-MM-dd");
    
    setConfirmDialog({
      open: true,
      action: hasAttendance ? "remove" : "add",
      userId: user.id,
      userName: user.name,
      siteId,
      date: checkInDate,
      day,
    });
  };

  const handleConfirm = () => {
    if (!confirmDialog) return;
    
    if (confirmDialog.action === "add") {
      addAttendanceMutation.mutate({
        userId: confirmDialog.userId,
        siteId: confirmDialog.siteId,
        checkInDate: confirmDialog.date,
      });
    } else {
      removeAttendanceMutation.mutate({
        userId: confirmDialog.userId,
        checkInDate: confirmDialog.date,
      });
    }
  };

  const companyName = company === "mirae_abm" ? "㈜미래에이비엠" : "㈜다원피엠씨";
  const logoPath = company === "mirae_abm" ? miraeLogoPath : dawonLogoPath;

  // Shift sort order: 주간(day), A, B, C, D
  const shiftOrder: Record<string, number> = { day: 0, A: 1, B: 2, C: 3, D: 4 };
  const shiftLabels: Record<string, string> = { day: "주간", A: "A조", B: "B조", C: "C조", D: "D조" };
  
  // Sort users by shift
  const sortUsersByShift = (usersList: User[]) => {
    return [...usersList].sort((a, b) => {
      const orderA = shiftOrder[a.shift || "day"] ?? 99;
      const orderB = shiftOrder[b.shift || "day"] ?? 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, "ko");
    });
  };

  // Calculate user count based on actual displayed users
  const siteUserCount = useMemo(() => {
    const displayedUsers = sitesWithUsers.sitesData.reduce((acc, data) => acc + data.users.length, 0) 
      + sitesWithUsers.unassignedUsers.length;
    return displayedUsers;
  }, [sitesWithUsers]);

  const siteName = selectedSiteId 
    ? sites.find((s) => s.id === selectedSiteId)?.name || "전체 현장"
    : "전체 현장";

  const renderAttendanceCell = (user: User, day: number, userAttendance: Map<number, { type: string }>, siteId: string) => {
    const attendance = userAttendance.get(day);
    const hasAttendance = !!attendance;
    const display = attendance ? getAttendanceDisplay(attendance.type) : null;
    
    if (isAdmin) {
      return (
        <td
          key={day}
          className="w-9 min-w-[36px] p-1 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => handleCellClick(user, day, hasAttendance, siteId)}
          data-testid={`cell-attendance-${user.id}-${day}`}
        >
          {hasAttendance && display ? (
            <span className={`font-bold ${display.color}`}>{display.text}</span>
          ) : (
            <span className="text-muted-foreground/30">-</span>
          )}
        </td>
      );
    }

    return (
      <td
        key={day}
        className="w-9 min-w-[36px] p-1 text-center"
      >
        {hasAttendance && display ? (
          <span className={`font-bold ${display.color}`}>{display.text}</span>
        ) : (
          <span className="text-muted-foreground/30">-</span>
        )}
      </td>
    );
  };

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden" data-testid={`grid-attendance-${company}`}>
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <img 
                src={logoPath} 
                alt={companyName} 
                className="h-8 object-contain"
              />
              <div>
                <h3 className="font-semibold text-lg">{companyName} 근무자 출근기록부</h3>
                <p className="text-sm text-muted-foreground">
                  {format(selectedMonth, "yyyy년 M월", { locale: ko })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">현장명: <strong className="text-foreground">{siteName}</strong></span>
              <span className="text-muted-foreground">인원: <strong className="text-foreground">{siteUserCount}명</strong></span>
              {isAdmin && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  클릭하여 출근 수정
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
            <span className="text-muted-foreground">범례:</span>
            <span className="flex items-center gap-1"><span className="font-bold text-primary">O</span> 출근</span>
            <span className="flex items-center gap-1"><span className="font-bold text-blue-600">연</span> 연차</span>
            <span className="flex items-center gap-1"><span className="font-bold text-cyan-600">반</span> 반차</span>
            <span className="flex items-center gap-1"><span className="font-bold text-orange-600">병</span> 병가</span>
            <span className="flex items-center gap-1"><span className="font-bold text-purple-600">경</span> 경조사</span>
            <span className="flex items-center gap-1"><span className="font-bold text-gray-600">기</span> 기타</span>
          </div>
        </div>

        <ScrollArea className="w-full">
          <div className="min-w-[900px]">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-muted/50">
                  <th className="sticky left-0 z-10 bg-muted/50 w-32 min-w-[128px] p-2 text-left font-semibold border-r border-b">
                    현장 / 성명
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      className="w-9 min-w-[36px] p-1 text-center font-medium border-b"
                    >
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={daysInMonth + 1}
                      className="p-8 text-center text-muted-foreground"
                    >
                      등록된 근무자가 없습니다
                    </td>
                  </tr>
                ) : (
                  <>
                    {sitesWithUsers.sitesData.map(({ site, users: siteUsers }) => {
                      const sortedUsers = sortUsersByShift(siteUsers);
                      return (
                        <Fragment key={`site-group-${site.id}`}>
                          <tr className="bg-muted/30">
                            <td
                              colSpan={daysInMonth + 1}
                              className="sticky left-0 z-10 bg-muted/30 p-2 font-semibold text-primary border-b"
                            >
                              {site.name}
                              <span className="text-muted-foreground font-normal ml-2">
                                ({siteUsers.length}명)
                              </span>
                            </td>
                          </tr>
                          {sortedUsers.map((user) => {
                            const userAttendance = attendanceMap.get(user.id) || new Map();
                            const shiftLabel = shiftLabels[user.shift || "day"] || "주간";
                            return (
                              <tr key={user.id} className="hover-elevate border-b">
                                <td className="sticky left-0 z-10 bg-card w-32 min-w-[128px] p-2 pl-6 font-medium border-r">
                                  <span>{user.name}</span>
                                  <span className="ml-1 text-xs text-muted-foreground">({shiftLabel})</span>
                                </td>
                                {days.map((day) => renderAttendanceCell(user, day, userAttendance, site.id))}
                              </tr>
                            );
                          })}
                        </Fragment>
                      );
                    })}
                    {sitesWithUsers.unassignedUsers.length > 0 && (
                      <>
                        <tr className="bg-muted/30">
                          <td
                            colSpan={daysInMonth + 1}
                            className="sticky left-0 z-10 bg-muted/30 p-2 font-semibold text-muted-foreground border-b"
                          >
                            미배치
                            <span className="font-normal ml-2">
                              ({sitesWithUsers.unassignedUsers.length}명)
                            </span>
                          </td>
                        </tr>
                        {sortUsersByShift(sitesWithUsers.unassignedUsers).map((user) => {
                          const userAttendance = attendanceMap.get(user.id) || new Map();
                          const shiftLabel = shiftLabels[user.shift || "day"] || "주간";
                          return (
                            <tr key={user.id} className="hover-elevate border-b last:border-b-0">
                              <td className="sticky left-0 z-10 bg-card w-32 min-w-[128px] p-2 pl-6 font-medium border-r">
                                <span>{user.name}</span>
                                <span className="ml-1 text-xs text-muted-foreground">({shiftLabel})</span>
                              </td>
                              {days.map((day) => renderAttendanceCell(user, day, userAttendance, user.siteId || ""))}
                            </tr>
                          );
                        })}
                      </>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      <Dialog open={confirmDialog?.open || false} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmDialog?.action === "add" ? "출근 등록" : "출근 취소"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.action === "add" 
                ? `${confirmDialog?.userName}님의 ${confirmDialog?.day}일 출근을 등록하시겠습니까?`
                : `${confirmDialog?.userName}님의 ${confirmDialog?.day}일 출근을 취소하시겠습니까?`
              }
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setConfirmDialog(null)}
              data-testid="button-cancel-attendance"
            >
              취소
            </Button>
            <Button 
              onClick={handleConfirm}
              disabled={addAttendanceMutation.isPending || removeAttendanceMutation.isPending}
              variant={confirmDialog?.action === "remove" ? "destructive" : "default"}
              data-testid="button-confirm-attendance"
            >
              {addAttendanceMutation.isPending || removeAttendanceMutation.isPending 
                ? "처리중..." 
                : "확인"
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
