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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { User, AttendanceLog, Site, Department } from "@shared/schema";

interface AttendanceGridProps {
  users: User[];
  attendanceLogs: AttendanceLog[];
  sites: Site[];
  departments?: Department[];
  selectedMonth: Date;
  selectedSiteId?: string;
  isAdmin?: boolean;
}

export function AttendanceGrid(props: AttendanceGridProps) {
  const {
    users,
    attendanceLogs,
    sites,
    selectedMonth,
    selectedSiteId,
    isAdmin = false,
  } = props;
  const { toast } = useToast();
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    action: "add" | "edit" | "remove";
    userId: string;
    userName: string;
    siteId: string;
    date: string;
    day: number;
    currentType?: string;
  } | null>(null);
  const [selectedType, setSelectedType] = useState<string>("normal");

  const daysInMonth = getDaysInMonth(selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const activeUsers = users.filter((u) => (u.role === "worker" || u.role === "site_manager") && u.isActive);
  const activeSites = sites.filter((s) => s.isActive);

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
      (u.role === "worker" || u.role === "site_manager") &&
      !u.isActive &&
      userIdsWithAttendance.has(u.id)
    );
  }, [users, attendanceLogs, selectedMonth, selectedSiteId]);

  const filteredUsers = [...activeUsers, ...usersWithAttendanceInMonth];

  const sitesWithUsers = useMemo(() => {
    const siteUserMap = new Map<string, { site: Site; users: User[] }>();

    activeSites.forEach((site) => {
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
  }, [activeSites, filteredUsers, selectedSiteId]);

  // Map of userId -> Map of day -> attendance info
  const attendanceMap = useMemo(() => {
    const map = new Map<string, Map<number, { type: string }>>();
    attendanceLogs.forEach((log) => {
      if (selectedSiteId && log.siteId !== selectedSiteId) return;

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
        const attendanceType = log.attendanceType || "normal";
        map.get(key)!.set(getDate(logDate), { type: attendanceType });
      }
    });
    return map;
  }, [attendanceLogs, selectedMonth, selectedSiteId]);

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

  const attendanceTypeOptions = [
    { value: "normal", label: "출근 (O)" },
    { value: "annual", label: "연차 (연)" },
    { value: "half_day", label: "반차 (반)" },
    { value: "sick", label: "병가 (병)" },
    { value: "family_event", label: "경조사 (경)" },
    { value: "other", label: "기타 (기)" },
  ];

  const addAttendanceMutation = useMutation({
    mutationFn: async (data: { userId: string; siteId: string; checkInDate: string; attendanceType: string }) => {
      const res = await apiRequest("POST", "/api/admin/attendance", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "등록 완료", description: "기록이 추가되었습니다." });
      setConfirmDialog(null);
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "등록에 실패했습니다.", variant: "destructive" });
    },
  });

  const updateAttendanceMutation = useMutation({
    mutationFn: async (data: { userId: string; checkInDate: string; attendanceType: string }) => {
      const res = await apiRequest("PATCH", "/api/admin/attendance", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "수정 완료", description: "기록이 수정되었습니다." });
      setConfirmDialog(null);
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "수정에 실패했습니다.", variant: "destructive" });
    },
  });

  const removeAttendanceMutation = useMutation({
    mutationFn: async (data: { userId: string; checkInDate: string }) => {
      await apiRequest("DELETE", "/api/admin/attendance", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
      toast({ title: "삭제 완료", description: "기록이 삭제되었습니다." });
      setConfirmDialog(null);
    },
    onError: (error: Error) => {
      toast({ title: "오류", description: error.message || "삭제에 실패했습니다.", variant: "destructive" });
    },
  });

  const handleCellClick = (user: User, day: number, attendanceInfo: { type: string } | undefined, siteId: string) => {
    if (!isAdmin) return;
    if (!siteId && !attendanceInfo) {
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

    if (attendanceInfo) {
      setSelectedType(attendanceInfo.type);
      setConfirmDialog({
        open: true,
        action: "edit",
        userId: user.id,
        userName: user.name,
        siteId,
        date: checkInDate,
        day,
        currentType: attendanceInfo.type,
      });
    } else {
      setSelectedType("normal");
      setConfirmDialog({
        open: true,
        action: "add",
        userId: user.id,
        userName: user.name,
        siteId,
        date: checkInDate,
        day,
      });
    }
  };

  const handleConfirm = () => {
    if (!confirmDialog) return;

    if (confirmDialog.action === "add") {
      addAttendanceMutation.mutate({
        userId: confirmDialog.userId,
        siteId: confirmDialog.siteId,
        checkInDate: confirmDialog.date,
        attendanceType: selectedType,
      });
    } else if (confirmDialog.action === "edit") {
      if (selectedType !== confirmDialog.currentType) {
        updateAttendanceMutation.mutate({
          userId: confirmDialog.userId,
          checkInDate: confirmDialog.date,
          attendanceType: selectedType,
        });
      } else {
        setConfirmDialog(null);
      }
    }
  };

  const handleDelete = () => {
    if (!confirmDialog) return;
    removeAttendanceMutation.mutate({
      userId: confirmDialog.userId,
      checkInDate: confirmDialog.date,
    });
  };

  // Sort users by name
  const sortUsers = (usersList: User[]) => {
    return [...usersList].sort((a, b) => a.name.localeCompare(b.name, "ko"));
  };

  const siteUserCount = useMemo(() => {
    return sitesWithUsers.sitesData.reduce((acc, data) => acc + data.users.length, 0)
      + sitesWithUsers.unassignedUsers.length;
  }, [sitesWithUsers]);

  const siteName = selectedSiteId
    ? sites.find((s) => s.id === selectedSiteId)?.name || "전체 현장"
    : "전체 현장";

  const renderAttendanceCell = (user: User, day: number, userAttendance: Map<number, { type: string }>, siteId: string) => {
    const attendance = userAttendance.get(day);
    const display = attendance ? getAttendanceDisplay(attendance.type) : null;

    if (isAdmin) {
      return (
        <td
          key={day}
          className="w-9 min-w-[36px] p-1 text-center cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => handleCellClick(user, day, attendance, siteId)}
          data-testid={`cell-attendance-${user.id}-${day}`}
        >
          {attendance && display ? (
            <span className={`font-bold ${display.color}`}>{display.text}</span>
          ) : (
            <span className="text-muted-foreground/30">-</span>
          )}
        </td>
      );
    }

    return (
      <td key={day} className="w-9 min-w-[36px] p-1 text-center">
        {attendance && display ? (
          <span className={`font-bold ${display.color}`}>{display.text}</span>
        ) : (
          <span className="text-muted-foreground/30">-</span>
        )}
      </td>
    );
  };

  return (
    <>
      <div className="rounded-lg border bg-card overflow-hidden" data-testid="grid-attendance">
        <div className="p-4 border-b bg-muted/30">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h3 className="font-semibold text-lg">근로자 출근기록부</h3>
              <p className="text-sm text-muted-foreground">
                {format(selectedMonth, "yyyy년 M월", { locale: ko })}
              </p>
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
                    <th key={day} className="w-9 min-w-[36px] p-1 text-center font-medium border-b">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={daysInMonth + 1} className="p-8 text-center text-muted-foreground">
                      등록된 근무자가 없습니다
                    </td>
                  </tr>
                ) : (
                  <>
                    {selectedSiteId && selectedSiteId !== "all" ? (
                      // Group by Department for single site
                      <>
                        {(() => {
                          const siteDepartments = props.departments?.filter(d => d.siteId === selectedSiteId).sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)) || [];
                          // Users in this site
                          const siteUsers = filteredUsers.filter(u => u.siteId === selectedSiteId);

                          // Map departmentId -> users
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

                          return (
                            <>
                              {siteDepartments.map(dept => {
                                const users = deptUserMap.get(dept.id) || [];
                                if (users.length === 0) return null;
                                const sortedUsers = sortUsers(users);
                                return (
                                  <Fragment key={`dept-group-${dept.id}`}>
                                    <tr className="bg-muted/30">
                                      <td
                                        colSpan={daysInMonth + 1}
                                        className="sticky left-0 z-10 bg-muted/30 p-2 font-semibold text-primary border-b"
                                      >
                                        {dept.name}
                                        <span className="text-muted-foreground font-normal ml-2">
                                          ({users.length}명)
                                        </span>
                                      </td>
                                    </tr>
                                    {sortedUsers.map((user) => {
                                      const userAttendance = attendanceMap.get(user.id) || new Map();
                                      return (
                                        <tr key={user.id} className="hover:bg-muted/20 border-b">
                                          <td className="sticky left-0 z-10 bg-card w-32 min-w-[128px] p-2 pl-6 font-medium border-r">
                                            <span>{user.name}</span>
                                            {user.jobTitle && <span className="text-xs text-muted-foreground ml-1">({user.jobTitle})</span>}
                                          </td>
                                          {days.map((day) => renderAttendanceCell(user, day, userAttendance, user.siteId || ""))}
                                        </tr>
                                      );
                                    })}
                                  </Fragment>
                                );
                              })}

                              {/* Users with no department */}
                              {usersNoDept.length > 0 && (
                                <>
                                  <tr className="bg-muted/30">
                                    <td
                                      colSpan={daysInMonth + 1}
                                      className="sticky left-0 z-10 bg-muted/30 p-2 font-semibold text-muted-foreground border-b"
                                    >
                                      미배치 (부서 없음)
                                      <span className="font-normal ml-2">
                                        ({usersNoDept.length}명)
                                      </span>
                                    </td>
                                  </tr>
                                  {sortUsers(usersNoDept).map((user) => {
                                    const userAttendance = attendanceMap.get(user.id) || new Map();
                                    return (
                                      <tr key={user.id} className="hover:bg-muted/20 border-b last:border-b-0">
                                        <td className="sticky left-0 z-10 bg-card w-32 min-w-[128px] p-2 pl-6 font-medium border-r">
                                          <span>{user.name}</span>
                                          {user.jobTitle && <span className="text-xs text-muted-foreground ml-1">({user.jobTitle})</span>}
                                        </td>
                                        {days.map((day) => renderAttendanceCell(user, day, userAttendance, user.siteId || ""))}
                                      </tr>
                                    );
                                  })}
                                </>
                              )}
                            </>
                          );
                        })()}
                      </>
                    ) : (
                      // Group by Site (existing logic)
                      <>
                        {sitesWithUsers.sitesData.map(({ site, users: siteUsers }) => {
                          const sortedUsers = sortUsers(siteUsers);
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
                                return (
                                  <tr key={user.id} className="hover:bg-muted/20 border-b">
                                    <td className="sticky left-0 z-10 bg-card w-32 min-w-[128px] p-2 pl-6 font-medium border-r">
                                      <span>{user.name}</span>
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
                            {sortUsers(sitesWithUsers.unassignedUsers).map((user) => {
                              const userAttendance = attendanceMap.get(user.id) || new Map();
                              return (
                                <tr key={user.id} className="hover:bg-muted/20 border-b last:border-b-0">
                                  <td className="sticky left-0 z-10 bg-card w-32 min-w-[128px] p-2 pl-6 font-medium border-r">
                                    <span>{user.name}</span>
                                  </td>
                                  {days.map((day) => renderAttendanceCell(user, day, userAttendance, user.siteId || ""))}
                                </tr>
                              );
                            })}
                          </>
                        )}
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
              {confirmDialog?.action === "add" ? "출근/휴가 등록" : "출근/휴가 수정"}
            </DialogTitle>
            <DialogDescription>
              {confirmDialog?.userName}님 - {confirmDialog?.day}일
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label className="text-sm font-medium mb-2 block">유형 선택</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger data-testid="select-attendance-type">
                <SelectValue placeholder="유형 선택" />
              </SelectTrigger>
              <SelectContent>
                {attendanceTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`option-type-${opt.value}`}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="flex-wrap gap-2">
            {confirmDialog?.action === "edit" && (
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={removeAttendanceMutation.isPending}
                data-testid="button-delete-attendance"
              >
                {removeAttendanceMutation.isPending ? "삭제중..." : "삭제"}
              </Button>
            )}
            <div className="flex gap-2 ml-auto">
              <Button
                variant="outline"
                onClick={() => setConfirmDialog(null)}
                data-testid="button-cancel-attendance"
              >
                취소
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={addAttendanceMutation.isPending || updateAttendanceMutation.isPending}
                data-testid="button-confirm-attendance"
              >
                {addAttendanceMutation.isPending || updateAttendanceMutation.isPending
                  ? "처리중..."
                  : confirmDialog?.action === "add" ? "등록" : "수정"
                }
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
