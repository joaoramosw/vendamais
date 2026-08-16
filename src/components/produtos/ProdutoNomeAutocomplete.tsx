"use client";

import { useEffect, useRef, useState } from "react";
import { buscarProdutosPorNome } from "@/actions/cotacoes";
import { Input } from "@/components/ui/input";
import { Loader2, Package } from "lucide-react";

interface ProdutoSugestao {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  barcode: string | null;
  image_url: string | null;
}

interface ProdutoNomeAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  onSelectProduto: (produto: ProdutoSugestao) => void;
}

/**
 * Busca incremental de produtos já cadastrados enquanto o usuário digita o
 * nome — complementa a busca exata por código de barras já existente.
 */
export function ProdutoNomeAutocomplete({
  value,
  onChange,
  onSelectProduto,
}: ProdutoNomeAutocompleteProps) {
  const [sugestoes, setSugestoes] = useState<ProdutoSugestao[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.trim().length < 2) {
      setSugestoes([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const results = await buscarProdutosPorNome(value);
        setSugestoes(results);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [value]);

  return (
    <div className="relative">
      <Input
        label="Nome do Produto *"
        placeholder="Nome do item"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {loading && (
        <Loader2 className="absolute right-3 top-9 h-4 w-4 animate-spin text-neutral-500" />
      )}
      {open && sugestoes.length > 0 && (
        <div className="absolute z-20 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-neutral-900 shadow-xl">
          {sugestoes.map((produto) => (
            <button
              key={produto.id}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                onSelectProduto(produto);
                setOpen(false);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-200 hover:bg-white/[0.06] transition-colors"
            >
              <Package className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
              <span className="truncate">{produto.name}</span>
              {produto.category && (
                <span className="ml-auto text-[10px] text-neutral-500 shrink-0">{produto.category}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
