import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Users, Mail, Building, Trash2, Pencil } from "lucide-react";
import type { Contact } from "@shared/schema";

const contactSchema = z.object({
  department: z.string().min(1, "부서를 입력해주세요"),
  name: z.string().min(1, "성명을 입력해주세요"),
  email: z.string().email("올바른 이메일 주소를 입력해주세요"),
  company: z.enum(["mirae_abm", "dawon_pmc"]),
});

type ContactForm = z.infer<typeof contactSchema>;

export default function ContactsPage() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["/api/contacts"],
  });

  const form = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      department: "",
      name: "",
      email: "",
      company: "mirae_abm",
    },
  });

  const editForm = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      department: "",
      name: "",
      email: "",
      company: "mirae_abm",
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: ContactForm) => {
      const res = await apiRequest("POST", "/api/contacts", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "담당자 등록 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setDialogOpen(false);
      form.reset();
      toast({
        title: "담당자 등록 완료",
        description: "새 담당자가 등록되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "등록 실패",
        description: error.message,
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: ContactForm) => {
      if (!selectedContact) return;
      const res = await apiRequest("PATCH", `/api/contacts/${selectedContact.id}`, data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "담당자 수정 실패");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      setEditDialogOpen(false);
      setSelectedContact(null);
      toast({
        title: "수정 완료",
        description: "담당자 정보가 수정되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "수정 실패",
        description: error.message,
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/contacts/${id}`);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "담당자 삭제 실패");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/contacts"] });
      toast({
        title: "삭제 완료",
        description: "담당자가 삭제되었습니다.",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "삭제 실패",
        description: error.message,
      });
    },
  });

  const handleEdit = (contact: Contact) => {
    setSelectedContact(contact);
    editForm.reset({
      department: contact.department,
      name: contact.name,
      email: contact.email,
      company: contact.company,
    });
    setEditDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("정말 이 담당자를 삭제하시겠습니까?")) {
      deleteMutation.mutate(id);
    }
  };

  const miraeContacts = contacts.filter((c) => c.company === "mirae_abm");
  const dawonContacts = contacts.filter((c) => c.company === "dawon_pmc");

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold" data-testid="text-page-title">담당자 관리</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-add-contact">
              <Plus className="h-4 w-4 mr-2" />
              담당자 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>새 담당자 등록</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-4">
                <FormField
                  control={form.control}
                  name="company"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>소속 법인</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-company">
                            <SelectValue placeholder="법인 선택" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="mirae_abm">미래에이비엠</SelectItem>
                          <SelectItem value="dawon_pmc">다원피엠씨</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>부서</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="예: 인사팀"
                          data-testid="input-department"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>성명</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="담당자 성명"
                          data-testid="input-name"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>이메일</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="example@company.com"
                          data-testid="input-email"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setDialogOpen(false)}
                  >
                    취소
                  </Button>
                  <Button
                    type="submit"
                    disabled={createMutation.isPending}
                    data-testid="button-submit-contact"
                  >
                    {createMutation.isPending ? "등록 중..." : "등록"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ContactList
          title="미래에이비엠 담당자"
          contacts={miraeContacts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <ContactList
          title="다원피엠씨 담당자"
          contacts={dawonContacts}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
      </div>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>담당자 정보 수정</DialogTitle>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((data) => updateMutation.mutate(data))} className="space-y-4">
              <FormField
                control={editForm.control}
                name="company"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>소속 법인</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-edit-company">
                          <SelectValue placeholder="법인 선택" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="mirae_abm">미래에이비엠</SelectItem>
                        <SelectItem value="dawon_pmc">다원피엠씨</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="department"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>부서</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="예: 인사팀"
                        data-testid="input-edit-department"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>성명</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="담당자 성명"
                        data-testid="input-edit-name"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>이메일</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="example@company.com"
                        data-testid="input-edit-email"
                        {...field}
                      />
                    </FormControl>
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
                  disabled={updateMutation.isPending}
                  data-testid="button-update-contact"
                >
                  {updateMutation.isPending ? "수정 중..." : "수정"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactList({
  title,
  contacts,
  onEdit,
  onDelete,
}: {
  title: string;
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Users className="h-5 w-5" />
          {title}
          <span className="text-sm font-normal text-muted-foreground ml-auto">
            {contacts.length}명
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {contacts.length === 0 ? (
          <p className="text-center py-8 text-muted-foreground">
            등록된 담당자가 없습니다
          </p>
        ) : (
          contacts.map((contact) => (
            <div
              key={contact.id}
              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
              data-testid={`card-contact-${contact.id}`}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{contact.name}</span>
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Building className="h-3 w-3" />
                    {contact.department}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="h-3 w-3" />
                  {contact.email}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(contact)}
                  data-testid={`button-edit-contact-${contact.id}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(contact.id)}
                  data-testid={`button-delete-contact-${contact.id}`}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
