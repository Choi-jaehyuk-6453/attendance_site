import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Plus, CalendarDays, ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";
import type { VacationRequest } from "@shared/schema";

const vacationTypeLabels: Record<string, string> = {
    annual: "연차",
    half_day: "반차",
    sick: "병가",
    family_event: "경조사",
    other: "기타",
};

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    pending: { label: "대기중", variant: "outline" },
    approved: { label: "승인", variant: "default" },
    rejected: { label: "반려", variant: "destructive" },
};

export default function WorkerVacation() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [, setLocation] = useLocation();
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [form, setForm] = useState({
        vacationType: "annual",
        startDate: "",
        endDate: "",
        days: 1,
        reason: "",
        substituteWork: "X",
    });

    const calculateDays = (startDate: string, endDate: string, vacationType: string) => {
        if (!startDate || !endDate) return 1;
        if (vacationType === "half_day") return 0.5;
        const start = new Date(startDate);
        const end = new Date(endDate);
        const diff = differenceInCalendarDays(end, start) + 1;
        return diff > 0 ? diff : 1;
    };

    const handleDateChange = (field: "startDate" | "endDate", value: string) => {
        const updated = { ...form, [field]: value };
        updated.days = calculateDays(updated.startDate, updated.endDate, updated.vacationType);
        setForm(updated);
    };

    const handleVacationTypeChange = (value: string) => {
        const updated = { ...form, vacationType: value };
        updated.days = calculateDays(updated.startDate, updated.endDate, value);
        setForm(updated);
    };

    const { data: requests = [] } = useQuery<VacationRequest[]>({
        queryKey: ["/api/vacation-requests/user", user?.id],
        queryFn: async () => {
            if (!user?.id) return [];
            const res = await fetch(`/api/vacation-requests/user/${user.id}`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!user?.id,
    });

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/vacation-requests", {
                ...data,
                userId: user?.id,
            });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-requests/user"] });
            setShowCreateDialog(false);
            setForm({ vacationType: "annual", startDate: "", endDate: "", days: 1, reason: "", substituteWork: "X" });
            toast({ title: "휴가 신청이 완료되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "휴가 신청에 실패했습니다" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("DELETE", `/api/vacation-requests/${id}`);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/vacation-requests/user"] });
            toast({ title: "휴가 신청이 취소되었습니다" });
        },
    });

    return (
        <div className="min-h-screen bg-background">
            <div className="bg-primary text-primary-foreground p-4">
                <div className="max-w-lg mx-auto flex items-center gap-3">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-primary-foreground hover:text-primary-foreground/80"
                        onClick={() => setLocation("/worker")}
                    >
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-lg font-bold">휴가 신청</h1>
                </div>
            </div>

            <div className="max-w-lg mx-auto p-4 space-y-4">
                <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                    <DialogTrigger asChild>
                        <Button className="w-full h-12">
                            <Plus className="h-5 w-5 mr-2" />
                            새 휴가 신청
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>휴가 신청</DialogTitle>
                            <DialogDescription>휴가 유형과 기간을 선택해주세요</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label>휴가 유형</Label>
                                <Select
                                    value={form.vacationType}
                                    onValueChange={handleVacationTypeChange}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="annual">연차</SelectItem>
                                        <SelectItem value="half_day">반차</SelectItem>
                                        <SelectItem value="sick">병가</SelectItem>
                                        <SelectItem value="family_event">경조사</SelectItem>
                                        <SelectItem value="other">기타</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>시작일</Label>
                                    <Input
                                        type="date"
                                        value={form.startDate}
                                        onChange={(e) => handleDateChange("startDate", e.target.value)}
                                    />
                                </div>
                                <div>
                                    <Label>종료일</Label>
                                    <Input
                                        type="date"
                                        value={form.endDate}
                                        onChange={(e) => handleDateChange("endDate", e.target.value)}
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>일수 (자동 계산, 수정 가능)</Label>
                                <Input
                                    type="number"
                                    min={0.5}
                                    step={0.5}
                                    value={form.days}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setForm({ ...form, days: val === "" ? 0 : parseFloat(val) });
                                    }}
                                    onBlur={() => {
                                        if (!form.days || form.days <= 0) {
                                            setForm({ ...form, days: calculateDays(form.startDate, form.endDate, form.vacationType) });
                                        }
                                    }}
                                />
                            </div>
                            <div>
                                <Label>사유</Label>
                                <Textarea
                                    value={form.reason}
                                    onChange={(e) => setForm({ ...form, reason: e.target.value })}
                                    placeholder="휴가 사유를 입력해주세요"
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>취소</Button>
                            <Button
                                onClick={() => createMutation.mutate(form)}
                                disabled={!form.startDate || !form.endDate || createMutation.isPending}
                            >
                                {createMutation.isPending ? "신청 중..." : "신청"}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Request list */}
                <h2 className="font-semibold text-lg flex items-center gap-2">
                    <CalendarDays className="h-5 w-5" />
                    신청 내역
                </h2>

                {requests.length === 0 ? (
                    <Card>
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <CalendarDays className="h-10 w-10 text-muted-foreground mb-3" />
                            <p className="text-muted-foreground">신청 내역이 없습니다</p>
                        </CardContent>
                    </Card>
                ) : (
                    requests.map((req) => {
                        const statusInfo = statusLabels[req.status] || { label: req.status, variant: "outline" as const };
                        return (
                            <Card key={req.id}>
                                <CardContent className="p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <Badge variant="outline">
                                            {vacationTypeLabels[req.vacationType] || req.vacationType}
                                        </Badge>
                                        <Badge variant={statusInfo.variant}>
                                            {statusInfo.label}
                                        </Badge>
                                    </div>
                                    <p className="font-medium">{req.startDate} ~ {req.endDate}</p>
                                    <p className="text-sm text-muted-foreground">{req.days}일</p>
                                    {req.reason && (
                                        <p className="text-sm text-muted-foreground mt-1">
                                            사유: {req.reason}
                                        </p>
                                    )}
                                    {req.rejectionReason && (
                                        <p className="text-sm text-red-600 mt-1">
                                            반려 사유: {req.rejectionReason}
                                        </p>
                                    )}
                                    {req.status === "pending" && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="mt-2 text-destructive"
                                            onClick={() => {
                                                if (confirm("휴가 신청을 취소하시겠습니까?")) {
                                                    deleteMutation.mutate(req.id);
                                                }
                                            }}
                                        >
                                            신청 취소
                                        </Button>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>
        </div>
    );
}
