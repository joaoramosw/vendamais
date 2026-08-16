"use client";

import { useCallback, useEffect, useState } from "react";

export interface FeatureDef {
  id: string;
  label: string;
  description?: string;
}

/** Funcionalidades da tela de produtos que podem ser ligadas/desligadas. */
export const PRODUCT_FEATURES: FeatureDef[] = [
  {
    id: "busca",
    label: "Buscar",
    description: "Campo de busca por nome ou código de barras.",
  },
  {
    id: "escanear",
    label: "Escanear produto",
    description: "Leitura de código de barras pela câmera.",
  },
  {
    id: "filtros",
    label: "Filtros",
    description: "Painel de filtros por categoria, data e faixa de preço.",
  },
  {
    id: "selecaoMultipla",
    label: "Seleção múltipla",
    description: "Ctrl + clique, e Ctrl + arrastar sobre as linhas para selecionar várias.",
  },
  {
    id: "configuracoes",
    label: "Configurações",
    description: "Este próprio botão. Com ele oculto, use Shift + C para reabrir esta janela.",
  },
];

const STORAGE_KEY = "vendamais:produtos:funcionalidades";

export type FeatureState = Record<string, boolean>;

function defaults(): FeatureState {
  return Object.fromEntries(PRODUCT_FEATURES.map((f) => [f.id, true]));
}

function load(): FeatureState {
  const base = defaults();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const salvo = JSON.parse(raw) as FeatureState;
    // Só ids conhecidos entram — funcionalidade nova no código nasce ligada.
    for (const f of PRODUCT_FEATURES) {
      if (typeof salvo[f.id] === "boolean") base[f.id] = salvo[f.id];
    }
    return base;
  } catch {
    return base;
  }
}

/**
 * Estado das funcionalidades da tela de produtos.
 *
 * `mounted` existe porque a preferência mora no localStorage: no servidor tudo
 * é considerado ligado, e quem consome deve usar `mounted` pra não renderizar
 * uma coisa no HTML e outra na hidratação.
 */
export function useProductFeatures() {
  const [features, setFeatures] = useState<FeatureState>(defaults);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setFeatures(load());
    setMounted(true);
  }, []);

  const save = useCallback((next: FeatureState) => {
    setFeatures(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // Sem localStorage a escolha vale só para esta sessão.
    }
  }, []);

  const isEnabled = useCallback(
    (id: string) => (mounted ? features[id] !== false : true),
    [features, mounted],
  );

  return { features, isEnabled, setFeatures: save, mounted };
}
