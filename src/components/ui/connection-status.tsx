"use client";

import { useOfflineSync } from "@/lib/hooks/useOfflineSync";
import { CheckCircle2, RefreshCcw, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function ConnectionStatus() {
  const { isOnline, syncPending, queueLength } = useOfflineSync();
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Escuta o evento de sync finalizado para mostrar o check por alguns segundos
    const handleSyncComplete = () => {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 4000);
    };

    window.addEventListener('sync_completed', handleSyncComplete);
    return () => window.removeEventListener('sync_completed', handleSyncComplete);
  }, []);

  // Estado Oculto (Tudo verde, mas sem nada na fila). Evita poluir a UI para quem tá 100% liso.
  if (isOnline && !syncPending && queueLength === 0 && !showSuccess) {
    return null; 
  }

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex items-center justify-center animate-in slide-in-from-bottom-5 fade-in duration-300">
      <div 
        className={`
          flex items-center gap-2.5 px-4 py-2 rounded-full border shadow-lg backdrop-blur-md text-sm font-medium transition-all
          ${!isOnline 
              ? "bg-warning-500/10 border-warning-500/30 text-warning-500" // Offline
              : syncPending 
                  ? "bg-info-500/10 border-info-500/30 text-info-400" // Sincronizando
                  : showSuccess 
                      ? "bg-success-500/10 border-success-500/30 text-success-400" // Sucesso
                      : "bg-neutral-800 border-neutral-700 text-neutral-300" // Default/Fallback
          }
        `}
      >
        {!isOnline && (
          <>
            <WifiOff className="h-4 w-4 animate-pulse" />
            <span>Modo Offline ({queueLength} pendente{queueLength !== 1 && 's'})</span>
          </>
        )}
        
        {isOnline && syncPending && (
          <>
            <RefreshCcw className="h-4 w-4 animate-spin" />
            <span>Sincronizando {queueLength} cotação(ões)...</span>
          </>
        )}

        {isOnline && !syncPending && showSuccess && (
          <>
            <CheckCircle2 className="h-4 w-4" />
            <span>Sincronização concluída!</span>
          </>
        )}
      </div>
    </div>
  );
}
