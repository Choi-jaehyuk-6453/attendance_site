import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Mail, Save, Search } from "lucide-react";
import type { Site } from "@shared/schema";
import { useCompany } from "@/lib/company";
import { EmailListEditor } from "@/components/ui/email-list-editor";

export default function HqAdminManagers() {
    const { company } = useCompany();
    const { toast } = useToast();
    const [searchTerm, setSearchTerm] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [emailInput, setEmailInput] = useState("");

    const { data: sites = [], isLoading } = useQuery<Site[]>({
        queryKey: ["/api/sites", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/sites?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch sites");
            return res.json();
        },
    });

    const updateMutation = useMutation({
        mutationFn: async ({ id, managerEmail }: { id: string; managerEmail: string }) => {
            const res = await apiRequest("PATCH", `/api/sites/${id}`, { managerEmail });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
            setEditingId(null);
            setEmailInput("");
            toast({ title: "담당자 이메일이 저장되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "저장에 실패했습니다" });
        },
    });

    const filteredSites = sites.filter(site =>
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (site.managerEmail && site.managerEmail.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const startEditing = (site: Site) => {
        setEditingId(site.id);
        setEmailInput(site.managerEmail || "");
    };

    const saveEmail = (id: string) => {
        updateMutation.mutate({ id, managerEmail: emailInput });
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold">담당자 관리</h1>
                <p className="text-muted-foreground">현장별 담당자 이메일을 관리합니다</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>현장 목록</CardTitle>
                    <CardDescription>
                        총 {filteredSites.length}개의 현장이 있습니다 (검색 결과)
                    </CardDescription>
                    <div className="flex items-center gap-2 mt-2">
                        <Search className="h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="현장명 또는 이메일 검색..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-sm"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>현장명</TableHead>
                                <TableHead>주소</TableHead>
                                <TableHead>담당자 이메일</TableHead>
                                <TableHead className="w-[100px]">관리</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8">
                                        로딩 중...
                                    </TableCell>
                                </TableRow>
                            ) : filteredSites.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                                        검색 결과가 없습니다
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredSites.map((site) => (
                                    <TableRow key={site.id}>
                                        <TableCell className="font-medium">{site.name}</TableCell>
                                        <TableCell className="text-sm text-muted-foreground truncate max-w-[200px]">
                                            {site.address || "-"}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === site.id ? (
                                                <EmailListEditor
                                                    value={emailInput}
                                                    onChange={setEmailInput}
                                                    placeholder="이메일 추가..."
                                                />
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Mail className="h-4 w-4 text-muted-foreground" />
                                                    <span>{site.managerEmail || <span className="text-muted-foreground text-xs">미등록</span>}</span>
                                                </div>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            {editingId === site.id ? (
                                                <div className="flex gap-2">
                                                    <Button
                                                        size="sm"
                                                        onClick={() => saveEmail(site.id)}
                                                        disabled={updateMutation.isPending}
                                                    >
                                                        <Save className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => setEditingId(null)}
                                                    >
                                                        취소
                                                    </Button>
                                                </div>
                                            ) : (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    onClick={() => startEditing(site)}
                                                >
                                                    수정
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
