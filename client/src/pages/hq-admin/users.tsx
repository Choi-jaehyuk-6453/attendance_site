import { useState } from "react";
import { format } from "date-fns";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Users, Search, Pencil, Edit, Building2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { User, Site, Department } from "@shared/schema";

import { useCompany } from "@/lib/company";

export default function HqAdminUsers() {
    const { toast } = useToast();
    const { company } = useCompany();
    const [selectedSiteId, setSelectedSiteId] = useState<string>("");
    const [searchTerm, setSearchTerm] = useState("");
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
        queryKey: ["/api/users", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/users?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch users");
            return res.json();
        }
    });
    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ["/api/sites", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/sites?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch sites");
            return res.json();
        }
    });

    const { data: allDepartments = [] } = useQuery<Department[]>({
        queryKey: ["/api/departments", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/departments?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch departments");
            return res.json();
        }
    });

    const updateUserMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("PATCH", `/api/users/${editingUser?.id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            setEditingUser(null);
            toast({ title: "사용자 정보가 수정되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "수정에 실패했습니다" });
        }
    });

    const deleteUserMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/users/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "사용자가 삭제되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "삭제에 실패했습니다" });
        }
    });

    const filteredUsers = users.filter(u => {
        if (u.role === "hq_admin") return false;
        if (selectedSiteId !== "all" && u.siteId !== selectedSiteId) return false;
        if (searchTerm && !u.name.includes(searchTerm)) return false;
        return true;
    });

    const [editForm, setEditForm] = useState<Partial<User>>({});

    const handleEditClick = (user: User) => {
        setEditingUser(user);
        setEditForm({
            name: user.name,
            phone: user.phone,
            role: user.role,
            jobTitle: user.jobTitle,
            departmentId: user.departmentId,
            hireDate: user.hireDate,
            isActive: user.isActive,
        });
    };

    const handleSave = () => {
        if (!editingUser) return;
        updateUserMutation.mutate({ ...editForm, id: editingUser.id });
    };

    if (usersLoading) return <div>Loading...</div>;

    // Filter departments for the editing user's site (if they have one)
    const editingUserSiteId = editingUser?.siteId || (selectedSiteId !== "all" ? selectedSiteId : undefined);
    const availableDepartments = editingUserSiteId
        ? allDepartments.filter(d => d.siteId === editingUserSiteId)
        : [];

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold">근로자 관리</h1>
            </div>

            <div className="flex items-center gap-4">
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                    <SelectTrigger className="w-[200px]">
                        <SelectValue placeholder="현장 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        {/* <SelectItem value="all">전체 현장</SelectItem>  User requested specific site selection */}
                        {sites.map((site) => (
                            <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <div className="relative w-64">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="이름 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-8"
                    />
                </div>
            </div>

            {!selectedSiteId ? (
                <div className="flex flex-col items-center justify-center py-16 rounded-lg border bg-card text-muted-foreground">
                    <Building2 className="h-12 w-12 mb-4 opacity-50" />
                    <h3 className="text-lg font-medium mb-2">현장을 선택해주세요</h3>
                    <p className="text-center">
                        근로자 목록을 확인하려면 먼저 현장을 선택해주세요.
                    </p>
                </div>
            ) : (
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>이름</TableHead>
                                <TableHead>직책</TableHead>
                                <TableHead>현장</TableHead>
                                <TableHead>소속</TableHead>
                                <TableHead>전화번호</TableHead>
                                <TableHead>입사일</TableHead>
                                <TableHead>상태</TableHead>
                                <TableHead>관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredUsers.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center py-8">
                                        근로자가 없습니다.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredUsers.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">{user.name}</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <span>{user.jobTitle || "-"}</span>
                                                {user.role === "site_manager" && (
                                                    <Badge variant="default" className="text-xs">현장대리인</Badge>
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell>{sites.find(s => s.id === user.siteId)?.name || "-"}</TableCell>
                                        <TableCell>
                                            {/* Use allDepartments to resolve name */}
                                            {allDepartments.find(d => d.id === user.departmentId)?.name || "-"}
                                        </TableCell>
                                        <TableCell>{user.phone}</TableCell>
                                        <TableCell>{user.hireDate ? format(new Date(user.hireDate), "yyyy-MM-dd") : "-"}</TableCell>
                                        <TableCell>
                                            <Badge variant={user.isActive ? "default" : "secondary"}>
                                                {user.isActive ? "활성" : "비활성"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Button variant="outline" size="sm" onClick={() => handleEditClick(user)}>
                                                    <Edit className="h-4 w-4 mr-1" />
                                                    수정
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        if (confirm(`${user.name} 님을 정말 삭제하시겠습니까?\n삭제된 데이터는 복구할 수 없습니다.`)) {
                                                            deleteUserMutation.mutate(user.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            )}

            <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>사용자 정보 수정</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>이름</Label>
                                <Input
                                    value={editForm.name || ""}
                                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>전화번호</Label>
                                <Input
                                    value={editForm.phone || ""}
                                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>역할</Label>
                                <Select
                                    value={editForm.role}
                                    onValueChange={(v) => setEditForm({ ...editForm, role: v as User["role"] })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="worker">근로자</SelectItem>
                                        <SelectItem value="site_manager">현장대리인</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>직책</Label>
                                <Input
                                    value={editForm.jobTitle || ""}
                                    onChange={(e) => setEditForm({ ...editForm, jobTitle: e.target.value })}
                                    placeholder="예: 반장, 팀장"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>소속 (조직)</Label>
                            <Select
                                value={String(editForm.departmentId || "none")}
                                onValueChange={(v) => setEditForm({ ...editForm, departmentId: v === "none" ? null : v })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="소속 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">없음</SelectItem>
                                    {availableDepartments.map((dept) => (
                                        <SelectItem key={dept.id} value={String(dept.id)}>
                                            {dept.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>입사일</Label>
                                <Input
                                    type="date"
                                    value={editForm.hireDate ? format(new Date(editForm.hireDate), "yyyy-MM-dd") : ""}
                                    onChange={(e) => setEditForm({ ...editForm, hireDate: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>상태</Label>
                                <Select
                                    value={editForm.isActive ? "true" : "false"}
                                    onValueChange={(v) => setEditForm({ ...editForm, isActive: v === "true" })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="true">활성</SelectItem>
                                        <SelectItem value="false">비활성 (퇴사)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingUser(null)}>취소</Button>
                        <Button onClick={handleSave} disabled={updateUserMutation.isPending}>
                            {updateUserMutation.isPending ? "저장 중..." : "저장"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );

}
