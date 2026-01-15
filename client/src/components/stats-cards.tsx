import { Card, CardContent } from "@/components/ui/card";
import { Users, CheckCircle, Calendar, Building } from "lucide-react";

interface StatsCardsProps {
  totalGuards: number;
  todayAttendance: number;
  monthlyAttendanceRate: number;
  totalSites: number;
}

export function StatsCards({
  totalGuards,
  todayAttendance,
  monthlyAttendanceRate,
  totalSites,
}: StatsCardsProps) {
  const stats = [
    {
      label: "총 근무자",
      value: totalGuards,
      suffix: "명",
      icon: Users,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "오늘 출근",
      value: todayAttendance,
      suffix: "명",
      icon: CheckCircle,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
    },
    {
      label: "이번 달 출근율",
      value: monthlyAttendanceRate,
      suffix: "%",
      icon: Calendar,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "관리 현장",
      value: totalSites,
      suffix: "개",
      icon: Building,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <Card key={stat.label} data-testid={`card-stat-${stat.label}`}>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-6 w-6 ${stat.color}`} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-3xl font-bold">
                  {stat.value}
                  <span className="text-lg font-normal text-muted-foreground ml-1">
                    {stat.suffix}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
