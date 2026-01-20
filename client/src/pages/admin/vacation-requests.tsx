import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  CalendarCheck,
  Check,
  X,
  FileDown,
  Mail,
  Clock,
  User,
  MapPin,
} from "lucide-react";
import type { VacationRequest, User as UserType, Site, Contact } from "@shared/schema";

export default function AdminVacationRequests() {
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedVacation, setSelectedVacation] = useState<VacationRequest | null>(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);

  const { data: vacations = [], isLoading } = useQuery<VacationRequest[]>({
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

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/vacations/${id}/approve`, {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vacations"] });
      toast({
        title: "승인 완료",
        description: "휴가 신청이 승인되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "승인 실패",
        description: error.message,
      });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ id, rejectionReason }: { id: string; rejectionReason: string }) => {
      const res = await apiRequest("PATCH", `/api/vacations/${id}/reject`, { rejectionReason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vacations"] });
      setRejectDialogOpen(false);
      setSelectedVacation(null);
      setRejectionReason("");
      toast({
        title: "반려 완료",
        description: "휴가 신청이 반려되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "반려 실패",
        description: error.message,
      });
    },
  });

  const emailMutation = useMutation({
    mutationFn: async ({ vacationId, contactIds }: { vacationId: string; contactIds: string[] }) => {
      const res = await apiRequest("POST", "/api/send-vacation-email", { vacationId, contactIds });
      return res.json();
    },
    onSuccess: (data) => {
      setEmailDialogOpen(false);
      setSelectedVacation(null);
      setSelectedContacts([]);
      toast({
        title: "이메일 발송 완료",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "이메일 발송 실패",
        description: error.message,
      });
    },
  });

  const handleReject = (vacation: VacationRequest) => {
    setSelectedVacation(vacation);
    setRejectDialogOpen(true);
  };

  const handleSendEmail = (vacation: VacationRequest) => {
    setSelectedVacation(vacation);
    setEmailDialogOpen(true);
  };

  const getUser = (userId: string) => users.find(u => u.id === userId);
  const getSite = (siteId: string | null) => siteId ? sites.find(s => s.id === siteId) : null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge variant="secondary">대기중</Badge>;
      case "approved":
        return <Badge className="bg-green-500 hover:bg-green-600">승인</Badge>;
      case "rejected":
        return <Badge variant="destructive">반려</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getTypeName = (type: string | null) => {
    switch (type) {
      case "annual": return "연차";
      case "half_day": return "반차";
      case "sick": return "병가";
      case "family_event": return "경조사";
      case "other": return "기타";
      default: return type || "연차";
    }
  };

  const filteredVacations = vacations.filter(v => 
    statusFilter === "all" || v.status === statusFilter
  ).sort((a, b) => new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime());

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <CalendarCheck className="h-6 w-6 text-primary" />
            휴가 신청 현황
          </h1>
          <p className="text-muted-foreground mt-1">
            경비원들의 휴가 신청을 확인하고 승인/반려할 수 있습니다.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40" data-testid="select-status-filter">
            <SelectValue placeholder="상태 필터" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">전체</SelectItem>
            <SelectItem value="pending">대기중</SelectItem>
            <SelectItem value="approved">승인</SelectItem>
            <SelectItem value="rejected">반려</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          총 {filteredVacations.length}건
        </span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filteredVacations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            휴가 신청 내역이 없습니다.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredVacations.map((vacation) => {
            const user = getUser(vacation.userId);
            const site = user ? getSite(user.siteId) : null;
            
            return (
              <Card key={vacation.id} data-testid={`vacation-card-${vacation.id}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {user?.name || "알 수 없음"}
                      <span className="text-sm font-normal text-muted-foreground">
                        ({getTypeName(vacation.vacationType)})
                      </span>
                    </CardTitle>
                    {getStatusBadge(vacation.status)}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{site?.name || "미배정"}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>
                        {format(new Date(vacation.startDate), "M.d", { locale: ko })} ~{" "}
                        {format(new Date(vacation.endDate), "M.d", { locale: ko })}
                        <span className="ml-1">({vacation.days}일)</span>
                      </span>
                    </div>
                  </div>
                  
                  {vacation.reason && (
                    <p className="text-sm text-muted-foreground">
                      사유: {vacation.reason}
                    </p>
                  )}
                  
                  <p className="text-sm text-muted-foreground">
                    대근: {vacation.substituteWork || "X"}
                  </p>
                  
                  {vacation.status === "rejected" && vacation.rejectionReason && (
                    <p className="text-sm text-destructive">
                      반려 사유: {vacation.rejectionReason}
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground">
                    신청일: {format(new Date(vacation.requestedAt), "yyyy.M.d HH:mm", { locale: ko })}
                  </p>
                  
                  <div className="flex items-center gap-2 pt-2">
                    {vacation.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => approveMutation.mutate(vacation.id)}
                          disabled={approveMutation.isPending}
                          data-testid={`button-approve-${vacation.id}`}
                        >
                          <Check className="h-4 w-4 mr-1" />
                          승인
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleReject(vacation)}
                          data-testid={`button-reject-${vacation.id}`}
                        >
                          <X className="h-4 w-4 mr-1" />
                          반려
                        </Button>
                      </>
                    )}
                    {vacation.status === "approved" && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => window.open(`/api/vacation-pdf/${vacation.id}`, "_blank")}
                          data-testid={`button-pdf-${vacation.id}`}
                        >
                          <FileDown className="h-4 w-4 mr-1" />
                          PDF
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSendEmail(vacation)}
                          data-testid={`button-email-${vacation.id}`}
                        >
                          <Mail className="h-4 w-4 mr-1" />
                          이메일
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>휴가 반려</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Textarea
              placeholder="반려 사유를 입력해주세요"
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              data-testid="input-rejection-reason"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              취소
            </Button>
            <Button
              variant="destructive"
              onClick={() => selectedVacation && rejectMutation.mutate({
                id: selectedVacation.id,
                rejectionReason
              })}
              disabled={rejectMutation.isPending}
              data-testid="button-confirm-reject"
            >
              반려
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>휴가신청서 이메일 발송</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p className="text-sm text-muted-foreground">
              발송할 담당자를 선택해주세요.
            </p>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {contacts.map((contact) => (
                <label
                  key={contact.id}
                  className="flex items-center gap-2 p-2 rounded border cursor-pointer hover:bg-muted"
                >
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
                    data-testid={`checkbox-contact-${contact.id}`}
                  />
                  <span>{contact.name} ({contact.department}) - {contact.email}</span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>
              취소
            </Button>
            <Button
              onClick={() => selectedVacation && emailMutation.mutate({
                vacationId: selectedVacation.id,
                contactIds: selectedContacts
              })}
              disabled={emailMutation.isPending || selectedContacts.length === 0}
              data-testid="button-send-email"
            >
              {selectedContacts.length}명에게 발송
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
