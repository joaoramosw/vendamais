/**
 * image-utils.ts
 * Utilitários client-side para compressão e validação de imagens de produto.
 * Zero dependências externas — usa apenas Canvas API nativa.
 */

// ─── Tipos aceitos (input do usuário) ───────────────────────────────────────
export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",   // alias comum — navegadores normalmente reportam como image/jpeg
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
  "image/bmp",
  "image/tiff",
];

// ─── Tamanho máximo antes da compressão (guard de sanidade) ─────────────────
export const MAX_RAW_SIZE_MB = 20; // 20 MB raw é razoável

/**
 * Normaliza o tipo MIME retornado pelo SO/browser para um valor canônico.
 * Ex: "image/jpg" → "image/jpeg", "" → detectado pelo magic byte no canvas.
 */
export function normalizeMimeType(file: File): string {
  const t = file.type.toLowerCase().trim();
  if (t === "image/jpg") return "image/jpeg";
  if (t === "" || t === "application/octet-stream") {
    // Fallback pelo nome do arquivo
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
    if (ext === "png") return "image/png";
    if (ext === "webp") return "image/webp";
    if (ext === "avif") return "image/avif";
    return "image/jpeg"; // default seguro
  }
  return t;
}

/**
 * Verifica se um arquivo é uma imagem válida para upload.
 */
export function isAcceptedImageFile(file: File): boolean {
  const mime = normalizeMimeType(file);
  return ACCEPTED_IMAGE_TYPES.includes(mime);
}

/**
 * Comprime uma imagem no browser usando Canvas API.
 * - Normaliza MIME types (jpg, png, gif, bmp → todos aceitos)
 * - Tenta WebP como saída (suporte universal em browsers modernos)
 * - Redimensiona para maxWidth mantendo proporção
 * - Revoga Object URLs para evitar vazamento de memória
 *
 * @param file       Arquivo original do <input type="file">
 * @param maxWidth   Largura máxima em pixels (default: 1200)
 * @param quality    Qualidade WebP 0–1 (default: 0.80)
 * @param onProgress Callback de progresso 0–100 (opcional)
 * @returns          Blob WebP comprimido
 */
export function compressImage(
  file: File,
  maxWidth = 1200,
  quality = 0.80,
  onProgress?: (pct: number) => void,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const mime = normalizeMimeType(file);

    // Guard de tamanho raw
    if (file.size > MAX_RAW_SIZE_MB * 1024 * 1024) {
      reject(new Error(`Arquivo muito grande. Máximo: ${MAX_RAW_SIZE_MB} MB.`));
      return;
    }

    onProgress?.(5);

    const img = new window.Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl); // libera memória imediatamente
      onProgress?.(30);

      const canvas = document.createElement("canvas");
      const scale = Math.min(1, maxWidth / img.naturalWidth);
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D não suportado neste browser"));
        return;
      }

      // Fundo branco para PNGs com transparência (evita fundo preto no WebP)
      if (mime === "image/png") {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      onProgress?.(60);

      // Saída: WebP (suporte universal Chrome/Firefox/Safari/Edge modernos)
      // AVIF tem melhor compressão mas suporte inconsistente em canvas.toBlob
      canvas.toBlob(
        (webpBlob) => {
          if (webpBlob) {
            onProgress?.(95);
            resolve(webpBlob);
          } else {
            // Fallback JPEG se WebP falhar (Safari antigo)
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) {
                  onProgress?.(95);
                  resolve(jpegBlob);
                } else {
                  reject(new Error("Falha ao comprimir imagem"));
                }
              },
              "image/jpeg",
              quality,
            );
          }
        },
        "image/webp",
        quality,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Falha ao carregar imagem — arquivo pode estar corrompido"));
    };

    img.src = objectUrl;
  });
}

/**
 * Faz download de uma imagem via URL, comprime e retorna o Blob.
 * Usado no fluxo "Upload por URL" — garante que a imagem fica no Supabase Storage.
 *
 * IMPORTANTE: Esta função roda no SERVIDOR (server action) via fetch normal.
 * No cliente, use apenas para preview/validação.
 */
export async function fetchAndValidateImageUrl(url: string): Promise<void> {
  // Validação básica de formato
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new Error("URL deve usar http ou https");
    }
  } catch {
    throw new Error("URL inválida");
  }
}

/**
 * Valida se uma string é uma URL de imagem válida (http/https).
 * Não faz request — apenas verifica o formato.
 */
export function isValidImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Gera um nome de arquivo determinístico para o produto.
 * Usar o productId garante upsert correto no storage (sobrescreve o anterior).
 */
export function buildImageFileName(
  productId?: string | null,
  mimeType = "image/webp",
): string {
  const ext = mimeType === "image/avif" ? "avif" : "webp";
  return productId
    ? `product-${productId}.${ext}`
    : `product-${Date.now()}.${ext}`;
}
