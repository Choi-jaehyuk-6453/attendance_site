import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
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
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Plus, Building2, Trash2, Users, X, UserPlus, Pencil } from "lucide-react";
import type { Site, Department, User } from "@shared/schema";
import { useCompany } from "@/lib/company";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function HqAdminSites() {
    const { toast } = useToast();
    const { company } = useCompany();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showManagerDialog, setShowManagerDialog] = useState(false);
    const [selectedSiteForManager, setSelectedSiteForManager] = useState<Site | null>(null);
    const [siteToEdit, setSiteToEdit] = useState<Site | null>(null);

    const [newSite, setNewSite] = useState({ name: "", address: "", contractStartDate: "", contractEndDate: "", company: "mirae_abm" });
    const [editSiteData, setEditSiteData] = useState({ name: "", address: "", contractStartDate: "", contractEndDate: "", company: "mirae_abm", isActive: true });

    const [deptInputs, setDeptInputs] = useState<string[]>([""]);
    const [managerName, setManagerName] = useState("");
    const [managerPhone, setManagerPhone] = useState("");

    const [newDeptName, setNewDeptName] = useState("");
    const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
    const [editingDeptName, setEditingDeptName] = useState("");

    // Reset new site company when global company changes
    useEffect(() => {
        setNewSite(prev => ({ ...prev, company: company.id }));
    }, [company.id]);

    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ["/api/sites", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/sites?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch sites");
            return res.json();
        },
        staleTime: 0,
        refetchOnMount: true
    });

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ["/api/users", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/users?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch users");
            return res.json();
        },
        staleTime: 0,
        refetchOnMount: true
    });

    const { data: editingSiteDepartments = [] } = useQuery<Department[]>({
        queryKey: ["/api/departments", siteToEdit?.id],
        enabled: !!siteToEdit?.id,
    });

    const filteredSites = sites.filter(s => s.company === company.id);

    const createSiteMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/sites", data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            setShowCreateDialog(false);
            setNewSite({ name: "", address: "", contractStartDate: "", contractEndDate: "", company: company.id });
            setDeptInputs([""]);
            toast({ title: "현장이 등록되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "현장 등록에 실패했습니다" });
        },
    });

    const updateSiteMutation = useMutation({
        mutationFn: async ({ id, data }: { id: string; data: any }) => {
            const res = await apiRequest("PATCH", `/api/sites/${id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
            setShowEditDialog(false);
            setSiteToEdit(null);
            toast({ title: "현장이 수정되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "현장 수정에 실패했습니다" });
        },
    });

    const createManagerMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/site-managers", data);
            return res.json();
        },
        onSuccess: () => {
            // Invalidate both generally and specifically
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
            setShowManagerDialog(false);
            setManagerName("");
            setManagerPhone("");
            setSelectedSiteForManager(null);
            toast({ title: "현장대리인이 등록되었습니다" });
        },
        onError: (error: any) => {
            const message = error.message || "현장대리인 등록에 실패했습니다";
            toast({ variant: "destructive", title: "등록 실패", description: message });
        },
    });

    const deleteSiteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/sites/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
            toast({ title: "현장이 삭제되었습니다" });
        },
    });

    const deleteManagerMutation = useMutation({
        mutationFn: async (userId: string) => {
            await apiRequest("DELETE", `/api/users/${userId}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
            toast({ title: "현장대리인이 삭제되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "삭제 실패", description: "현장대리인 삭제 중 오류가 발생했습니다" });
        }
    });

    const createDeptMutation = useMutation({
        mutationFn: async (name: string) => {
            if (!siteToEdit) return;
            const res = await apiRequest("POST", "/api/departments", { siteId: siteToEdit.id, name });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/departments", siteToEdit?.id] });
            setNewDeptName("");
            toast({ title: "조직이 추가되었습니다" });
        },
    });

    const updateDeptMutation = useMutation({
        mutationFn: async ({ id, name }: { id: string; name: string }) => {
            const res = await apiRequest("PATCH", `/api/departments/${id}`, { name });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/departments", siteToEdit?.id] });
            setEditingDeptId(null);
            setEditingDeptName("");
            toast({ title: "조직이 수정되었습니다" });
        },
    });

    const deleteDeptMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/departments/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/departments", siteToEdit?.id] });
            toast({ title: "조직이 삭제되었습니다" });
        },
    });

    const handleCreateSite = () => {
        const departments = deptInputs.filter(d => d.trim() !== "");
        createSiteMutation.mutate({
            ...newSite,
            contractStartDate: newSite.contractStartDate || null,
            contractEndDate: newSite.contractEndDate || null,
            departments,
        });
    };

    const handleUpdateSite = () => {
        if (!siteToEdit) return;
        updateSiteMutation.mutate({
            id: siteToEdit.id,
            data: {
                ...editSiteData,
                contractStartDate: editSiteData.contractStartDate || null,
                contractEndDate: editSiteData.contractEndDate || null,
            }
        });
    };

    const handleCreateManager = () => {
        if (!selectedSiteForManager) return;
        createManagerMutation.mutate({
            name: managerName,
            phone: managerPhone,
            siteId: selectedSiteForManager.id,
        });
    };

    const openEditDialog = (site: Site) => {
        setSiteToEdit(site);
        setEditSiteData({
            name: site.name,
            address: site.address || "",
            contractStartDate: site.contractStartDate ? String(site.contractStartDate) : "",
            contractEndDate: site.contractEndDate ? String(site.contractEndDate) : "",
            company: site.company || "mirae_abm",
            isActive: site.isActive,
        });
        setShowEditDialog(true);
    };

    const addDeptInput = () => setDeptInputs([...deptInputs, ""]);
    const removeDeptInput = (index: number) => {
        setDeptInputs(deptInputs.filter((_, i) => i !== index));
    };
    const updateDeptInput = (index: number, value: string) => {
        const updated = [...deptInputs];
        updated[index] = value;
        setDeptInputs(updated);
    };

    const getSiteManagers = (siteId: string) => {
        return users.filter(u => u.role === "site_manager" && u.siteId === siteId);
    };

    const getSiteWorkerCount = (siteId: string) => {
        return users.filter(u => (u.role === "worker" || u.role === "site_manager") && u.siteId === siteId && u.isActive).length;
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">현장 관리</h1>
                    <p className="text-muted-foreground">{company.name} 소속 현장 및 조직을 관리합니다</p>
                </div>
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button>
                            <Plus className="h-4 w-4 mr-2" />
                            현장 등록
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>현장 등록</DialogTitle>
                            <DialogDescription>새로운 현장을 등록하고 조직을 구성합니다</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>법인</Label>
                                <Select
                                    value={newSite.company}
                                    onValueChange={(val) => setNewSite({ ...newSite, company: val })}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="법인 선택" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mirae_abm">MIRAE ABM</SelectItem>
                                        <SelectItem value="dawon_pmc">DAWON PMC</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label>현장명 *</Label>
                                <Input
                                    value={newSite.name}
                                    onChange={(e) => setNewSite({ ...newSite, name: e.target.value })}
                                    placeholder="예: 00빌딩"
                                />
                            </div>
                            <div>
                                <Label>주소</Label>
                                <Input
                                    value={newSite.address}
                                    onChange={(e) => setNewSite({ ...newSite, address: e.target.value })}
                                    placeholder="현장 주소"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>계약 시작일</Label>
                                    <Input
                                        type="date"
                                        value={newSite.contractStartDate}
                                        onChange={(e) => setNewSite({ ...newSite, contractStartDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <Label>계약 종료일</Label>
                                    <Input
                                        type="date"
                                        value={newSite.contractEndDate}
                                        onChange={(e) => setNewSite({ ...newSite, contractEndDate: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label className="mb-2 block">조직 구성</Label>
                                <p className="text-sm text-muted-foreground mb-2">
                                    현장의 조직을 추가하세요 (예: 관리소, 경비, 청소, 시설)
                                </p>
                                {deptInputs.map((dept, index) => (
                                    <div key={index} className="flex gap-2 mb-2">
                                        <Input
                                            value={dept}
                                            onChange={(e) => updateDeptInput(index, e.target.value)}
                                            placeholder={`조직명 ${index + 1}`}
                                        />
                                        {deptInputs.length > 1 && (
                                            <Button variant="ghost" size="icon" onClick={() => removeDeptInput(index)}>
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <Button variant="outline" size="sm" onClick={addDeptInput}>
                                    <Plus className="h-4 w-4 mr-1" />
                                    조직 추가
                                </Button>
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>취소</Button>
                            <Button onClick={handleCreateSite} disabled={!newSite.name || createSiteMutation.isPending}>
                                {createSiteMutation.isPending ? "등록 중..." : "등록"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Edit Site Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>현장 정보 수정</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>법인</Label>
                            <Select
                                value={editSiteData.company}
                                onValueChange={(val) => setEditSiteData({ ...editSiteData, company: val })}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="법인 선택" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="mirae_abm">MIRAE ABM</SelectItem>
                                    <SelectItem value="dawon_pmc">DAWON PMC</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div>
                            <Label>현장명 *</Label>
                            <Input
                                value={editSiteData.name}
                                onChange={(e) => setEditSiteData({ ...editSiteData, name: e.target.value })}
                            />
                        </div>
                        <div>
                            <Label>주소</Label>
                            <Input
                                value={editSiteData.address}
                                onChange={(e) => setEditSiteData({ ...editSiteData, address: e.target.value })}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>계약 시작일</Label>
                                <Input
                                    type="date"
                                    value={editSiteData.contractStartDate}
                                    onChange={(e) => setEditSiteData({ ...editSiteData, contractStartDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>계약 종료일</Label>
                                <Input
                                    type="date"
                                    value={editSiteData.contractEndDate}
                                    onChange={(e) => setEditSiteData({ ...editSiteData, contractEndDate: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="pt-4 border-t">
                            <Label className="mb-2 block">조직 관리</Label>
                            <div className="space-y-2 mb-4">
                                {editingSiteDepartments.map(dept => (
                                    <div key={dept.id} className="flex items-center gap-2">
                                        {editingDeptId === dept.id ? (
                                            <>
                                                <Input
                                                    value={editingDeptName}
                                                    onChange={(e) => setEditingDeptName(e.target.value)}
                                                    className="h-8"
                                                />
                                                <Button
                                                    size="sm"
                                                    onClick={() => updateDeptMutation.mutate({ id: dept.id, name: editingDeptName })}
                                                    disabled={updateDeptMutation.isPending}
                                                >
                                                    저장
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() => setEditingDeptId(null)}
                                                >
                                                    취소
                                                </Button>
                                            </>
                                        ) : (
                                            <>
                                                <div className="flex-1 text-sm border rounded-md px-3 py-2 bg-muted/50">
                                                    {dept.name}
                                                </div>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8"
                                                    onClick={() => {
                                                        setEditingDeptId(dept.id);
                                                        setEditingDeptName(dept.name);
                                                    }}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => {
                                                        if (confirm(`'${dept.name}' 조직을 삭제하시겠습니까?`)) {
                                                            deleteDeptMutation.mutate(dept.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </>
                                        )}
                                    </div>
                                ))}
                            </div>

                            <div className="flex gap-2">
                                <Input
                                    placeholder="새 조직명"
                                    value={newDeptName}
                                    onChange={(e) => setNewDeptName(e.target.value)}
                                />
                                <Button
                                    variant="outline"
                                    onClick={() => createDeptMutation.mutate(newDeptName)}
                                    disabled={!newDeptName.trim() || createDeptMutation.isPending}
                                >
                                    <Plus className="h-4 w-4 mr-2" />
                                    조직 추가
                                </Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowEditDialog(false)}>취소</Button>
                        <Button onClick={handleUpdateSite} disabled={!editSiteData.name || updateSiteMutation.isPending}>
                            {updateSiteMutation.isPending ? "수정 중..." : "수정"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Site Manager Registration Dialog */}
            <Dialog open={showManagerDialog} onOpenChange={setShowManagerDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>현장대리인 등록</DialogTitle>
                        <DialogDescription>
                            {selectedSiteForManager?.name}의 현장대리인을 등록합니다.
                            로그인 ID는 현장명, 비밀번호는 전화번호 끝 4자리입니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div>
                            <Label>이름 *</Label>
                            <Input value={managerName} onChange={(e) => setManagerName(e.target.value)} placeholder="현장대리인 이름" />
                        </div>
                        <div>
                            <Label>전화번호 *</Label>
                            <Input value={managerPhone} onChange={(e) => setManagerPhone(e.target.value)} placeholder="010-0000-0000" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowManagerDialog(false)}>취소</Button>
                        <Button onClick={handleCreateManager} disabled={!managerName || !managerPhone || createManagerMutation.isPending}>
                            {createManagerMutation.isPending ? "등록 중..." : "등록"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="grid gap-4">
                {filteredSites.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">
                                {company.name}에 등록된 현장이 없습니다
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>현장명</TableHead>
                                <TableHead>주소</TableHead>
                                <TableHead>현장대리인</TableHead>
                                <TableHead>근로자 수</TableHead>
                                <TableHead>계약기간</TableHead>
                                <TableHead className="text-right">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSites.map((site) => {
                                const managers = getSiteManagers(site.id);
                                const workerCount = getSiteWorkerCount(site.id);
                                return (
                                    <TableRow key={site.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-4 w-4 text-primary" />
                                                {site.name}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-muted-foreground">{site.address || "-"}</TableCell>
                                        <TableCell>
                                            {managers.length > 0 ? (
                                                managers.map(m => (
                                                    <div key={m.id} className="inline-flex items-center mr-1 mb-1">
                                                        <Badge variant="secondary" className="pr-1">
                                                            {m.name}
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                className="h-3 w-3 ml-1 hover:bg-transparent text-muted-foreground hover:text-destructive p-0"
                                                                onClick={() => {
                                                                    if (confirm(`${m.name} 현장대리인을 삭제하시겠습니까?`)) {
                                                                        deleteManagerMutation.mutate(m.id);
                                                                    }
                                                                }}
                                                            >
                                                                <X className="h-3 w-3" />
                                                            </Button>
                                                        </Badge>
                                                    </div>
                                                ))
                                            ) : (
                                                <span className="text-muted-foreground text-sm">미등록</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <Users className="h-4 w-4 text-muted-foreground" />
                                                {workerCount}명
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground">
                                            {site.contractStartDate && site.contractEndDate
                                                ? `${site.contractStartDate} ~ ${site.contractEndDate}`
                                                : "-"}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedSiteForManager(site);
                                                        setShowManagerDialog(true);
                                                    }}
                                                >
                                                    <UserPlus className="h-4 w-4 mr-1" />
                                                    대리인
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => openEditDialog(site)}
                                                >
                                                    <Pencil className="h-4 w-4 text-muted-foreground" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => {
                                                        if (confirm(`${site.name}을(를) 삭제하시겠습니까?`)) {
                                                            deleteSiteMutation.mutate(site.id);
                                                        }
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                )}
            </div>
        </div>
    );
}
