import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Building2, QrCode } from "lucide-react";
import type { Site } from "@shared/schema";

export default function QRManagementPage() {
  const [, setLocation] = useLocation();

  const { data: sites = [], isLoading } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-80" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">QR 코드 관리</h1>
          <p className="text-muted-foreground">
            각 현장별 QR 코드를 생성하고 다운로드할 수 있습니다
          </p>
        </div>
        <Button onClick={() => setLocation("/admin/sites")} data-testid="button-manage-sites">
          <Building2 className="h-4 w-4 mr-2" />
          현장 관리
        </Button>
      </div>

      {sites.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <QrCode className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg">등록된 현장이 없습니다</p>
          <p className="text-sm">현장을 먼저 등록해주세요</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sites
            .filter((s) => s.isActive)
            .map((site) => (
              <QRCodeCard key={site.id} site={site} />
            ))}
        </div>
      )}
    </div>
  );
}

function QRCodeCard({ site }: { site: Site }) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(true);

  useEffect(() => {
    const generateQR = async () => {
      try {
        const QRCode = (await import("qrcode")).default;
        const qrData = JSON.stringify({
          siteId: site.id,
          siteName: site.name,
          type: "attendance",
        });
        const url = await QRCode.toDataURL(qrData, {
          width: 256,
          margin: 2,
          color: { dark: "#1e40af", light: "#ffffff" },
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error("QR generation error:", err);
      }
      setIsGenerating(false);
    };
    generateQR();
  }, [site.id, site.name]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.download = `QR_${site.name}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  const companyName = site.company === "mirae_abm" ? "미래에이비엠" : "다원피엠씨";

  return (
    <div className="rounded-lg border bg-card overflow-hidden" data-testid={`card-qr-${site.id}`}>
      <div className="p-4 border-b bg-muted/30">
        <div className="flex items-center gap-2">
          <QrCode className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-semibold">{site.name}</h3>
            <p className="text-xs text-muted-foreground">{companyName}</p>
          </div>
        </div>
        {site.address && (
          <p className="text-sm text-muted-foreground mt-2">{site.address}</p>
        )}
      </div>
      <div className="p-4 space-y-4">
        <div className="flex justify-center p-4 bg-white rounded-lg">
          {isGenerating ? (
            <Skeleton className="w-48 h-48" />
          ) : qrDataUrl ? (
            <img src={qrDataUrl} alt={`${site.name} QR`} className="w-48 h-48" />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-muted-foreground">
              생성 실패
            </div>
          )}
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={handleDownload}
          disabled={!qrDataUrl}
          data-testid={`button-download-qr-${site.id}`}
        >
          <Building2 className="h-4 w-4 mr-2" />
          QR 코드 다운로드
        </Button>
      </div>
    </div>
  );
}
