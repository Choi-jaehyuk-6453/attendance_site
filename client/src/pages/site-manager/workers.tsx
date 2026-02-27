import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Upload, Download, Users, UserX, UserCheck, Trash2, Edit } from "lucide-react";
import * as XLSX from "xlsx";
import type { User, Department } from "@shared/schema";

export default function SiteManagerWorkers() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [showRegisterDialog, setShowRegisterDialog] = useState(false);
    const [showBulkDialog, setShowBulkDialog] = useState(false);
    const [newWorker, setNewWorker] = useState({ name: "", phone: "", departmentId: "", jobTitle: "", hireDate: "" });
    const [bulkData, setBulkData] = useState<any[] | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
    const [duplicateName, setDuplicateName] = useState("");
    const [pendingWorkerData, setPendingWorkerData] = useState<any>(null);

    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [editForm, setEditForm] = useState<Partial<User>>({});

    const { data: workers = [] } = useQuery<User[]>({
        queryKey: ["/api/users"],
    });

    const { data: departments = [] } = useQuery<Department[]>({
        queryKey: ["/api/departments", user?.siteId],
        queryFn: async () => {
            if (!user?.siteId) return [];
            const res = await fetch(`/api/departments/${user.siteId}`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!user?.siteId,
    });

    // Filter states
    const [statusFilter, setStatusFilter] = useState<"active" | "resigned">("active");
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("all");
    const [searchTerm, setSearchTerm] = useState("");

    // Show all site users (workers + site_managers)
    const allSiteUsers = workers.filter(w => w.role === "worker" || w.role === "site_manager");

    // Filtered by status, department, search and Sorted by sortOrder > name
    const filteredUsers = allSiteUsers.filter(w => {
        if (statusFilter === "active" && !w.isActive) return false;
        if (statusFilter === "resigned" && w.isActive) return false;
        if (selectedDepartmentId !== "all" && String(w.departmentId || "none") !== selectedDepartmentId) return false;
        if (searchTerm && !w.name.includes(searchTerm)) return false;
        return true;
    }).sort((a, b) => {
        const deptA = departments.find(d => d.id === a.departmentId);
        const deptB = departments.find(d => d.id === b.departmentId);
        const orderA = deptA?.sortOrder ?? 999;
        const orderB = deptB?.sortOrder ?? 999;

        if (orderA !== orderB) return orderA - orderB;
        return a.name.localeCompare(b.name, 'ko');
    });

    const createWorkerMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/workers", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            setShowRegisterDialog(false);
            setNewWorker({ name: "", phone: "", departmentId: "", jobTitle: "", hireDate: "" });
            setShowDuplicateDialog(false);
            setPendingWorkerData(null);
            toast({ title: "근로자가 등록되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "근로자 등록에 실패했습니다" });
        },
    });

    const updateUserMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("PATCH", `/api/users/${editingUser?.id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            setEditingUser(null);
            toast({ title: "근로자 정보가 수정되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "수정에 실패했습니다" });
        }
    });

    const bulkImportMutation = useMutation({
        mutationFn: async (data: any[]) => {
            const res = await apiRequest("POST", "/api/workers/bulk-import", { data });
            return res.json();
        },
        onSuccess: (result) => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            setShowBulkDialog(false);
            setBulkData(null);
            toast({ title: result.message });
        },
        onError: () => {
            toast({ variant: "destructive", title: "일괄 등록에 실패했습니다" });
        },
    });

    const toggleActiveMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("PATCH", `/api/users/${id}/toggle-active`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        },
    });

    const deleteWorkerMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/users/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            toast({ title: "근로자가 삭제되었습니다" });
        },
    });

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: "array" });
                const sheet = workbook.Sheets[workbook.SheetNames[0]];
                const jsonData = XLSX.utils.sheet_to_json(sheet, {
                    header: ["name", "phone", "department", "jobTitle", "hireDate"],
                    range: 1,
                    raw: false,
                    dateNF: "yyyy-mm-dd"
                });
                // Filter out empty rows (e.g., formatting rows with no name)
                const filteredData = jsonData.filter((row: any) => row.name && String(row.name).trim().length > 0);
                setBulkData(filteredData);
            } catch (error) {
                toast({ variant: "destructive", title: "파일 읽기에 실패했습니다" });
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleDownloadTemplate = async () => {
        try {
            // Add cache buster to prevent browser from serving old cached file
            const res = await fetch(`/api/workers/import-template?t=${Date.now()}`);
            if (!res.ok) throw new Error("Download failed");

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "worker_import_template.xlsx";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            toast({ variant: "destructive", title: "양식 다운로드에 실패했습니다" });
        }
    };

    const getDeptName = (deptId: string | null) => {
        if (!deptId) return "-";
        return departments.find(d => d.id === deptId)?.name || "-";
    };

    // Handle registration with duplicate name check
    const handleRegisterClick = () => {
        const trimmedName = newWorker.name.trim();
        if (!trimmedName || !newWorker.phone) return;

        // Check for duplicate names among existing workers
        const duplicate = workers.find(
            w => w.name === trimmedName && w.isActive
        );

        if (duplicate) {
            // Show duplicate confirmation dialog
            setDuplicateName(trimmedName);
            setPendingWorkerData({ ...newWorker, name: trimmedName });
            setShowDuplicateDialog(true);
        } else {
            // No duplicate, proceed directly
            createWorkerMutation.mutate({ ...newWorker, name: trimmedName });
        }
    };

    // Handle duplicate confirmation: register with modified name
    const handleDuplicateConfirm = () => {
        if (!pendingWorkerData) return;
        createWorkerMutation.mutate(pendingWorkerData);
    };

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

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-2xl font-bold">근로자 관리</h1>
                    <p className="text-muted-foreground">근로자를 등록하고 관리합니다</p>
                </div>
                <div className="flex gap-2">
                    <Dialog open={showBulkDialog} onOpenChange={setShowBulkDialog}>
                        <DialogTrigger asChild>
                            <Button variant="outline">
                                <Upload className="h-4 w-4 mr-2" />
                                일괄 등록
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-lg">
                            <DialogHeader>
                                <DialogTitle>엑셀 일괄 등록</DialogTitle>
                                <DialogDescription>엑셀 파일로 근로자를 한 번에 등록합니다</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <Button variant="outline" onClick={handleDownloadTemplate} className="w-full">
                                    <Download className="h-4 w-4 mr-2" />
                                    양식 다운로드
                                </Button>
                                <div>
                                    <Label>엑셀 파일 선택</Label>
                                    <Input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".xlsx,.xls"
                                        onChange={handleFileUpload}
                                        className="mt-1"
                                    />
                                </div>
                                {bulkData && (
                                    <div className="p-3 bg-muted rounded-lg text-sm">
                                        <p className="font-medium">{bulkData.length}명의 근로자 데이터가 확인되었습니다</p>
                                        <ul className="mt-2 space-y-1 text-muted-foreground">
                                            {bulkData.slice(0, 5).map((row: any, i: number) => (
                                                <li key={i}>{row.name} ({row.phone})</li>
                                            ))}
                                            {bulkData.length > 5 && <li>...외 {bulkData.length - 5}명</li>}
                                        </ul>
                                    </div>
                                )}
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => { setShowBulkDialog(false); setBulkData(null); }}>취소</Button>
                                <Button
                                    onClick={() => bulkData && bulkImportMutation.mutate(bulkData)}
                                    disabled={!bulkData || bulkImportMutation.isPending}
                                >
                                    {bulkImportMutation.isPending ? "등록 중..." : `${bulkData?.length || 0}명 일괄 등록`}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showRegisterDialog} onOpenChange={setShowRegisterDialog}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                근로자 등록
                            </Button>
                        </DialogTrigger>
                        <DialogContent>
                            <DialogHeader>
                                <DialogTitle>근로자 등록</DialogTitle>
                                <DialogDescription>새로운 근로자를 등록합니다. 비밀번호는 전화번호 끝 4자리입니다.</DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4">
                                <div>
                                    <Label>이름 *</Label>
                                    <Input
                                        value={newWorker.name}
                                        onChange={(e) => setNewWorker({ ...newWorker, name: e.target.value })}
                                        placeholder="근로자 이름"
                                    />
                                </div>
                                <div>
                                    <Label>전화번호 *</Label>
                                    <Input
                                        value={newWorker.phone}
                                        onChange={(e) => setNewWorker({ ...newWorker, phone: e.target.value })}
                                        placeholder="010-0000-0000"
                                    />
                                </div>
                                <div>
                                    <Label>직책</Label>
                                    <Input
                                        value={newWorker.jobTitle}
                                        onChange={(e) => setNewWorker({ ...newWorker, jobTitle: e.target.value })}
                                        placeholder="직책 (예: 팀장, 반장)"
                                    />
                                </div>
                                {departments.length > 0 && (
                                    <div>
                                        <Label>조직</Label>
                                        <Select value={newWorker.departmentId} onValueChange={(v) => setNewWorker({ ...newWorker, departmentId: v })}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="조직 선택" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {departments.map(dept => (
                                                    <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}
                                <div>
                                    <Label>입사일</Label>
                                    <Input
                                        type="date"
                                        value={newWorker.hireDate}
                                        onChange={(e) => setNewWorker({ ...newWorker, hireDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setShowRegisterDialog(false)}>취소</Button>
                                <Button
                                    onClick={handleRegisterClick}
                                    disabled={!newWorker.name || !newWorker.phone || createWorkerMutation.isPending}
                                >
                                    {createWorkerMutation.isPending ? "등록 중..." : "등록"}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)} className="w-[400px]">
                    <TabsList>
                        <TabsTrigger value="active">재직자</TabsTrigger>
                        <TabsTrigger value="resigned">퇴사자</TabsTrigger>
                    </TabsList>
                </Tabs>

                <div className="flex items-center gap-2 flex-wrap">
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                        <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder="조직 선택" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">전체 조직</SelectItem>
                            <SelectItem value="none">미배치(조직 없음)</SelectItem>
                            {departments.map(dept => (
                                <SelectItem key={dept.id} value={String(dept.id)}>{dept.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Input
                        placeholder="이름 검색"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-[200px]"
                    />
                    <div className="text-sm text-muted-foreground ml-2">총 {filteredUsers.length}명</div>
                </div>
            </div>

            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>이름</TableHead>
                        <TableHead>역할</TableHead>
                        <TableHead>직책</TableHead>
                        <TableHead>조직</TableHead>
                        <TableHead>전화번호</TableHead>
                        <TableHead>입사일</TableHead>
                        <TableHead>상태</TableHead>
                        <TableHead className="text-right">관리</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredUsers.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={8} className="text-center py-12">
                                <div className="flex flex-col items-center gap-2">
                                    <Users className="h-8 w-8 text-muted-foreground" />
                                    <p className="text-muted-foreground">
                                        {statusFilter === "active" ? "등록된 근무자가 없습니다" : "퇴사한 인원이 없습니다"}
                                    </p>
                                </div>
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredUsers.map((worker) => (
                            <TableRow key={worker.id}>
                                <TableCell className="font-medium">{worker.name}</TableCell>
                                <TableCell>
                                    {worker.role === "site_manager" ? (
                                        <Badge variant="default" className="text-xs">현장대리인</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-xs">근로자</Badge>
                                    )}
                                </TableCell>
                                <TableCell>{worker.jobTitle || "-"}</TableCell>
                                <TableCell>{getDeptName(worker.departmentId)}</TableCell>
                                <TableCell className="text-muted-foreground">{worker.phone || "-"}</TableCell>
                                <TableCell className="text-muted-foreground">{worker.hireDate || "-"}</TableCell>
                                <TableCell>
                                    {worker.isActive ? (
                                        <Badge variant="outline" className="text-green-600 border-green-600">활성</Badge>
                                    ) : (
                                        <Badge variant="outline" className="text-red-600 border-red-600 bg-red-50">퇴사</Badge>
                                    )}
                                </TableCell>
                                <TableCell className="text-right">
                                    {worker.role === "worker" && (
                                        <div className="flex justify-end gap-1">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleEditClick(worker)}
                                                className="h-8 px-2"
                                            >
                                                <Edit className="h-4 w-4 mr-1" />
                                                수정
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => toggleActiveMutation.mutate(worker.id)}
                                            >
                                                {worker.isActive ? (
                                                    <UserX className="h-4 w-4 text-orange-500" />
                                                ) : (
                                                    <UserCheck className="h-4 w-4 text-green-500" />
                                                )}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                onClick={() => {
                                                    if (confirm(`${worker.name}을(를) 정말 삭제하시겠습니까?\\n삭제 시 비활성화 처리되며, 기록은 보존됩니다.`)) {
                                                        deleteWorkerMutation.mutate(worker.id);
                                                    }
                                                }}
                                            >
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </div>
                                    )}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>

            {/* Duplicate Name Warning Dialog */}
            <AlertDialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>중복된 이름이 있습니다</AlertDialogTitle>
                        <AlertDialogDescription>
                            "{duplicateName}" 이름의 인원이 이미 등록되어 있습니다.
                            등록하시려면 이름을 변경해 주세요.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-4">
                        <Label>변경할 이름</Label>
                        <Input
                            value={pendingWorkerData?.name || ""}
                            onChange={(e) => setPendingWorkerData((prev: any) => prev ? { ...prev, name: e.target.value } : prev)}
                            placeholder="변경할 이름 입력 (예: 김철수B)"
                            className="mt-1"
                        />
                        {pendingWorkerData?.name === duplicateName && (
                            <p className="text-sm text-destructive mt-1">기존 이름과 다르게 입력해 주세요</p>
                        )}
                    </div>
                    <AlertDialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowDuplicateDialog(false);
                                setPendingWorkerData(null);
                            }}
                        >
                            취소
                        </Button>
                        <Button
                            onClick={handleDuplicateConfirm}
                            disabled={
                                !pendingWorkerData?.name ||
                                pendingWorkerData?.name === duplicateName ||
                                createWorkerMutation.isPending
                            }
                        >
                            {createWorkerMutation.isPending ? "등록 중..." : "변경 후 등록"}
                        </Button>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

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
                                    {departments.map((dept) => (
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
                                    // Make sure date formatting matches the expected format string
                                    // if it's stored as ISO we slice to 'YYYY-MM-DD'
                                    value={editForm.hireDate ? editForm.hireDate.toString().slice(0, 10) : ""}
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
