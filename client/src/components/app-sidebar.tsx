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
  UserCog,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import miraeLogoPath from "@assets/미래ABM_LOGO_1768444471519.png";

const attendanceMenuItems = [
  {
    title: "출근기록부",
    url: "/admin",
    icon: LayoutDashboard,
  },
  {
    title: "QR 관리",
    url: "/admin/qr",
    icon: QrCode,
  },
];

const vacationMenuItems = [
  {
    title: "휴가 신청 현황",
    url: "/admin/vacation-requests",
    icon: CalendarCheck,
  },
  {
    title: "휴가 현황",
    url: "/admin/vacation-status",
    icon: CalendarDays,
  },
];

const managementMenuItems = [
  {
    title: "현장 관리",
    url: "/admin/sites",
    icon: Building2,
  },
  {
    title: "근무자 관리",
    url: "/admin/users",
    icon: Users,
  },
  {
    title: "담당자 관리",
    url: "/admin/contacts",
    icon: UserCog,
  },
];

export function AppSidebar() {
  const [location, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    setLocation("/");
  };

  return (
    <Sidebar>
      <SidebarHeader className="border-b p-4">
        <div className="flex items-center gap-2">
          <img src={miraeLogoPath} alt="미래에이비엠" className="h-6 object-contain" />
          <span className="font-semibold text-sm">경비원 근태관리</span>
        </div>
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
                    data-testid={`sidebar-${item.url.replace("/admin/", "").replace("/admin", "dashboard")}`}
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
                    data-testid={`sidebar-${item.url.replace("/admin/", "")}`}
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
                    data-testid={`sidebar-${item.url.replace("/admin/", "")}`}
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
            {user?.name}님
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
