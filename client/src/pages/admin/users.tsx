import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import type { User, Site } from "@shared/schema";

export default function UsersPage() {
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const isLoading = usersLoading || sitesLoading;
  const guards = users.filter((u) => u.role === "guard");
  const miraeGuards = guards.filter((u) => u.company === "mirae_abm");
  const dawonGuards = guards.filter((u) => u.company === "dawon_pmc");

  if (isLoading) {
    return (
      <div className="p-6">
        <Skeleton className="h-[400px]" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">근무자 관리</h1>
          <p className="text-muted-foreground">
            총 {guards.length}명의 근무자가 등록되어 있습니다
          </p>
        </div>
      </div>

      <div className="space-y-6">
        <UserTable
          title="미래에이비엠"
          users={miraeGuards}
          sites={sites.filter(s => s.company === "mirae_abm")}
        />
        <UserTable
          title="다원피엠씨"
          users={dawonGuards}
          sites={sites.filter(s => s.company === "dawon_pmc")}
        />
      </div>
    </div>
  );
}

function UserTable({
  title,
  users,
  sites,
}: {
  title: string;
  users: User[];
  sites: Site[];
}) {
  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="p-4 border-b bg-muted/30 flex items-center justify-between gap-4">
        <h3 className="font-semibold">{title}</h3>
        <span className="text-sm text-muted-foreground">{users.length}명</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-3 text-left font-medium">이름</th>
              <th className="p-3 text-left font-medium">아이디</th>
              <th className="p-3 text-left font-medium">연락처</th>
              <th className="p-3 text-center font-medium">상태</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td colSpan={4} className="p-8 text-center text-muted-foreground">
                  등록된 근무자가 없습니다
                </td>
              </tr>
            ) : (
              users.map((user) => (
                <tr key={user.id} className="border-t hover-elevate" data-testid={`row-user-${user.id}`}>
                  <td className="p-3 font-medium">{user.name}</td>
                  <td className="p-3 text-muted-foreground">{user.username}</td>
                  <td className="p-3 text-muted-foreground">{user.phone || "-"}</td>
                  <td className="p-3 text-center">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.isActive
                          ? "bg-green-500/10 text-green-600"
                          : "bg-red-500/10 text-red-600"
                      }`}
                    >
                      {user.isActive ? "활성" : "비활성"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
