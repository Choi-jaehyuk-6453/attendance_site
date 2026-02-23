import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { CalendarDays, Check, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { format } from "date-fns";
import type { VacationRequest, User, Site } from "@shared/schema";
import { useCompany } from "@/lib/company";
import { useRef } from "react";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { VacationRequestTemplate } from "@/components/print/VacationRequestTemplate";
import { sendEmailWithAttachment, generateVacationRequestPDF } from "@/lib/exportUtils";
import { Loader2, Mail, FileDown } from "lucide-react";
import { EmailRecipientSelector } from "@/components/ui/email-recipient-selector";

const vacationTypeLabels: Record<string, string> = {
    annual: "연차",
    half_day: "반차",
    sick: "병가",
    family_event: "경조사",
    other: "기타",
};

const statusLabels: Record<string, string> = {
    pending: "대기",
    approved: "승인",
    rejected: "반려",
};

const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
};

export default function HqAdminVacationRequests() {
    const { toast } = useToast();
    const { company } = useCompany();
    const [selectedSiteId, setSelectedSiteId] = useState<string>("all");

    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ["/api/sites", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/sites?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch sites");
            return res.json();
        },
    });

    const { data: requests = [] } = useQuery<VacationRequest[]>({
        queryKey: ["/api/vacation-requests", company.id, selectedSiteId],
        queryFn: async () => {
            let url = `/api/vacation-requests?company=${company.id}`;
            if (selectedSiteId && selectedSiteId !== "all") {
                url += `&siteId=${selectedSiteId}`;
            }
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed to fetch vacation requests");
            return res.json();
        }
    });

    const { data: users = [] } = useQuery<User[]>({
        queryKey: ["/api/users", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/users?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch users");
            return res.json();
        }
    });

    const [editDialog, setEditDialog] = useState<{ open: boolean; request: VacationRequest | null }>({ open: false, request: null });
    const [editForm, setEditForm] = useState({
        startDate: "",
        endDate: "",
        vacationType: "annual",
        reason: "",
        days: 1
    });

    // Sub-component for Printing/Emailing
    const printRef = useRef<HTMLDivElement>(null);
    const [printingRequest, setPrintingRequest] = useState<{ request: VacationRequest, user: User, siteName: string } | null>(null);
    const [emailDialog, setEmailDialog] = useState<{ open: boolean; email: string; isSending: boolean }>({ open: false, email: "", isSending: false });

    // Helper to generate PDF Blob using exportUtils
    const generateRequestPdfBlob = async (request: VacationRequest) => {
        const user = users.find(u => u.id === request.userId);
        const site = sites.find(s => s.id === (user?.siteId));
        if (!user || !site) return null;

        // Pass user.company or site.company.
        return await generateVacationRequestPDF(request, user, site.name, user.company || site.company);
    };

    const handleDownloadPdf = async (req: VacationRequest) => {
        const user = users.find(u => u.id === req.userId);
        if (!user) return;

        try {
            const blob = await generateRequestPdfBlob(req);
            if (!blob) throw new Error("PDF generation failed");

            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `휴가신청서_${user.name}_${req.startDate}.pdf`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Download failed:", error);
            toast({ variant: "destructive", title: "PDF 다운로드 실패" });
        }
    };

    const handleOpenEmailDialog = (req: VacationRequest) => {
        const user = users.find(u => u.id === req.userId);
        if (!user) return;
        const site = sites.find(s => s.id === user.siteId);

        // Pre-fill email from site manager contact if available
        const defaultEmail = site?.managerEmail || "";

        setPrintingRequest({ request: req, user, siteName: site?.name || "" });
        setEmailDialog({ open: true, email: defaultEmail, isSending: false });
    };

    const handleSendEmail = async () => {
        if (!printingRequest || !emailDialog.email) return;

        setEmailDialog(prev => ({ ...prev, isSending: true }));
        try {
            const blob = await generateRequestPdfBlob(printingRequest.request);
            if (!blob) throw new Error("PDF generation failed");

            await sendEmailWithAttachment(
                emailDialog.email,
                `휴가신청서 안내 - ${printingRequest.user.name}님`,
                `<div style="font-family: sans-serif; line-height: 1.5; color: #333;">
                    <p>안녕하세요.</p>
                    <p><strong>${printingRequest.user.name}</strong>님의 휴가신청서(PDF)를 첨부하여 보내드립니다.</p>
                    <p>첨부파일을 확인해 주시기 바랍니다.</p>
                    <p>감사합니다.</p>
                </div>`,
                {
                    filename: `휴가신청서_${printingRequest.user.name}.pdf`,
                    content: blob
                }
            );

            toast({ title: "이메일이 발송되었습니다" });
            setEmailDialog({ open: false, email: "", isSending: false });
            setPrintingRequest(null);
        } catch (error) {
            console.error(error);
            toast({ variant: "destructive", title: "이메일 발송 실패" });
            setEmailDialog(prev => ({ ...prev, isSending: false }));
        }
    };

    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, rejectionReason, ...otherData }: { id: string; status?: string; rejectionReason?: string;[key: string]: any }) => {
            const res = await apiRequest("PATCH", `/api/vacation-requests/${id}`, { status, rejectionReason, ...otherData });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-requests"] });
            queryClient.invalidateQueries({ queryKey: ["/api/attendance"] });
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-balance"] });
            setEditDialog({ open: false, request: null });
            toast({ title: "처리되었습니다" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/vacation-requests/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-requests"] });
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-balance"] });
            toast({ title: "삭제되었습니다" });
        },
    });

    const respondMutation = updateStatusMutation;

    const pendingRequests = requests.filter(r => r.status === "pending");
    const approvedRequests = requests.filter(r => r.status === "approved");
    const rejectedRequests = requests.filter(r => r.status === "rejected");
    const getUserName = (userId: string) => users.find(u => u.id === userId)?.name || "알 수 없음";
    const getUserSite = (userId: string) => {
        const user = users.find(u => u.id === userId);
        if (!user?.siteId) return "-";
        return sites.find(s => s.id === user.siteId)?.name || "-";
    };

    const RequestTable = ({ data, showActions = false }: { data: VacationRequest[], showActions?: boolean }) => (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>신청자</TableHead>
                    <TableHead>현장</TableHead>
                    <TableHead>유형</TableHead>
                    <TableHead>기간</TableHead>
                    <TableHead>일수</TableHead>
                    <TableHead>사유</TableHead>
                    <TableHead>신청일</TableHead>
                    {!showActions && <TableHead>상태</TableHead>}
                    <TableHead className="text-right">{showActions ? "처리" : "관리"}</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {data.length === 0 ? (
                    <TableRow>
                        <TableCell colSpan={showActions ? 8 : 9} className="text-center py-8 text-muted-foreground">
                            요청이 없습니다
                        </TableCell>
                    </TableRow>
                ) : (
                    data.map((req) => (
                        <TableRow key={req.id}>
                            <TableCell className="font-medium">{getUserName(req.userId)}</TableCell>
                            <TableCell>{getUserSite(req.userId)}</TableCell>
                            <TableCell>
                                <Badge variant="outline">{vacationTypeLabels[req.vacationType] || req.vacationType}</Badge>
                            </TableCell>
                            <TableCell>{req.startDate} ~ {req.endDate}</TableCell>
                            <TableCell>{req.days}일</TableCell>
                            <TableCell className="max-w-[200px] truncate">{req.reason || "-"}</TableCell>
                            <TableCell className="text-muted-foreground">
                                {req.requestedAt ? format(new Date(req.requestedAt), "yyyy-MM-dd") : "-"}
                            </TableCell>
                            {!showActions && (
                                <TableCell>
                                    <Badge className={statusColors[req.status] || ""}>{statusLabels[req.status] || req.status}</Badge>
                                </TableCell>
                            )}
                            <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                    {showActions && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="default"
                                                onClick={() => respondMutation.mutate({ id: req.id, status: "approved" })}
                                                disabled={respondMutation.isPending}
                                            >
                                                <Check className="h-4 w-4 mr-1" />
                                                승인
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="destructive"
                                                onClick={() => {
                                                    const reason = prompt("반려 사유를 입력해주세요:");
                                                    if (reason !== null) {
                                                        respondMutation.mutate({ id: req.id, status: "rejected", rejectionReason: reason });
                                                    }
                                                }}
                                                disabled={respondMutation.isPending}
                                            >
                                                <X className="h-4 w-4 mr-1" />
                                                반려
                                            </Button>
                                        </>
                                    )}
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
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleDownloadPdf(req)}
                                    >
                                        <FileDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => handleOpenEmailDialog(req)}
                                    >
                                        <Mail className="h-4 w-4" />
                                    </Button>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))
                )}
            </TableBody>
        </Table>
    );

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">휴가 신청 현황</h1>
                <p className="text-muted-foreground">근로자 휴가 신청을 확인하고 승인/반려합니다</p>
            </div>

            <div className="flex items-center gap-4">
                <Label className="font-medium whitespace-nowrap">현장 선택</Label>
                <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
                    <SelectTrigger className="w-64">
                        <SelectValue placeholder="전체 현장" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">전체 현장</SelectItem>
                        {sites.filter(s => s.isActive).map(site => (
                            <SelectItem key={site.id} value={site.id}>
                                {site.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
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
                    <TabsTrigger value="approved">
                        승인됨
                        {approvedRequests.length > 0 && (
                            <Badge variant="secondary" className="ml-2 px-1 py-0 h-5 text-xs">
                                {approvedRequests.length}
                            </Badge>
                        )}
                    </TabsTrigger>
                    <TabsTrigger value="rejected">
                        반려됨
                        {rejectedRequests.length > 0 && (
                            <Badge variant="secondary" className="ml-2 px-1 py-0 h-5 text-xs">
                                {rejectedRequests.length}
                            </Badge>
                        )}
                    </TabsTrigger>
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

            <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ ...editDialog, open })}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>휴가 신청 수정</DialogTitle>
                        <DialogDescription>
                            휴가 내용을 수정합니다.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label>휴가 유형</Label>
                            <select
                                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                value={editForm.vacationType}
                                onChange={(e) => setEditForm({ ...editForm, vacationType: e.target.value })}
                            >
                                {Object.entries(vacationTypeLabels).map(([k, v]) => (
                                    <option key={k} value={k}>{v}</option>
                                ))}
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

            {/* Email Dialog */}
            <Dialog open={emailDialog.open} onOpenChange={(open) => {
                if (!open) setPrintingRequest(null);
                setEmailDialog(prev => ({ ...prev, open }));
            }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>휴가신청서 이메일 발송</DialogTitle>
                        <DialogDescription>
                            신청서를 보낼 이메일 주소를 입력하세요.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <EmailRecipientSelector
                            presets={(() => {
                                if (!printingRequest) return [];
                                const siteId = printingRequest.user.siteId;
                                const site = sites.find(s => s.id === siteId);
                                return site?.managerEmail ? site.managerEmail.split(',').map(s => s.trim()) : [];
                            })()}
                            value={emailDialog.email}
                            onChange={(val) => setEmailDialog(prev => ({ ...prev, email: val }))}
                        />
                        {(() => {
                            if (!printingRequest) return null;
                            const siteId = printingRequest.user.siteId;
                            const site = sites.find(s => s.id === siteId);
                            return site && !site.managerEmail && (
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

        </div>
    );
}
