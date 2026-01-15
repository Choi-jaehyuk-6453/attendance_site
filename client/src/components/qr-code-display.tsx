import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, QrCode } from "lucide-react";
import QRCode from "qrcode";
import type { Site } from "@shared/schema";

interface QRCodeDisplayProps {
  site: Site;
}

export function QRCodeDisplay({ site }: QRCodeDisplayProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  useEffect(() => {
    const generateQR = async () => {
      try {
        const qrData = JSON.stringify({
          siteId: site.id,
          siteName: site.name,
          type: "attendance",
        });
        const url = await QRCode.toDataURL(qrData, {
          width: 256,
          margin: 2,
          color: {
            dark: "#1e40af",
            light: "#ffffff",
          },
        });
        setQrDataUrl(url);
      } catch (err) {
        console.error("QR generation error:", err);
      }
    };
    generateQR();
  }, [site]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.download = `QR_${site.name}.png`;
    link.href = qrDataUrl;
    link.click();
  };

  return (
    <Card className="overflow-hidden" data-testid={`card-qr-${site.id}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <QrCode className="h-5 w-5" />
          {site.name}
        </CardTitle>
        {site.address && (
          <p className="text-sm text-muted-foreground">{site.address}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-center p-4 bg-white rounded-lg">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`${site.name} QR 코드`}
              className="w-48 h-48"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center bg-muted rounded">
              <span className="text-muted-foreground">생성 중...</span>
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
          <Download className="h-4 w-4 mr-2" />
          QR 코드 다운로드
        </Button>
      </CardContent>
    </Card>
  );
}
