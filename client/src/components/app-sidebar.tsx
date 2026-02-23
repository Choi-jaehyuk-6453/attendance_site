import { useLocation, Link } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  QrCode,
  Users,
  Building2,
  CalendarDays,
  CalendarCheck,
  LogOut,
} from "lucide-react";
import { useAuth } from "@/lib/auth";

const attendanceMenuItems = [
  {
    title: "출근기록부",
    url: "/hq-admin",
    icon: LayoutDashboard,
  },
  {
    title: "QR 관리",
    url: "/hq-admin/qr",
    icon: QrCode,
  },
];

const vacationMenuItems = [
  {
    title: "휴가 신청 현황",
    url: "/hq-admin/vacation-requests",
    icon: CalendarCheck,
  },
  {
    title: "휴가 현황",
    url: "/hq-admin/vacation-status",
    icon: CalendarDays,
  },
];

const managementMenuItems = [
  {
    title: "현장 관리",
    url: "/hq-admin/sites",
    icon: Building2,
  },
  {
    title: "근로자 관리",
    url: "/hq-admin/users",
    icon: Users,
  },
  {
    title: "담당자 관리",
    url: "/hq-admin/managers",
    icon: Users,
  },
];

import { useCompany, type Company } from "@/lib/company";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();
  const { company, setCompany } = useCompany();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="w-full justify-start gap-2 px-2 h-auto py-2">
              <div className="flex items-center gap-2 w-full">
                <div className="h-8 w-8 flex items-center justify-center shrink-0">
                  {company.logo}
                </div>
                <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                  <span className="font-semibold text-sm truncate w-full text-left">{company.name}</span>
                  <span className="text-xs text-muted-foreground truncate w-full text-left">본사 관리자</span>
                </div>
                <ChevronDown className="ml-auto h-4 w-4 opacity-50" />
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[200px]">
            <DropdownMenuItem onClick={() => setCompany("mirae_abm")}>
              미래에이비엠
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setCompany("dawon_pmc")}>
              다원피엠씨
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>출근관리</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {attendanceMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>휴가관리</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {vacationMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>기초관리</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementMenuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location === item.url}
                  >
                    <Link href={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t p-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground truncate">
            {user?.name}님 (본사)
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            data-testid="button-logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
