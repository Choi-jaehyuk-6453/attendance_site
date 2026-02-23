import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail, Save } from "lucide-react";
import type { Site } from "@shared/schema";
import { EmailListEditor } from "@/components/ui/email-list-editor";

export default function SiteManagerManagers() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [emailInput, setEmailInput] = useState("");

    const { data: sites = [] } = useQuery<Site[]>({
        queryKey: ["/api/sites"],
    });

    // Find the current site
    const currentSite = sites.find(s => s.id === user?.siteId);

    useEffect(() => {
        if (currentSite?.managerEmail) {
            setEmailInput(currentSite.managerEmail);
        }
    }, [currentSite]);

    const updateMutation = useMutation({
        mutationFn: async ({ id, managerEmail }: { id: string; managerEmail: string }) => {
            const res = await apiRequest("PATCH", `/api/sites/${id}`, { managerEmail });
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
            toast({ title: "담당자 이메일이 저장되었습니다" });
        },
        onError: () => {
            toast({ variant: "destructive", title: "저장에 실패했습니다" });
        },
    });

    const handleSave = () => {
        if (currentSite) {
            updateMutation.mutate({ id: currentSite.id, managerEmail: emailInput });
        }
    };

    if (!currentSite) {
        return (
            <div className="p-6">
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        배정된 현장 정보를 불러올 수 없습니다.
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">담당자 관리</h1>
                <p className="text-muted-foreground">현장 담당자 정보를 관리합니다</p>
            </div>

            <Card className="max-w-2xl">
                <CardHeader>
                    <CardTitle>{currentSite.name} 담당자 설정</CardTitle>
                    <CardDescription>
                        휴가 신청서 등 주요 알림을 받을 이메일 주소를 입력해주세요.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-2">
                        <Label htmlFor="email">담당자 이메일</Label>
                        <div className="flex gap-2">
                            <div className="flex-1">
                                <EmailListEditor
                                    value={emailInput}
                                    onChange={setEmailInput}
                                    placeholder="이메일 추가..."
                                />
                            </div>
                            <Button onClick={handleSave} disabled={updateMutation.isPending}>
                                <Save className="mr-2 h-4 w-4" />
                                저장
                            </Button>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            * 입력하신 이메일로 근로자들의 휴가 현황 및 신청서가 발송될 수 있습니다.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
