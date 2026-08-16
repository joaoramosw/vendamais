"use client";

import { useEffect, useState } from "react";
import { getSegmentos, type SegmentoWithCount } from "@/actions/fornecedor-segmentos";

export function useSegmentos() {
  const [segmentos, setSegmentos] = useState<SegmentoWithCount[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getSegmentos()
      .then((res) => setSegmentos(res.segmentos))
      .finally(() => setLoading(false));
  }, []);

  return { segmentos, loading };
}
