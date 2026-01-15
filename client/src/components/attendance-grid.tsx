import { useMemo } from "react";
import { format, getDaysInMonth, startOfMonth, getDate } from "date-fns";
import { ko } from "date-fns/locale";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
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
}

export function AttendanceGrid({
  users,
  attendanceLogs,
  sites,
  selectedMonth,
  selectedSiteId,
  company,
}: AttendanceGridProps) {
  const daysInMonth = getDaysInMonth(selectedMonth);
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const filteredUsers = users.filter((u) => u.company === company && u.role === "guard");
  const siteName = selectedSiteId 
    ? sites.find((s) => s.id === selectedSiteId)?.name || "전체 현장"
    : "전체 현장";

  const attendanceMap = useMemo(() => {
    const map = new Map<string, Set<number>>();
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
          map.set(key, new Set());
        }
        map.get(key)!.add(getDate(logDate));
      }
    });
    return map;
  }, [attendanceLogs, selectedMonth, selectedSiteId, company, users]);

  const companyName = company === "mirae_abm" ? "㈜미래에이비엠" : "㈜다원피엠씨";
  const logoPath = company === "mirae_abm" ? miraeLogoPath : dawonLogoPath;

  return (
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
            <span className="text-muted-foreground">인원: <strong className="text-foreground">{filteredUsers.length}명</strong></span>
          </div>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="min-w-[900px]">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-muted/50">
                <th className="sticky left-0 z-10 bg-muted/50 w-32 min-w-[128px] p-2 text-left font-semibold border-r border-b">
                  성명
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
                filteredUsers.map((user) => {
                  const userAttendance = attendanceMap.get(user.id) || new Set();
                  return (
                    <tr key={user.id} className="hover-elevate border-b last:border-b-0">
                      <td className="sticky left-0 z-10 bg-card w-32 min-w-[128px] p-2 font-medium border-r">
                        {user.name}
                      </td>
                      {days.map((day) => (
                        <td
                          key={day}
                          className="w-9 min-w-[36px] p-1 text-center"
                        >
                          {userAttendance.has(day) ? (
                            <span className="font-bold text-primary">O</span>
                          ) : (
                            <span className="text-muted-foreground/30">-</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}
