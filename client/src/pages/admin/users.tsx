import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, UserPlus } from "lucide-react";
import type { User, Site } from "@shared/schema";

const createGuardSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  phone: z.string().min(4, "전화번호를 입력해주세요 (최소 4자리)"),
  siteId: z.string().min(1, "현장을 선택해주세요"),
});

type CreateGuardForm = z.infer<typeof createGuardSchema>;

export default function UsersPage() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const form = useForm<CreateGuardForm>({
    resolver: zodResolver(createGuardSchema),
    defaultValues: {
      name: "",
      phone: "",
      siteId: "",
    },
  });

  const createGuardMutation = useMutation({
    mutationFn: async (data: CreateGuardForm) => {
      const last4Digits = data.phone.replace(/\D/g, "").slice(-4);
      if (last4Digits.length < 4) {
        throw new Error("전화번호 끝 4자리를 입력해주세요");
      }
      
      const res = await apiRequest("POST", "/api/users", {
        username: data.name,
        password: last4Digits,
        name: data.name,
        phone: data.phone,
        siteId: data.siteId,
        role: "guard",
        company: "mirae_abm",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "등록 완료",
        description: "새 근무자가 등록되었습니다. 비밀번호는 전화번호 끝 4자리입니다.",
      });
      setDialogOpen(false);
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "등록 실패",
        description: error.message || "근무자 등록 중 오류가 발생했습니다.",
      });
    },
  });

  const onSubmit = (data: CreateGuardForm) => {
    createGuardMutation.mutate(data);
  };

  const isLoading = usersLoading || sitesLoading;
  const guards = users.filter((u) => u.role === "guard");
  const activeSites = sites.filter(s => s.isActive);

  const guardsBySite = activeSites.map(site => ({
    site,
    guards: guards.filter(g => g.siteId === site.id),
  }));

  const unassignedGuards = guards.filter(g => !g.siteId || !activeSites.find(s => s.id === g.siteId));

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
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-guard">
              <UserPlus className="h-4 w-4 mr-2" />
              근무자 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 근무자 등록</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이름 (로그인 아이디)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="홍길동"
                          data-testid="input-guard-name"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        이름이 로그인 아이디로 사용됩니다
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>전화번호</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="010-1234-5678"
                          data-testid="input-guard-phone"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        전화번호 끝 4자리가 비밀번호로 설정됩니다
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>배정 현장</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-guard-site">
                            <SelectValue placeholder="현장을 선택해주세요" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {activeSites.map((site) => (
                            <SelectItem key={site.id} value={site.id}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={createGuardMutation.isPending}
                    data-testid="button-submit-guard"
                  >
                    {createGuardMutation.isPending ? "등록 중..." : "등록"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {activeSites.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border bg-card">
          <Plus className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">등록된 현장이 없습니다</h3>
          <p className="text-muted-foreground text-center">
            근무자를 등록하려면 먼저 현장 관리에서<br />
            현장을 등록해주세요.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {guardsBySite.map(({ site, guards: siteGuards }) => (
            <UserTable
              key={site.id}
              title={site.name}
              users={siteGuards}
            />
          ))}
          {unassignedGuards.length > 0 && (
            <UserTable
              title="미배정"
              users={unassignedGuards}
            />
          )}
        </div>
      )}
    </div>
  );
}

function UserTable({
  title,
  users,
}: {
  title: string;
  users: User[];
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
