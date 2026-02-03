import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Plus, UserPlus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import type { User, Site } from "@shared/schema";

const guardSchema = z.object({
  name: z.string().min(1, "이름을 입력해주세요"),
  phone: z.string().min(4, "전화번호를 입력해주세요 (최소 4자리)"),
  hireDate: z.string().optional(),
});

const editGuardSchema = guardSchema.extend({
  siteId: z.string().optional(),
  shift: z.string().optional(),
});

const shiftLabels: Record<string, string> = {
  day: "주간",
  A: "A조",
  B: "B조",
  C: "C조",
  D: "D조",
};

type GuardForm = z.infer<typeof guardSchema>;
type EditGuardForm = z.infer<typeof editGuardSchema>;

export default function UsersPage() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const { data: sites = [], isLoading: sitesLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const createForm = useForm<GuardForm>({
    resolver: zodResolver(guardSchema),
    defaultValues: {
      name: "",
      phone: "",
      hireDate: "",
    },
  });

  const editForm = useForm<EditGuardForm>({
    resolver: zodResolver(editGuardSchema),
    defaultValues: {
      name: "",
      phone: "",
      hireDate: "",
      siteId: "",
      shift: "day",
    },
  });

  const createGuardMutation = useMutation({
    mutationFn: async (data: GuardForm) => {
      const last4Digits = data.phone.replace(/\D/g, "").slice(-4);
      if (last4Digits.length < 4) {
        throw new Error("전화번호 끝 4자리를 입력해주세요");
      }
      if (!selectedSiteId) {
        throw new Error("현장을 선택해주세요");
      }
      
      const res = await apiRequest("POST", "/api/users", {
        username: data.name,
        password: last4Digits,
        name: data.name,
        phone: data.phone,
        hireDate: data.hireDate || null,
        siteId: selectedSiteId,
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
      setCreateDialogOpen(false);
      createForm.reset();
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "등록 실패",
        description: error.message || "근무자 등록 중 오류가 발생했습니다.",
      });
    },
  });

  const updateGuardMutation = useMutation({
    mutationFn: async (data: EditGuardForm) => {
      if (!selectedUser) throw new Error("사용자가 선택되지 않았습니다");
      const res = await apiRequest("PATCH", `/api/users/${selectedUser.id}`, {
        name: data.name,
        phone: data.phone,
        hireDate: data.hireDate || null,
        siteId: data.siteId === "none" ? null : data.siteId,
        shift: data.shift || "day",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "수정 완료",
        description: "근무자 정보가 수정되었습니다.",
      });
      setEditDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "수정 실패",
        description: error.message || "근무자 수정 중 오류가 발생했습니다.",
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}/toggle-active`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: data.isActive ? "활성화 완료" : "비활성화 완료",
        description: data.isActive 
          ? "근무자가 활성화되었습니다. 로그인이 가능합니다."
          : "근무자가 비활성화되었습니다. 로그인이 차단됩니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "상태 변경 실패",
        description: error.message || "상태 변경 중 오류가 발생했습니다.",
      });
    },
  });

  const deleteGuardMutation = useMutation({
    mutationFn: async () => {
      if (!selectedUser) throw new Error("사용자가 선택되지 않았습니다");
      await apiRequest("DELETE", `/api/users/${selectedUser.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "삭제 완료",
        description: "근무자와 모든 출근 기록이 삭제되었습니다.",
      });
      setDeleteDialogOpen(false);
      setSelectedUser(null);
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: error.message || "근무자 삭제 중 오류가 발생했습니다.",
      });
    },
  });

  const handleEdit = (user: User) => {
    setSelectedUser(user);
    editForm.reset({
      name: user.name,
      phone: user.phone || "",
      hireDate: user.hireDate || "",
      siteId: user.siteId || "none",
      shift: user.shift || "day",
    });
    setEditDialogOpen(true);
  };

  const updateShiftMutation = useMutation({
    mutationFn: async ({ userId, shift }: { userId: string; shift: string }) => {
      const res = await apiRequest("PATCH", `/api/users/${userId}`, { shift });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "조 변경 완료",
        description: "근무 조가 변경되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "변경 실패",
        description: error.message || "조 변경 중 오류가 발생했습니다.",
      });
    },
  });

  const handleDelete = (user: User) => {
    setSelectedUser(user);
    setDeleteDialogOpen(true);
  };

  const isLoading = usersLoading || sitesLoading;
  const guards = users.filter((u) => u.role === "guard");
  const activeSites = sites.filter(s => s.isActive);

  const selectedSite = activeSites.find(s => s.id === selectedSiteId);
  const siteGuards = selectedSiteId === "all"
    ? guards
    : selectedSiteId === "unassigned"
      ? guards.filter(g => !g.siteId)
      : selectedSiteId 
        ? guards.filter(g => g.siteId === selectedSiteId)
        : [];
  const activeGuardsCount = siteGuards.filter(g => g.isActive).length;
  const unassignedGuards = guards.filter(g => !g.siteId);

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
            {selectedSiteId === "all"
              ? `전체 현장 - 활성 ${activeGuardsCount}명 / 전체 ${siteGuards.length}명`
              : selectedSiteId === "unassigned"
                ? `미배정 - 활성 ${activeGuardsCount}명 / 전체 ${siteGuards.length}명`
                : selectedSite 
                  ? `${selectedSite.name} - 활성 ${activeGuardsCount}명 / 전체 ${siteGuards.length}명`
                  : "현장을 선택해주세요"
            }
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={selectedSiteId || ""}
            onValueChange={(value) => setSelectedSiteId(value || null)}
          >
            <SelectTrigger className="w-[200px]" data-testid="select-site-filter">
              <SelectValue placeholder="현장 선택" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                전체 ({guards.length}명)
              </SelectItem>
              {activeSites.map((site) => (
                <SelectItem key={site.id} value={site.id}>
                  {site.name}
                </SelectItem>
              ))}
              {unassignedGuards.length > 0 && (
                <SelectItem value="unassigned">
                  미배정 ({unassignedGuards.length}명)
                </SelectItem>
              )}
            </SelectContent>
          </Select>
          {selectedSiteId && selectedSiteId !== "unassigned" && selectedSiteId !== "all" && (
            <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="button-add-guard">
                  <UserPlus className="h-4 w-4 mr-2" />
                  근무자 추가
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>새 근무자 등록</DialogTitle>
                  <DialogDescription>
                    새로운 근무자를 등록합니다. 동명이인도 등록 가능합니다.
                  </DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit((data) => createGuardMutation.mutate(data))} className="space-y-4">
                    <FormField
                      control={createForm.control}
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
                      control={createForm.control}
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
                      control={createForm.control}
                      name="hireDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>입사일</FormLabel>
                          <FormControl>
                            <Input
                              type="date"
                              data-testid="input-guard-hire-date"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormItem>
                      <FormLabel>배정 현장</FormLabel>
                      <FormControl>
                        <Input
                          value={selectedSite?.name || ""}
                          disabled
                          data-testid="input-guard-site"
                        />
                      </FormControl>
                    </FormItem>
                    <div className="flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setCreateDialogOpen(false)}
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
          )}
        </div>
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
      ) : !selectedSiteId ? (
        <div className="flex flex-col items-center justify-center py-16 rounded-lg border bg-card">
          <UserPlus className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">현장을 선택해주세요</h3>
          <p className="text-muted-foreground text-center">
            근무자를 조회하려면 먼저 현장을 선택해주세요.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="p-4 border-b bg-muted/30 flex items-center justify-between gap-4">
            <h3 className="font-semibold">
              {selectedSiteId === "all" 
                ? "전체 현장" 
                : selectedSiteId === "unassigned" 
                  ? "미배정" 
                  : selectedSite?.name || ""}
            </h3>
            <span className="text-sm text-muted-foreground">
              활성 {activeGuardsCount}명 / 전체 {siteGuards.length}명
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="p-3 text-left font-medium">상태</th>
                  <th className="p-3 text-left font-medium">이름</th>
                  <th className="p-3 text-left font-medium">조</th>
                  {selectedSiteId === "all" && (
                    <th className="p-3 text-left font-medium">현장</th>
                  )}
                  <th className="p-3 text-left font-medium">연락처</th>
                  <th className="p-3 text-left font-medium">입사일</th>
                  <th className="p-3 text-center font-medium">관리</th>
                </tr>
              </thead>
              <tbody>
                {siteGuards.length === 0 ? (
                  <tr>
                    <td colSpan={selectedSiteId === "all" ? 7 : 6} className="p-8 text-center text-muted-foreground">
                      등록된 근무자가 없습니다
                    </td>
                  </tr>
                ) : (
                  siteGuards.map((user) => (
                    <tr 
                      key={user.id} 
                      className={`border-t ${!user.isActive ? "opacity-50 bg-muted/20" : ""}`}
                      data-testid={`row-user-${user.id}`}
                    >
                      <td className="p-3">
                        <Badge 
                          variant={user.isActive ? "default" : "secondary"}
                          className={user.isActive ? "bg-green-600" : ""}
                        >
                          {user.isActive ? "활성" : "비활성"}
                        </Badge>
                      </td>
                      <td className="p-3 font-medium">{user.name}</td>
                      <td className="p-3">
                        <Select
                          value={user.shift || "day"}
                          onValueChange={(value) => updateShiftMutation.mutate({ userId: user.id, shift: value })}
                        >
                          <SelectTrigger className="h-8 w-[80px]" data-testid={`select-shift-${user.id}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="day">주간</SelectItem>
                            <SelectItem value="A">A조</SelectItem>
                            <SelectItem value="B">B조</SelectItem>
                            <SelectItem value="C">C조</SelectItem>
                            <SelectItem value="D">D조</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      {selectedSiteId === "all" && (
                        <td className="p-3 text-muted-foreground">
                          {sites.find(s => s.id === user.siteId)?.name || "미배정"}
                        </td>
                      )}
                      <td className="p-3 text-muted-foreground">{user.phone || "-"}</td>
                      <td className="p-3 text-muted-foreground">{user.hireDate || "-"}</td>
                      <td className="p-3">
                        <div className="flex items-center justify-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => toggleActiveMutation.mutate(user.id)}
                                disabled={toggleActiveMutation.isPending}
                                data-testid={`button-toggle-user-${user.id}`}
                              >
                                {user.isActive ? (
                                  <ToggleRight className="h-5 w-5 text-green-600" />
                                ) : (
                                  <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {user.isActive ? "비활성화" : "활성화"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleEdit(user)}
                                data-testid={`button-edit-user-${user.id}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>수정</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDelete(user)}
                                data-testid={`button-delete-user-${user.id}`}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>삭제</TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>근무자 수정</DialogTitle>
            <DialogDescription>
              근무자 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateGuardMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이름 (로그인 아이디)</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="홍길동"
                        data-testid="input-edit-guard-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>전화번호</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="010-1234-5678"
                        data-testid="input-edit-guard-phone"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      전화번호 변경 시 비밀번호도 끝 4자리로 변경됩니다
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="hireDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>입사일</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        data-testid="input-edit-guard-hire-date"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="siteId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>배정 현장</FormLabel>
                    <Select
                      value={field.value || ""}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-guard-site">
                          <SelectValue placeholder="현장 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">미배정</SelectItem>
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
              <FormField
                control={editForm.control}
                name="shift"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>근무 조</FormLabel>
                    <Select
                      value={field.value || "day"}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-guard-shift">
                          <SelectValue placeholder="조 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="day">주간</SelectItem>
                        <SelectItem value="A">A조</SelectItem>
                        <SelectItem value="B">B조</SelectItem>
                        <SelectItem value="C">C조</SelectItem>
                        <SelectItem value="D">D조</SelectItem>
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
                  onClick={() => setEditDialogOpen(false)}
                >
                  취소
                </Button>
                <Button
                  type="submit"
                  disabled={updateGuardMutation.isPending}
                  data-testid="button-submit-edit-guard"
                >
                  {updateGuardMutation.isPending ? "수정 중..." : "수정"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>근무자 완전 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedUser?.name} 근무자를 완전히 삭제하시겠습니까?
              <br /><br />
              <strong className="text-destructive">주의:</strong> 모든 출근 기록이 함께 삭제되며 복구할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteGuardMutation.mutate()}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-guard"
            >
              {deleteGuardMutation.isPending ? "삭제 중..." : "완전 삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
