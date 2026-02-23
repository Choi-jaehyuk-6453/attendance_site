import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
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
import { Check, X, Calendar, User as UserIcon, Trash2 } from "lucide-react";
import type { VacationRequest, User } from "@shared/schema";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

import { VacationStatusTemplate } from "@/components/print/VacationStatusTemplate";
import { sendEmailWithAttachment, generateVacationStatusExcel, generateVacationRequestPDF } from "@/lib/exportUtils";
import { Loader2, Mail, FileDown, FileSpreadsheet } from "lucide-react";
import { EmailRecipientSelector } from "@/components/ui/email-recipient-selector";
import type { Site } from "@shared/schema";

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

export default function SiteManagerVacations() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [rejectDialog, setRejectDialog] = useState<{ open: boolean; requestId: string | null }>({ open: false, requestId: null });
    const [editDialog, setEditDialog] = useState<{ open: boolean; request: VacationRequest | null }>({ open: false, request: null });

    // Balance history edit dialog state
    const [balanceEditDialog, setBalanceEditDialog] = useState<{ open: boolean; entry: VacationHistoryEntry | null; workerName: string }>({
        open: false, entry: null, workerName: ""
    });
    const [balanceEditForm, setBalanceEditForm] = useState({
        startDate: "", endDate: "", vacationType: "annual", reason: "", days: 1
    });
    const [rejectionReason, setRejectionReason] = useState("");

    const currentYear = new Date().getFullYear();
    const [selectedYear, setSelectedYear] = useState<string>(String(currentYear));
    const years = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

    // Form state for editing
    const [editForm, setEditForm] = useState({
        startDate: "",
        endDate: "",
        vacationType: "annual",
        reason: "",
        days: 1
    });

    // Export & Email State
    const statusPrintRef = useRef<HTMLDivElement>(null);
    const [printingRequest, setPrintingRequest] = useState<{ request: VacationRequest, user: User, siteName: string } | null>(null);
    const [isExportingStatus, setIsExportingStatus] = useState(false);
    const [emailDialog, setEmailDialog] = useState<{ open: boolean; type: 'request' | 'status'; email: string; isSending: boolean }>({ open: false, type: 'request', email: "", isSending: false });

    // Request PDF/Email Handlers using exportUtils
    const generateRequestPdfBlob = async (request: VacationRequest) => {
        const reqUser = users.find(u => u.id === request.userId);
        if (!reqUser) return null;

        // Site Manager: User company is assumed to be the same as the site manager's company (user.company)
        // or we can fallback to siteName mapping if needed, but companyId is what matters for logo.
        return await generateVacationRequestPDF(request, reqUser, balances[0]?.siteName || "현장", user?.company || undefined);
    };

    const handleDownloadRequestPdf = async (req: VacationRequest) => {
        const reqUser = users.find(u => u.id === req.userId);
        if (!reqUser) return;

        try {
            const blob = await generateRequestPdfBlob(req);
            if (!blob) throw new Error("PDF generation failed");

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `휴가신청서_${reqUser.name}_${req.startDate}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
            toast({ variant: "destructive", title: "PDF 다운로드 실패" });
        }
    };

    const handleOpenRequestEmail = (req: VacationRequest) => {
        const reqUser = users.find(u => u.id === req.userId);
        if (!reqUser) return;

        const siteName = balances.length > 0 ? balances[0].siteName : "현장";
        setPrintingRequest({ request: req, user: reqUser, siteName });
        setEmailDialog({ open: true, type: 'request', email: "", isSending: false });
    };

    // Status Export Handlers
    const generateStatusPdfBlob = async () => {
        setIsExportingStatus(true);
        await new Promise(resolve => setTimeout(resolve, 500));
        if (!statusPrintRef.current) {
            setIsExportingStatus(false);
            return null;
        }
        try {
            const canvas = await html2canvas(statusPrintRef.current, { scale: 2, useCORS: true, logging: false });
            const imgData = canvas.toDataURL("image/png");
            const pdf = new jsPDF("l", "mm", "a4");
            const pdfWidth = pdf.internal.pageSize.getWidth();
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
            pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
            return pdf.output("blob");
        } finally {
            setIsExportingStatus(false);
        }
    };

    const handleExportStatusExcel = () => {
        const siteName = balances.length > 0 ? balances[0].siteName : "현장";
        const blob = generateVacationStatusExcel(balances, selectedYear);
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${selectedYear}년_휴가현황_${siteName}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportStatusPdf = async () => {
        const siteName = balances.length > 0 ? balances[0].siteName : "현장";
        const blob = await generateStatusPdfBlob();
        if (blob) {
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${selectedYear}년_휴가현황_${siteName}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        }
    };

    const handleOpenStatusEmail = () => {
        setEmailDialog({ open: true, type: 'status', email: "", isSending: false });
    };

    const handleSendEmail = async () => {
        if (!emailDialog.email) return;
        setEmailDialog(prev => ({ ...prev, isSending: true }));
        try {
            let blob;
            let subject = "";
            let html = "";
            let filename = "";

            if (emailDialog.type === 'request' && printingRequest) {
                blob = await generateRequestPdfBlob(printingRequest.request);
                subject = `휴가신청서 안내 - ${printingRequest.user.name}님`;
                html = `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                    <p>안녕하세요.</p>
                    <p><strong>${printingRequest.user.name}</strong>님의 휴가신청서(PDF)를 첨부하여 보내드립니다.</p>
                    <p>첨부파일을 확인해 주시기 바랍니다.</p>
                    <p>감사합니다.</p>
                </div>`;
                filename = `휴가신청서_${printingRequest.user.name}.pdf`;
            } else if (emailDialog.type === 'status') {
                blob = await generateStatusPdfBlob();
                const siteName = balances.length > 0 ? balances[0].siteName : "현장";
                subject = `${selectedYear}년 휴가현황 안내 - ${siteName}`;
                html = `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                    <p>안녕하세요.</p>
                    <p><strong>${siteName}</strong>의 ${selectedYear}년도 휴가 현황(PDF)을 첨부하여 보내드립니다.</p>
                    <p>해당 내용을 확인해 주시고, 업무에 참고하시기 바랍니다.</p>
                    <p>감사합니다.</p>
                </div>`;
                filename = `${selectedYear}년_휴가현황_${siteName}.pdf`;
            }

            if (!blob) throw new Error("PDF generation failed");

            await sendEmailWithAttachment(emailDialog.email, subject, html, { filename, content: blob });

            toast({ title: "이메일이 발송되었습니다" });
            setEmailDialog({ open: false, type: 'request', email: "", isSending: false });
            setPrintingRequest(null);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "이메일 발송 실패" });
            setEmailDialog(prev => ({ ...prev, isSending: false }));
        }
    };

    const { data: requests = [] } = useQuery<VacationRequest[]>({
        queryKey: ["/api/vacation-requests"],
    });

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ["/api/users"],
    });

    const { data: balances = [], isLoading: balancesLoading } = useQuery<VacationBalance[]>({
        queryKey: ["/api/vacation-balance", selectedYear],
        queryFn: async () => {
            const res = await fetch(`/api/vacation-balance?year=${selectedYear}`);
            if (!res.ok) throw new Error("Failed to fetch balances");
            return res.json();
        },
    });

    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ["/api/sites"],
    });

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, rejectionReason, ...otherData }: { id: string; status?: string; rejectionReason?: string;[key: string]: any }) => {
            const res = await apiRequest("PATCH", `/api/vacation-requests/${id}`, { status, rejectionReason, ...otherData });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-requests"] });
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-balance"] });
            setRejectDialog({ open: false, requestId: null });
            setEditDialog({ open: false, request: null });
            setRejectionReason("");
            toast({ title: "휴가 요청이 처리되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "요청 처리에 실패했습니다" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/vacation-requests/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-requests"] });
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-balance"] });
            setBalanceEditDialog({ open: false, entry: null, workerName: "" });
            toast({ title: "휴가 요청이 삭제되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "삭제에 실패했습니다" });
        }
    });

    const openBalanceEditDialog = (entry: VacationHistoryEntry, workerName: string) => {
        setBalanceEditForm({
            startDate: entry.startDate,
            endDate: entry.endDate,
            vacationType: entry.type,
            reason: entry.reason || "",
            days: entry.days,
        });
        setBalanceEditDialog({ open: true, entry, workerName });
    };

    const handleBalanceDateChange = (field: "startDate" | "endDate", value: string) => {
        const newForm = { ...balanceEditForm, [field]: value };
        if (newForm.startDate && newForm.endDate) {
            const start = new Date(newForm.startDate);
            const end = new Date(newForm.endDate);
            const diffMs = end.getTime() - start.getTime();
            const diffDays = Math.max(Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1, 1);
            newForm.days = newForm.vacationType === "half_day" ? 0.5 : diffDays;
        }
        setBalanceEditForm(newForm);
    };

    const handleApprove = (id: string) => {
        if (confirm("이 휴가 요청을 승인하시겠습니까?")) {
            updateStatusMutation.mutate({ id, status: "approved" });
        }
    };

    const handleRejectClick = (id: string) => {
        setRejectDialog({ open: true, requestId: id });
    };

    const handleRejectConfirm = () => {
        if (rejectDialog.requestId) {
            updateStatusMutation.mutate({
                id: rejectDialog.requestId,
                status: "rejected",
                rejectionReason
            });
        }
    };

    const getUserName = (userId: string) => {
        return users.find(u => u.id === userId)?.name || "알 수 없음";
    };

    const getVacationTypeLabel = (type: string) => {
        const types: Record<string, string> = {
            annual: "연차",
            half_day: "반차",
            sick: "병가",
            family_event: "경조사",
            other: "기타"
        };
        return types[type] || type;
    };

    const pendingRequests = requests.filter(r => r.status === "pending");
    const approvedRequests = requests.filter(r => r.status === "approved");
    const rejectedRequests = requests.filter(r => r.status === "rejected");

    const RequestTable = ({ data, showActions = false }: { data: VacationRequest[], showActions?: boolean }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>구분</TableHead>
                    <TableHead>기간</TableHead>
                    <TableHead>일수</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>신청일</TableHead>
                    {showActions && <TableHead className="text-right">관리</TableHead>}
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={showActions ? 7 : 6} className="text-center py-8 text-muted-foreground">
                            요청이 없습니다
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map((req) => (
                        <TableRow key={req.id}>
                            <TableCell className="font-medium">{getUserName(req.userId)}</TableCell>
                            <TableCell><Badge variant="outline">{getVacationTypeLabel(req.vacationType)}</Badge></TableCell>
                            <TableCell>
                                {req.startDate === req.endDate
                                    ? req.startDate
                                    : `${req.startDate} ~ ${req.endDate}`}
                            </TableCell>
                            <TableCell>{req.days}일</TableCell>
                            <TableCell className="max-w-[200px] truncate" title={req.reason || ""}>
                                {req.reason || "-"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                                {format(new Date(req.requestedAt), "yyyy-MM-dd")}
                            </TableCell>
                            {showActions ? (
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-green-600 hover:text-green-700"
                                            onClick={() => handleApprove(req.id)}
                                        >
                                            <Check className="h-4 w-4 mr-1" />
                                            승인
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 hover:text-red-700"
                                            onClick={() => handleRejectClick(req.id)}
                                        >
                                            <X className="h-4 w-4 mr-1" />
                                            반려
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setEditForm({
                                                    startDate: req.startDate,
                                                    endDate: req.endDate,
                                                    vacationType: req.vacationType,
                                                    reason: req.reason || "",
                                                    days: req.days
                                                });
                                                setEditDialog({ open: true, request: req });
                                            }}
                                        >
                                            <UserIcon className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </TableCell>
                            ) : (
                                <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDownloadRequestPdf(req)}
                                        >
                                            <FileDown className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleOpenRequestEmail(req)}
                                        >
                                            <Mail className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => {
                                                setEditForm({
                                                    startDate: req.startDate,
                                                    endDate: req.endDate,
                                                    vacationType: req.vacationType,
                                                    reason: req.reason || "",
                                                    days: req.days
                                                });
                                                setEditDialog({ open: true, request: req });
                                            }}
                                        >
                                            수정
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            className="text-red-500"
                                            onClick={() => {
                                                if (confirm("정말 삭제하시겠습니까? (출근기록도 함께 삭제됩니다)")) {
                                                    deleteMutation.mutate(req.id);
                                                }
                                            }}
                                        >
                                            삭제
                                        </Button>
                                    </div>
                                </TableCell>
                            )}
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">휴가 관리</h1>
                <p className="text-muted-foreground">근로자의 휴가 요청을 관리합니다</p>
            </div>

            <Tabs defaultValue="pending">
                <TabsList>
                    <TabsTrigger value="pending">
                        대기 중
                        {pendingRequests.length > 0 && (
                            <Badge variant="secondary" className="ml-2 px-1 py-0 h-5 text-xs">
                                {pendingRequests.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="approved">승인됨</TabsTrigger>
                    <TabsTrigger value="rejected">반려됨</TabsTrigger>
                </TabsList>

                <TabsContent value="pending" className="mt-4">
                    <Card>
                        <CardContent className="p-0">
                            <RequestTable data={pendingRequests} showActions={true} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="approved" className="mt-4">
                    <Card>
                        <CardContent className="p-0">
                            <RequestTable data={approvedRequests} />
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="rejected" className="mt-4">
                    <Card>
                        <CardContent className="p-0">
                            <RequestTable data={rejectedRequests} />
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* 휴가 현황 - 별도 섹션 */}
            <div className="border-t pt-6 mt-6 space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">휴가 현황</h2>
                    <div className="flex items-center gap-4">
                        <select
                            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                        >
                            {years.map(y => (
                                <option key={y} value={String(y)}>{y}년</option>
                            ))}
                        </select>
                        {!balancesLoading && (
                            <span className="text-sm text-muted-foreground">총 {balances.length}명</span>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={handleExportStatusExcel}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            엑셀 출력
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExportStatusPdf}>
                            <FileDown className="mr-2 h-4 w-4" />
                            PDF 출력
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleOpenStatusEmail}>
                            <Mail className="mr-2 h-4 w-4" />
                            이메일 발송
                        </Button>
                    </div>
                </div>

                {balancesLoading ? (
                    <Card>
                        <CardContent className="flex items-center justify-center py-16">
                            <p className="text-muted-foreground">로딩 중...</p>
                        </CardContent>
                    </Card>
                ) : balances.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-16">
                            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-muted-foreground">등록된 근로자가 없습니다</p>
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
                                                            onClick={() => openBalanceEditDialog(v, b.name)}
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
            </div>

            <Dialog open={rejectDialog.open} onOpenChange={(open) => setRejectDialog(prev => ({ ...prev, open }))}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>휴가 반려</DialogTitle>
                        <DialogDescription>
                            휴가 요청을 반려하는 사유를 입력해주세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="mb-2 block">반려 사유</Label>
                        <Input
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                            placeholder="예: 현장 인력 부족"
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRejectDialog({ open: false, requestId: null })}>취소</Button>
                        <Button
                            variant="destructive"
                            onClick={handleRejectConfirm}
                            disabled={!rejectionReason || updateStatusMutation.isPending}
                        >
                            반려하기
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>


            <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>휴가 신청 수정</DialogTitle>
                        <DialogDescription>
                            휴가 내용을 수정합니다. 승인된 휴가를 수정하면 출근기록부도 자동으로 갱신됩니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>휴가 유형</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                value={editForm.vacationType}
                                onChange={(e) => setEditForm({ ...editForm, vacationType: e.target.value })}
                            >
                                <option value="annual">연차</option>
                                <option value="half_day">반차</option>
                                <option value="sick">병가</option>
                                <option value="family_event">경조사</option>
                                <option value="other">기타</option>
                            </select>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <Label>시작일</Label>
                                <Input
                                    type="date"
                                    value={editForm.startDate}
                                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                                />
                            </div>
                            <div>
                                <Label>종료일</Label>
                                <Input
                                    type="date"
                                    value={editForm.endDate}
                                    onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>일수</Label>
                            <Input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={editForm.days}
                                onChange={(e) => setEditForm({ ...editForm, days: parseFloat(e.target.value) || 0 })}
                            />
                        </div>
                        <div>
                            <Label>사유</Label>
                            <Input
                                value={editForm.reason}
                                onChange={(e) => setEditForm({ ...editForm, reason: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditDialog({ open: false, request: null })}>취소</Button>
                        <Button
                            onClick={() => {
                                if (editDialog.request) {
                                    updateStatusMutation.mutate({
                                        id: editDialog.request.id,
                                        ...editForm
                                    });
                                }
                            }}
                            disabled={updateStatusMutation.isPending}
                        >
                            수정 저장
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Balance History Edit/Delete Dialog */}
            <Dialog open={balanceEditDialog.open} onOpenChange={(open) => setBalanceEditDialog(prev => ({ ...prev, open }))}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>휴가 수정 · 삭제</DialogTitle>
                        <DialogDescription>{balanceEditDialog.workerName}님의 휴가</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>시작일</Label>
                                <Input
                                    type="date"
                                    value={balanceEditForm.startDate}
                                    onChange={(e) => handleBalanceDateChange("startDate", e.target.value)}
                                />
                            </div>
                            <div>
                                <Label>종료일</Label>
                                <Input
                                    type="date"
                                    value={balanceEditForm.endDate}
                                    onChange={(e) => handleBalanceDateChange("endDate", e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <Label>휴가 유형</Label>
                                <select
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                    value={balanceEditForm.vacationType}
                                    onChange={(e) => {
                                        const newType = e.target.value;
                                        setBalanceEditForm(prev => ({
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
                                    value={balanceEditForm.days}
                                    onChange={(e) => setBalanceEditForm(prev => ({ ...prev, days: parseFloat(e.target.value) || 1 }))}
                                />
                            </div>
                        </div>
                        <div>
                            <Label>사유</Label>
                            <Input
                                value={balanceEditForm.reason}
                                onChange={(e) => setBalanceEditForm(prev => ({ ...prev, reason: e.target.value }))}
                                placeholder="휴가 사유"
                            />
                        </div>
                    </div>
                    <DialogFooter className="flex justify-between sm:justify-between">
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                                if (balanceEditDialog.entry && confirm("이 휴가를 삭제하시겠습니까?")) {
                                    deleteMutation.mutate(balanceEditDialog.entry.id);
                                }
                            }}
                            disabled={deleteMutation.isPending}
                        >
                            <Trash2 className="h-4 w-4 mr-1" />
                            삭제
                        </Button>
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setBalanceEditDialog({ open: false, entry: null, workerName: "" })}>
                                취소
                            </Button>
                            <Button
                                onClick={() => {
                                    if (balanceEditDialog.entry) {
                                        updateStatusMutation.mutate({
                                            id: balanceEditDialog.entry.id,
                                            ...balanceEditForm,
                                        });
                                    }
                                }}
                                disabled={updateStatusMutation.isPending}
                            >
                                저장
                            </Button>
                        </div>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Email Dialog */}
            <Dialog open={emailDialog.open} onOpenChange={(open) => {
                if (!open) {
                    setPrintingRequest(null);
                    setIsExportingStatus(false);
                }
                setEmailDialog(prev => ({ ...prev, open }));
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {emailDialog.type === 'request' ? '휴가신청서 이메일 발송' : '휴가 현황 이메일 발송'}
                        </DialogTitle>
                        <DialogDescription>
                            {emailDialog.type === 'request' ? '신청서를 보낼' : '현황표를 보낼'} 이메일 주소를 입력하세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <EmailRecipientSelector
                            presets={(() => {
                                // For Site Manager, get current site's manager emails
                                if (!user?.siteId) return [];
                                const site = sites.find(s => s.id === user.siteId);
                                return site?.managerEmail ? site.managerEmail.split(',').map(s => s.trim()) : [];
                            })()}
                            value={emailDialog.email}
                            onChange={(val) => setEmailDialog(prev => ({ ...prev, email: val }))}
                        />
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

            {/* Hidden Templates */}
            <div style={{ position: "absolute", top: -9999, left: -9999 }}>

                {isExportingStatus && (
                    <VacationStatusTemplate
                        ref={statusPrintRef}
                        data={balances}
                        siteName={balances.length > 0 ? balances[0].siteName : undefined}
                        year={selectedYear}
                        companyId={user?.company ?? undefined}
                    />
                )}
            </div>
        </div>
    );
}
