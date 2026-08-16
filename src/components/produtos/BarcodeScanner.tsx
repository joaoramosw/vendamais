"use client";

import { Button } from "@/components/ui/button";
import { Camera, Flashlight, FlashlightOff, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

interface BarcodeScannerProps {
  onDetected: (barcode: string) => void;
  onClose: () => void;
}

type ScannerStatus = "starting" | "scanning" | "error";

function getCameraErrorMessage(err: unknown): string {
  if (err instanceof DOMException) {
    switch (err.name) {
      case "NotAllowedError":
        return "Permissão de câmera negada. Ative o acesso à câmera nas configurações do navegador.";
      case "NotFoundError":
      case "OverconstrainedError":
        return "Nenhuma câmera foi encontrada neste dispositivo.";
      case "NotReadableError":
        return "A câmera está sendo usada por outro aplicativo. Feche-o e tente novamente.";
      case "NotSupportedError":
        return "Seu navegador não suporta acesso à câmera. Digite o código manualmente.";
      default:
        break;
    }
  }
  return "Não foi possível acessar a câmera. Verifique as permissões do navegador.";
}

export function BarcodeScanner({ onDetected, onClose }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const detectedRef = useRef(false);
  const cooldownRef = useRef(0);
  const onDetectedRef = useRef(onDetected);
  const [status, setStatus] = useState<ScannerStatus>("starting");
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [manualCode, setManualCode] = useState("");

  onDetectedRef.current = onDetected;

  const stopScanner = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setTorchOn(false);
    setTorchSupported(false);
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks?.()[0];
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next }],
      } as unknown as MediaTrackConstraints);
      setTorchOn(next);
    } catch {
      // Lanterna não suportada pela câmera — ignora silenciosamente.
    }
  }, [torchOn]);

  const startScanner = useCallback(async () => {
    setError(null);
    setStatus("starting");
    detectedRef.current = false;
    cooldownRef.current = 0;

    const video = videoRef.current;
    if (!video) return;

    // Em contexto inseguro (ex.: HTTP via IP da rede) não existe câmera.
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError(
        "Este contexto não permite acesso à câmera. Acesse via HTTPS (ex.: ngrok) ou digite o código manualmente abaixo."
      );
      setStatus("error");
      return;
    }

    let stream: MediaStream;
    try {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch {
        // Câmera traseira indisponível — usa qualquer câmera disponível.
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
    } catch (err) {
      setError(getCameraErrorMessage(err));
      setStatus("error");
      return;
    }

    streamRef.current = stream;

    const videoTrack = stream.getVideoTracks()[0];
    try {
      const caps = videoTrack?.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorchSupported(Boolean(caps?.torch));
    } catch {
      setTorchSupported(false);
    }

    if (!videoRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      return;
    }

    try {
      video.srcObject = stream;
      await video.play();

      // Aguarda o stream ficar utilizável antes de iniciar o decode —
      // evita frames vazios e o NotSupportedError do decodeFromConstraints.
      const ready = await new Promise<boolean>((resolve) => {
        const startedAt = Date.now();
        const timer = window.setInterval(() => {
          if (video.videoWidth > 0 || video.readyState >= 2) {
            window.clearInterval(timer);
            resolve(true);
          } else if (Date.now() - startedAt > 5000) {
            window.clearInterval(timer);
            resolve(false);
          }
        }, 150);
      });

      if (!ready) {
        throw new DOMException("Vídeo não ficou pronto", "AbortError");
      }
    } catch (videoError) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      setError(getCameraErrorMessage(videoError));
      setStatus("error");
      return;
    }

    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();

      const handleResult = (result?: { getText(): string } | null) => {
        if (!result) return;
        const text = result.getText();
        if (!text || detectedRef.current) return;
        const now = Date.now();
        if (now < cooldownRef.current) return;
        detectedRef.current = true;
        cooldownRef.current = now + 700;
        onDetectedRef.current(text);
        stopScanner();
      };

      controlsRef.current = await reader.decodeFromVideoElement(video, (result) =>
        handleResult(result)
      );
      setStatus("scanning");
    } catch {
      setError("Não foi possível iniciar a leitura do código de barras. Digite o código manualmente.");
      setStatus("error");
    }
  }, [stopScanner]);

  useEffect(() => {
    startScanner();
    return () => {
      controlsRef.current?.stop();
      controlsRef.current = null;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, [startScanner]);

  const submitManual = useCallback(() => {
    const code = manualCode.trim();
    if (!code) return;
    onDetectedRef.current(code);
  }, [manualCode]);

  return (
    <div className="relative rounded-[var(--radius-lg)] overflow-hidden bg-neutral-900">
      <div className="relative aspect-video">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          playsInline
          muted
        />
        {/* Scan overlay */}
        {status === "scanning" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-64 h-40 border-2 border-primary-400 rounded-[var(--radius-lg)] relative">
              <div className="absolute inset-0 bg-primary-500/5" />
              {/* Scanning line animation */}
              <div className="absolute left-2 right-2 h-0.5 bg-primary-500 animate-scan" />
              {/* Corner decorations */}
              <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-primary-500 rounded-tl" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-primary-500 rounded-tr" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-primary-500 rounded-bl" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-primary-500 rounded-br" />
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/80">
            <div className="text-center px-6 space-y-3">
              <Camera className="h-10 w-10 text-neutral-400 mx-auto" />
              <p className="text-sm text-neutral-300">{error}</p>
              <Button variant="secondary" size="sm" onClick={startScanner}>
                Tentar novamente
              </Button>
            </div>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between px-4 py-3 bg-neutral-800">
        <p className="text-xs text-neutral-400">
          {status === "scanning"
            ? "Posicione o código de barras na área de leitura"
            : status === "starting"
              ? "Iniciando câmera..."
              : "Câmera indisponível"}
        </p>
        <div className="flex items-center gap-2">
          {status === "scanning" && torchSupported && (
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleTorch}
              className="text-neutral-400 hover:text-white"
              title={torchOn ? "Desligar lanterna" : "Ligar lanterna"}
            >
              {torchOn ? (
                <FlashlightOff className="h-4 w-4" />
              ) : (
                <Flashlight className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="text-neutral-400 hover:text-white"
          >
            <X className="h-4 w-4" />
            Fechar
          </Button>
        </div>
      </div>
      {/* Fallback: entrada manual — funciona sem câmera */}
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-800/60 border-t border-neutral-700/60">
        <input
          type="text"
          inputMode="numeric"
          value={manualCode}
          onChange={(e) => setManualCode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitManual();
          }}
          placeholder="Digite o código manualmente"
          className="flex-1 h-9 rounded-md bg-neutral-900 px-3 text-sm text-neutral-200 placeholder:text-neutral-500 outline-none focus:ring-2 focus:ring-primary-500/50"
        />
        <Button variant="secondary" size="sm" onClick={submitManual}>
          Usar código
        </Button>
      </div>
    </div>
  );
}

/* ─── USB Barcode Reader Hook ─── */

export interface UseUSBBarcodeReaderOptions {
  /** Tecla que o leitor envia ao final da leitura. Default: "enter". */
  suffix?: "enter" | "tab" | "none";
  /** Tamanho mínimo do buffer para considerar uma leitura válida. Default: 4. */
  minLength?: number;
  /** Janela (ms) sem novas teclas para considerar a leitura encerrada. Default: 100. */
  timeoutMs?: number;
}

export function useUSBBarcodeReader(
  onDetected: (barcode: string) => void,
  options: UseUSBBarcodeReaderOptions = {}
) {
  const { suffix = "enter", minLength = 4, timeoutMs = 100 } = options;
  const bufferRef = useRef("");
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const terminatorKey = suffix === "enter" ? "Enter" : suffix === "tab" ? "Tab" : null;

    const flush = () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (bufferRef.current.length >= minLength) {
        onDetected(bufferRef.current);
      }
      bufferRef.current = "";
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focused on an input/textarea (let user type normally)
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        return;
      }

      if (terminatorKey && e.key === terminatorKey) {
        flush();
        return;
      }

      // Only accept single characters for the buffer
      if (e.key.length === 1) {
        bufferRef.current += e.key;

        // Reset after `timeoutMs` of no input (USB readers send chars rapidly)
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          // Sem sufixo configurado, o fim da leitura só é detectável pelo
          // timeout (rajada de caracteres); com sufixo, o timeout é só limpeza.
          if (suffix === "none") {
            flush();
          } else {
            bufferRef.current = "";
          }
        }, timeoutMs);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [onDetected, suffix, minLength, timeoutMs]);
}
