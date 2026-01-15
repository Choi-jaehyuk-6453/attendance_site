import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Button } from "@/components/ui/button";
import { X, Camera } from "lucide-react";

interface QRScannerProps {
  onScan: (data: string) => void;
  onClose: () => void;
}

export function QRScanner({ onScan, onClose }: QRScannerProps) {
  const [error, setError] = useState<string>("");
  const [isScanning, setIsScanning] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const startScanner = async () => {
      try {
        setIsScanning(true);
        setError("");

        const scanner = new Html5Qrcode("qr-reader");
        scannerRef.current = scanner;

        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            onScan(decodedText);
            stopScanner();
          },
          () => {}
        );
      } catch (err) {
        setError("카메라에 접근할 수 없습니다. 카메라 권한을 확인해주세요.");
        setIsScanning(false);
      }
    };

    const stopScanner = async () => {
      if (scannerRef.current) {
        try {
          await scannerRef.current.stop();
          scannerRef.current.clear();
        } catch {
          // ignore cleanup errors
        }
        scannerRef.current = null;
      }
      setIsScanning(false);
    };

    startScanner();

    return () => {
      stopScanner();
    };
  }, [onScan]);

  const handleClose = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        // ignore cleanup errors
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black" ref={containerRef}>
      <div className="relative w-full h-full flex flex-col">
        <div className="absolute top-4 left-4 z-10">
          <Button
            variant="secondary"
            size="icon"
            onClick={handleClose}
            className="bg-black/50 hover:bg-black/70 text-white border-0"
            data-testid="button-close-scanner"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        <div className="flex-1 flex items-center justify-center">
          {error ? (
            <div className="text-center p-8">
              <Camera className="h-16 w-16 text-white/50 mx-auto mb-4" />
              <p className="text-white text-lg mb-4">{error}</p>
              <Button variant="secondary" onClick={handleClose}>
                닫기
              </Button>
            </div>
          ) : (
            <div
              id="qr-reader"
              className="w-full max-w-md aspect-square"
              style={{ 
                border: "none",
                background: "transparent"
              }}
            />
          )}
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
          <div className="text-center text-white">
            <p className="text-lg font-medium mb-2">QR 코드 스캔</p>
            <p className="text-sm text-white/70">
              현장에 배치된 QR 코드를 카메라로 스캔해주세요
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
