import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { QrCode, Download, Building2, RefreshCw } from "lucide-react";
import QRCode from "qrcode";
import { useState, useEffect } from "react";
import type { Site } from "@shared/schema";

function SiteQRCard({ site }: { site: Site }) {
    const { toast } = useToast();
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

    const generateMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", `/api/sites/${site.id}/qr`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
            toast({ title: `${site.name} QR 코드가 생성되었습니다` });
        },
    });

    useEffect(() => {
        if (site.qrCode) {
            QRCode.toDataURL(site.qrCode, { width: 200, margin: 2 })
                .then(setQrDataUrl)
                .catch(console.error);
        }
    }, [site.qrCode]);

    const handleDownload = () => {
        if (!qrDataUrl) return;
        const link = document.createElement("a");
        link.download = `${site.name}_QR.png`;
        link.href = qrDataUrl;
        link.click();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Building2 className="h-5 w-5 text-primary" />
                    {site.name}
                </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                {site.qrCode && qrDataUrl ? (
                    <>
                        <img src={qrDataUrl} alt={`${site.name} QR`} className="w-48 h-48 rounded-lg" />
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" onClick={handleDownload}>
                                <Download className="h-4 w-4 mr-1" />
                                다운로드
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => generateMutation.mutate()}>
                                <RefreshCw className="h-4 w-4 mr-1" />
                                재생성
                            </Button>
                        </div>
                    </>
                ) : (
                    <>
                        <div className="w-48 h-48 rounded-lg bg-muted flex items-center justify-center">
                            <QrCode className="h-16 w-16 text-muted-foreground" />
                        </div>
                        <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending}>
                            <QrCode className="h-4 w-4 mr-2" />
                            QR코드 생성
                        </Button>
                    </>
                )}
            </CardContent>
        </Card>
    );
}

import { useCompany } from "@/lib/company";

export default function HqAdminQRManagement() {
    const { company } = useCompany();
    const { data: sites = [], isLoading } = useQuery<Site[]>({
        queryKey: ["/api/sites", company.id],
        queryFn: async () => {
            const res = await fetch(`/api/sites?company=${company.id}`);
            if (!res.ok) throw new Error("Failed to fetch sites");
            return res.json();
        }
    });

    if (isLoading) {
        return (
            <div className="p-6 space-y-4">
                <Skeleton className="h-8 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6">
            <div>
                <h1 className="text-2xl font-bold">QR 관리</h1>
                <p className="text-muted-foreground">현장별 출근 QR 코드를 생성하고 관리합니다</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {sites.filter(s => s.isActive).map(site => (
                    <SiteQRCard key={site.id} site={site} />
                ))}
            </div>
            {sites.filter(s => s.isActive).length === 0 && (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                        <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">등록된 현장이 없습니다. 먼저 현장을 등록해주세요.</p>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
