import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { calculateAnnualLeave } from "@shared/leave-utils";
import {
  CalendarDays,
  FileDown,
  Mail,
  Edit,
  Trash2,
  Plus,
} from "lucide-react";
import type { VacationRequest, User as UserType, Site, Contact } from "@shared/schema";

export default function AdminVacationStatus() {
  const { toast } = useToast();
  const [selectedSiteId, setSelectedSiteId] = useState<string>("all");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingVacation, setEditingVacation] = useState<VacationRequest | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addUserId, setAddUserId] = useState("");
  const [addStartDate, setAddStartDate] = useState("");
  const [addEndDate, setAddEndDate] = useState("");
  const [addReason, setAddReason] = useState("");
  const [addSubstituteWork, setAddSubstituteWork] = useState("X");

  const { data: vacations = [] } = useQuery<VacationRequest[]>({
    queryKey: ["/api/vacations"],
  });

  const { data: users = [] } = useQuery<UserType[]>({
    queryKey: ["/api/users"],
  });

  const { data: sites = [] } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  const { data: contacts = [] } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<VacationRequest> }) => {
      const res = await apiRequest("PATCH", `/api/vacations/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vacations"] });
      setEditDialogOpen(false);
      setEditingVacation(null);
      toast({ title: "수정 완료", description: "휴가가 수정되었습니다." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "수정 실패", description: error.message });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/vacations/${id}`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vacations"] });
      toast({ title: "삭제 완료", description: "휴가가 삭제되었습니다." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "삭제 실패", description: error.message });
    },
  });

  const addMutation = useMutation({
    mutationFn: async (data: { userId: string; startDate: string; endDate: string; reason: string; substituteWork: string }) => {
      const res = await apiRequest("POST", "/api/vacations", {
        ...data,
        vacationType: "annual",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vacations"] });
      setAddDialogOpen(false);
      setAddUserId("");
      setAddStartDate("");
      setAddEndDate("");
      setAddReason("");
      setAddSubstituteWork("X");
      toast({ title: "추가 완료", description: "휴가가 추가되었습니다." });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "추가 실패", description: error.message });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async ({ contactIds, siteId, year }: { contactIds: string[]; siteId?: string; year: number }) => {
      const res = await apiRequest("POST", "/api/send-vacation-status-email", {
        contactIds,
        siteId: siteId === "all" ? null : siteId,
        year,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setEmailDialogOpen(false);
      setSelectedContacts([]);
      toast({ title: "이메일 발송 완료", description: data.message });
    },
    onError: (error: Error) => {
      toast({ variant: "destructive", title: "이메일 발송 실패", description: error.message });
    },
  });

  const guards = users.filter(u => u.role === "guard" && u.isActive);
  const filteredGuards = selectedSiteId === "all" 
    ? guards 
    : guards.filter(u => u.siteId === selectedSiteId);

  const getSite = (siteId: string | null) => siteId ? sites.find(s => s.id === siteId) : null;

  const getUserStats = (user: UserType) => {
    const userVacations = vacations.filter(v => 
      v.userId === user.id && 
      new Date(v.startDate).getFullYear() === selectedYear
    );
    
    const approved = userVacations.filter(v => v.status === "approved");
    const pending = userVacations.filter(v => v.status === "pending");
    const rejected = userVacations.filter(v => v.status === "rejected");
    
    const usedDays = approved.reduce((sum, v) => sum + (v.days || 1), 0);
    const pendingDays = pending.reduce((sum, v) => sum + (v.days || 1), 0);
    
    let totalAccrued = 0;
    if (user.hireDate) {
      const balance = calculateAnnualLeave(new Date(user.hireDate), usedDays);
      totalAccrued = balance.totalAccrued;
    }
    
    return {
      totalAccrued,
      usedDays,
      pendingDays,
      remaining: Math.max(0, totalAccrued - usedDays),
      approved,
      pending,
      rejected,
    };
  };

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" />
            휴가 현황
          </h1>
          <p className="text-muted-foreground mt-1">
            현장별, 개인별 휴가 사용 현황을 확인하고 관리합니다.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setAddDialogOpen(true)} data-testid="button-add-vacation">
            <Plus className="h-4 w-4 mr-1" />
            휴가 추가
          </Button>
          <Button 
            variant="outline" 
            onClick={() => window.open(`/api/vacation-status-pdf?siteId=${selectedSiteId}&year=${selectedYear}`, "_blank")}
            data-testid="button-pdf-status"
          >
            <FileDown className="h-4 w-4 mr-1" />
            PDF 출력
          </Button>
          <Button variant="outline" onClick={() => setEmailDialogOpen(true)} data-testid="button-email-status">
            <Mail className="h-4 w-4 mr-1" />
            이메일 발송
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select value={selectedSiteId} onValueChange={setSelectedSiteId}>
          <SelectTrigger className="w-48" data-testid="select-site">
            <SelectValue placeholder="현장 선택" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체 현장</SelectItem>
            {sites.map((site) => (
              <SelectItem key={site.id} value={site.id}>{site.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
          <SelectTrigger className="w-32" data-testid="select-year">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map((year) => (
              <SelectItem key={year} value={String(year)}>{year}년</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          총 {filteredGuards.length}명
        </span>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>이름</TableHead>
                <TableHead>현장</TableHead>
                <TableHead>입사일</TableHead>
                <TableHead className="text-center">총 연차</TableHead>
                <TableHead className="text-center">사용</TableHead>
                <TableHead className="text-center">잔여</TableHead>
                <TableHead className="text-center">대기</TableHead>
                <TableHead>휴가 내역</TableHead>
                <TableHead className="text-right">관리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGuards.map((user) => {
                const stats = getUserStats(user);
                const site = getSite(user.siteId);
                
                return (
                  <TableRow key={user.id} data-testid={`user-row-${user.id}`}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell>{site?.name || "-"}</TableCell>
                    <TableCell>{user.hireDate ? format(new Date(user.hireDate), "yyyy.MM.dd") : "-"}</TableCell>
                    <TableCell className="text-center">{stats.totalAccrued}</TableCell>
                    <TableCell className="text-center text-orange-500">{stats.usedDays}</TableCell>
                    <TableCell className="text-center text-green-500">{stats.remaining}</TableCell>
                    <TableCell className="text-center text-blue-500">{stats.pendingDays}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {stats.approved.slice(0, 3).map((v) => (
                          <Badge key={v.id} variant="secondary" className="text-xs">
                            {format(new Date(v.startDate), "M/d")}~{format(new Date(v.endDate), "M/d")}
                          </Badge>
                        ))}
                        {stats.approved.length > 3 && (
                          <Badge variant="outline" className="text-xs">
                            +{stats.approved.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {stats.approved.length > 0 && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditingVacation(stats.approved[0]);
                              setEditDialogOpen(true);
                            }}
                            data-testid={`button-edit-${user.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>휴가 수정</DialogTitle>
          </DialogHeader>
          {editingVacation && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>시작일</Label>
                <Input
                  type="date"
                  value={editingVacation.startDate}
                  onChange={(e) => setEditingVacation({ ...editingVacation, startDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>종료일</Label>
                <Input
                  type="date"
                  value={editingVacation.endDate}
                  onChange={(e) => setEditingVacation({ ...editingVacation, endDate: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>일수</Label>
                <Input
                  type="number"
                  value={editingVacation.days || 1}
                  onChange={(e) => setEditingVacation({ ...editingVacation, days: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>대근 여부</Label>
                <Select 
                  value={editingVacation.substituteWork || "X"} 
                  onValueChange={(v) => setEditingVacation({ ...editingVacation, substituteWork: v })}
                >
                  <SelectTrigger data-testid="select-edit-substitute-work">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="X">X (대근 없음)</SelectItem>
                    <SelectItem value="O">O (대근 있음)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              onClick={() => editingVacation && deleteMutation.mutate(editingVacation.id)}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              삭제
            </Button>
            <Button
              onClick={() => editingVacation && updateMutation.mutate({
                id: editingVacation.id,
                data: {
                  startDate: editingVacation.startDate,
                  endDate: editingVacation.endDate,
                  days: editingVacation.days,
                  substituteWork: editingVacation.substituteWork,
                }
              })}
              disabled={updateMutation.isPending}
            >
              저장
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>휴가 추가</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>근무자</Label>
              <Select value={addUserId} onValueChange={setAddUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="근무자 선택" />
                </SelectTrigger>
                <SelectContent>
                  {guards.map((guard) => (
                    <SelectItem key={guard.id} value={guard.id}>
                      {guard.name} ({getSite(guard.siteId)?.name || "미배정"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>시작일</Label>
              <Input type="date" value={addStartDate} onChange={(e) => setAddStartDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>종료일</Label>
              <Input type="date" value={addEndDate} onChange={(e) => setAddEndDate(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>사유</Label>
              <Input value={addReason} onChange={(e) => setAddReason(e.target.value)} placeholder="사유 입력" />
            </div>
            <div className="space-y-2">
              <Label>대근 여부</Label>
              <Select value={addSubstituteWork} onValueChange={setAddSubstituteWork}>
                <SelectTrigger data-testid="select-add-substitute-work">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="X">X (대근 없음)</SelectItem>
                  <SelectItem value="O">O (대근 있음)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>취소</Button>
            <Button
              onClick={() => addMutation.mutate({
                userId: addUserId,
                startDate: addStartDate,
                endDate: addEndDate,
                reason: addReason,
                substituteWork: addSubstituteWork,
              })}
              disabled={addMutation.isPending || !addUserId || !addStartDate || !addEndDate}
            >
              추가
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>휴가 현황 이메일 발송</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              발송할 담당자를 선택해주세요.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {contacts.map((contact) => (
                <label key={contact.id} className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(contact.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedContacts([...selectedContacts, contact.id]);
                      } else {
                        setSelectedContacts(selectedContacts.filter(id => id !== contact.id));
                      }
                    }}
                  />
                  <span>{contact.name} ({contact.department}) - {contact.email}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>취소</Button>
            <Button
              onClick={() => emailMutation.mutate({
                contactIds: selectedContacts,
                siteId: selectedSiteId === "all" ? undefined : selectedSiteId,
                year: selectedYear,
              })}
              disabled={emailMutation.isPending || selectedContacts.length === 0}
            >
              {selectedContacts.length}명에게 발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
