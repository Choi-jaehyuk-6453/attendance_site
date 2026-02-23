import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
    Users,
    ClipboardList,
    LogOut,
    Calendar,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { COMPANIES, type Company } from "@/lib/company";
import type { Site } from "@shared/schema";

const menuItems = [
    {
        title: "대시보드",
        url: "/site-manager",
        icon: LayoutDashboard,
    },
    {
        title: "근로자 관리",
        url: "/site-manager/workers",
        icon: Users,
    },
    {
        title: "출근기록부",
        url: "/site-manager/attendance",
        icon: ClipboardList,
    },
    {
        title: "휴가 관리",
        url: "/site-manager/vacations",
        icon: Calendar,
    },
    {
        title: "담당자 관리",
        url: "/site-manager/managers",
        icon: Users,
    },
];

export function SiteManagerSidebar() {
    const [location, setLocation] = useLocation();
    const { user, logout } = useAuth();

    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ["/api/sites"],
    });

    const handleLogout = async () => {
        await logout();
        setLocation("/");
    };

    const companyId = (user?.company as Company) || "mirae_abm";
    const company = COMPANIES[companyId];
    const siteName = sites.find(s => s.id === user?.siteId)?.name || "";

    return (
        <Sidebar>
            <SidebarHeader className="border-b p-4">
                <div className="flex items-center gap-2">
                    <div className="h-8 w-8 flex items-center justify-center shrink-0">
                        {company.logo}
                    </div>
                    <div className="flex flex-col">
                        <span className="font-semibold text-sm">현장 근태관리</span>
                        {siteName && (
                            <span className="text-xs text-muted-foreground">{siteName}</span>
                        )}
                    </div>
                </div>
            </SidebarHeader>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>현장 관리</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {menuItems.map((item) => (
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
                        {user?.name}님 (현장관리)
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
