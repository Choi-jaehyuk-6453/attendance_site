import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { CalendarDays, Trash2 } from "lucide-react";
import type { Site } from "@shared/schema";
import { useCompany } from "@/lib/company";
import { useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { VacationStatusTemplate } from "@/components/print/VacationStatusTemplate";
import { sendEmailWithAttachment, generateVacationStatusExcel } from "@/lib/exportUtils";
import { Loader2, Mail, FileDown, FileSpreadsheet } from "lucide-react";
import { EmailRecipientSelector } from "@/components/ui/email-recipient-selector";

interface VacationHistoryEntry {
    id: string;
    startDate: string;
    endDate: string;
    type: string;
    days: number;
    reason: string;
}

interface VacationBalance {
    userId: string;
    name: string;
    siteName: string;
    jobTitle: string;
    hireDate: string | null;
    yearsWorked: number;
    monthsWorked: number;
    totalEntitlement: number;
    usedDays: number;
    remainingDays: number;
    pendingDays: number;
    pendingCount: number;
    vacationHistory: VacationHistoryEntry[];
    description: string;
    periodStart: string;
    periodEnd: string;
}

function formatShortDate(dateStr: string): string {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}

const vacationTypeColors: Record<string, string> = {
    annual: "bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200",
    half_day: "bg-purple-100 text-purple-700 border-purple-200 hover:bg-purple-200",
    sick: "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200",
    family_event: "bg-pink-100 text-pink-700 border-pink-200 hover:bg-pink-200",
    other: "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200",
};

const vacationTypeLabels: Record<string, string> = {
    annual: "연차",
    half_day: "반차",
    sick: "병가",
    family_event: "경조사",
    other: "기타",
};

export default function HqAdminVacationStatus() {
    const { company } = useCompany();
    const { toast } = useToast();
    const currentYear = new Date().getFullYear();
    const [selectedSiteId, setSelectedSiteId] = useState<string>("");
    const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));

    // Edit dialog state
    const [editDialog, setEditDialog] = useState<{ open: boolean; entry: VacationHistoryEntry | null; workerName: string }>({
        open: false, entry: null, workerName: ""
    });
    const [editForm, setEditForm] = useState({
        startDate: "", endDate: "", vacationType: "annual", reason: "", days: 1
    });

    // Export & Email State
    const printRef = useRef<HTMLDivElement>(null);
    const [isExporting, setIsExporting] = useState(false);
    const [emailDialog, setEmailDialog] = useState<{ open: boolean; email: string; isSending: boolean }>({ open: false, email: "", isSending: false });

    const getCurrentSiteName = () => {
        if (!selectedSiteId) return "전체 현장";
        return sites.find(s => s.id === selectedSiteId)?.name || "전체 현장";
    };

    const generatePdfBlob = async () => {
        if (!printRef.current) return null;

        // Wait a tick for render
        setIsExporting(true);
        await new Promise(resolve => setTimeout(resolve, 500)); // Wait for render

        try {
            const canvas = await html2canvas(printRef.current, {
                scale: 2,
                useCORS: true,
                logging: false,
            });

            const imgData = canvas.toDataURL("image/png");
            // A4 Landscape
            const pdf = new jsPDF("l", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            return pdf.output("blob");
        } finally {
            setIsExporting(false);
        }
    };

    const handleExportExcel = () => {
        const blob = generateVacationStatusExcel(balances, selectedYear);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedYear}년_휴가현황_${getCurrentSiteName()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportPdf = async () => {
        const blob = await generatePdfBlob();
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${selectedYear}년_휴가현황_${getCurrentSiteName()}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const handleOpenEmailDialog = () => {
        // Find site manager email if a site is selected
        const site = sites.find(s => s.id === selectedSiteId);
        const defaultEmail = site?.managerEmail || "";
        setEmailDialog({ open: true, email: defaultEmail, isSending: false });
    };

    const handleSendEmail = async () => {
        if (!emailDialog.email) return;

        setEmailDialog(prev => ({ ...prev, isSending: true }));
        try {
            const blob = await generatePdfBlob();
            if (!blob) throw new Error("PDF generation failed");

            await sendEmailWithAttachment(
                emailDialog.email,
                `${selectedYear}년 휴가현황 안내 - ${getCurrentSiteName()}`,
                `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                    <p>안녕하세요.</p>
                    <p><strong>${getCurrentSiteName()}</strong>의 ${selectedYear}년도 휴가 현황(PDF)을 첨부하여 보내드립니다.</p>
                    <p>해당 내용을 확인해 주시고, 문의사항이 있으시면 연락 주시기 바랍니다.</p>
                    <p>감사합니다.</p>
                </div>`,
                {
                    filename: `${selectedYear}년_휴가현황_${getCurrentSiteName()}.pdf`,
                    content: blob
                }
            );

            toast({ title: "이메일이 발송되었습니다" });
            setEmailDialog({ open: false, email: "", isSending: false });
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "이메일 발송 실패" });
            setEmailDialog(prev => ({ ...prev, isSending: false }));
        }
    };

    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ["/api/sites", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/sites?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch sites");
            return res.json();
        },
        enabled: !!selectedSiteId,
    });

    const { data: balances = [], isLoading: balancesLoading } = useQuery<VacationBalance[]>({
        queryKey: ["/api/vacation-balance", selectedSiteId, selectedYear],
        queryFn: async () => {
            const res = await fetch(`/api/vacation-balance?siteId=${selectedSiteId}&year=${selectedYear}`);
            if (!res.ok) throw new Error("Failed to fetch balances");
            return res.json();
        },
        enabled: !!selectedSiteId,
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, ...data }: { id: string; startDate: string; endDate: string; vacationType: string; reason: string; days: number }) => {
            const res = await apiRequest("PATCH", `/api/vacation-requests/${id}`, data);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-balance"] });
            setEditDialog({ open: false, entry: null, workerName: "" });
            toast({ title: "휴가가 수정되었습니다" });
        },
        onError: () => toast({ variant: "destructive", title: "수정에 실패했습니다" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/vacation-requests/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-balance"] });
            setEditDialog({ open: false, entry: null, workerName: "" });
            toast({ title: "휴가가 삭제되었습니다" });
        },
        onError: () => toast({ variant: "destructive", title: "삭제에 실패했습니다" }),
    });

    const openEditDialog = (entry: VacationHistoryEntry, workerName: string) => {
        setEditForm({
            startDate: entry.startDate,
            endDate: entry.endDate,
            vacationType: entry.type,
            reason: entry.reason || "",
            days: entry.days,
        });
        setEditDialog({ open: true, entry, workerName });
    };

    // Auto-calculate days when dates change
    const handleDateChange = (field: "startDate" | "endDate", value: string) => {
        const newForm = { ...editForm, [field]: value };
        if (newForm.startDate && newForm.endDate) {
            const start = new Date(newForm.startDate);
            const end = new Date(newForm.endDate);
            const diffMs = end.getTime() - start.getTime();
            const diffDays = Math.max(Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1, 1);
            newForm.days = newForm.vacationType === "half_day" ? 0.5 : diffDays;
        }
        setEditForm(newForm);
    };

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">휴가 현황</h1>
                <p className="text-muted-foreground">현장별 근로자 연차 현황을 조회합니다</p>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                    <SelectTrigger className="w-48">
                        <SelectValue placeholder="현장 선택" />
                    </SelectTrigger>
                    <SelectContent>
                        {sites.filter(s => s.isActive).map(site => (
                            <SelectItem key={site.id} value={site.id}>
                                {site.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Select value={selectedYear} onValueChange={setSelectedYear}>
                    <SelectTrigger className="w-32">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {years.map(y => (
                            <SelectItem key={y} value={String(y)}>
                                {y}년
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {selectedSiteId && !balancesLoading && (
                    <span className="text-sm text-muted-foreground">총 {balances.length}명</span>
                )}
            </div>

            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleExportExcel}>
                    <FileSpreadsheet className="mr-2 h-4 w-4" />
                    엑셀 출력
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPdf}>
                    <FileDown className="mr-2 h-4 w-4" />
                    PDF 출력
                </Button>
                <Button variant="outline" size="sm" onClick={handleOpenEmailDialog}>
                    <Mail className="mr-2 h-4 w-4" />
                    이메일 발송
                </Button>
            </div>

            {!selectedSiteId ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">현장을 선택하면 휴가 현황이 표시됩니다</p>
                    </CardContent>
                </Card>
            ) : balancesLoading ? (
                <Card>
                    <CardContent className="flex items-center justify-center py-16">
                        <p className="text-muted-foreground">로딩 중...</p>
                    </CardContent>
                </Card>
            ) : balances.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <CalendarDays className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">해당 현장에 등록된 근로자가 없습니다</p>
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardContent className="p-0 overflow-x-auto">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="font-semibold">이름</TableHead>
                                    <TableHead className="font-semibold">현장</TableHead>
                                    <TableHead className="font-semibold">입사일</TableHead>
                                    <TableHead className="font-semibold text-center">총 연차</TableHead>
                                    <TableHead className="font-semibold text-center">사용</TableHead>
                                    <TableHead className="font-semibold text-center">잔여</TableHead>

                                    <TableHead className="font-semibold">휴가 내역</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {balances.map((b) => (
                                    <TableRow key={b.userId}>
                                        <TableCell className="font-bold">{b.name}</TableCell>
                                        <TableCell>{b.siteName}</TableCell>
                                        <TableCell>{b.hireDate || "-"}</TableCell>
                                        <TableCell className="text-center font-medium">{b.totalEntitlement}</TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-orange-600 font-medium">{b.usedDays}</span>
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <span className="text-teal-600 font-medium">{b.remainingDays}</span>
                                        </TableCell>

                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {b.vacationHistory.map((v) => (
                                                    <button
                                                        key={v.id}
                                                        onClick={() => openEditDialog(v, b.name)}
                                                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs border cursor-pointer transition-colors ${vacationTypeColors[v.type] || vacationTypeColors.other}`}
                                                    >
                                                        {formatShortDate(v.startDate)}
                                                        {v.startDate !== v.endDate && `~${formatShortDate(v.endDate)}`}
                                                    </button>
                                                ))}
                                                {b.vacationHistory.length === 0 && (
                                                    <span className="text-muted-foreground text-xs">-</span>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Edit/Delete Dialog */}
            <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>휴가 수정 · 삭제</DialogTitle>
                        <DialogDescription>{editDialog.workerName}님의 휴가</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>시작일</Label>
                                <Input
                                    type="date"
                                    value={editForm.startDate}
                                    onChange={(e) => handleDateChange("startDate", e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>종료일</Label>
                                <Input
                                    type="date"
                                    value={editForm.endDate}
                                    onChange={(e) => handleDateChange("endDate", e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>휴가 유형</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={editForm.vacationType}
                                    onChange={(e) => {
                                        const newType = e.target.value;
                                        setEditForm(prev => ({
                                            ...prev,
                                            vacationType: newType,
                                            days: newType === "half_day" ? 0.5 : prev.days
                                        }));
                                    }}
                                >
                                    {Object.entries(vacationTypeLabels).map(([k, v]) => (
                                        <option key={k} value={k}>{v}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <Label>일수</Label>
                                <Input
                                    type="number"
                                    step="0.5"
                                    min="0.5"
                                    value={editForm.days}
                                    onChange={(e) => setEditForm(prev => ({ ...prev, days: parseFloat(e.target.value) || 1 }))}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>사유</Label>
                            <Input
                                value={editForm.reason}
                                onChange={(e) => setEditForm(prev => ({ ...prev, reason: e.target.value }))}
                                placeholder="휴가 사유"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between sm:justify-between">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                if (editDialog.entry && confirm("이 휴가를 삭제하시겠습니까?")) {
                                    deleteMutation.mutate(editDialog.entry.id);
                                }
                            }}
                            disabled={deleteMutation.isPending}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            삭제
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setEditDialog({ open: false, entry: null, workerName: "" })}>
                                취소
                            </Button>
                            <Button
                                onClick={() => {
                                    if (editDialog.entry) {
                                        updateMutation.mutate({
                                            id: editDialog.entry.id,
                                            ...editForm,
                                        });
                                    }
                                }}
                                disabled={updateMutation.isPending}
                            >
                                저장
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Email Dialog */}
            <Dialog open={emailDialog.open} onOpenChange={(open) => setEmailDialog(prev => ({ ...prev, open }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>휴가 현황 이메일 발송</DialogTitle>
                        <DialogDescription>
                            현황표를 보낼 이메일 주소를 입력하세요 (PDF 첨부).
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label>받는 사람</Label>
                        <EmailRecipientSelector
                            presets={(() => {
                                const site = sites.find(s => s.id === selectedSiteId);
                                return site?.managerEmail ? site.managerEmail.split(',').map(s => s.trim()) : [];
                            })()}
                            value={emailDialog.email}
                            onChange={(val) => setEmailDialog(prev => ({ ...prev, email: val }))}
                        />
                        {(() => {
                            const site = sites.find(s => s.id === selectedSiteId);
                            return selectedSiteId && !site?.managerEmail && (
                                <p className="text-xs text-muted-foreground mt-2 text-orange-500">
                                    * 등록된 현장 관리자 이메일이 없습니다. [현장 관리] 메뉴에서 이메일을 등록하면 목록에서 선택할 수 있습니다.
                                </p>
                            );
                        })()}
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setEmailDialog(prev => ({ ...prev, open: false }))}
                            disabled={emailDialog.isSending}
                        >
                            취소
                        </Button>
                        <Button onClick={handleSendEmail} disabled={emailDialog.isSending}>
                            {emailDialog.isSending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            발송
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Hidden Print Template */}
            <div style={{ position: "absolute", top: -9999, left: -9999 }}>
                {isExporting && (
                    <VacationStatusTemplate
                        ref={printRef}
                        data={balances}
                        siteName={getCurrentSiteName() === "전체 현장" ? undefined : getCurrentSiteName()}
                        year={selectedYear}
                    />
                )}
            </div>
        </div>
    );
}
