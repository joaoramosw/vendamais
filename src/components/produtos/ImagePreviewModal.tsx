"use client";

import { ImageOff, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Modal } from "../ui/modal";

interface ImagePreviewModalProps {
  open: boolean;
  onClose: () => void;
  imageUrl: string | null;
  productName: string;
}

export function ImagePreviewModal({
  open,
  onClose,
  imageUrl,
  productName,
}: ImagePreviewModalProps) {
  const [imageError, setImageError] = useState(false);

  // Reseta o estado de erro sempre que a imagem/abertura mudar — senão um
  // erro de uma foto anterior "vaza" pro placeholder da próxima.
  useEffect(() => {
    setImageError(false);
  }, [imageUrl, open]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-2xl p-0 overflow-hidden dark:bg-neutral-900"
    >
      <div className="relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="relative w-full aspect-square bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center">
          {imageError || !imageUrl ? (
            <div className="flex flex-col items-center gap-2 text-neutral-500">
              <ImageOff className="h-10 w-10" />
              <p className="text-sm">Sem foto cadastrada</p>
            </div>
          ) : (
            <Image
              src={imageUrl}
              alt={productName}
              fill
              className="object-contain"
              sizes="(max-width: 672px) 100vw, 672px"
              onError={() => setImageError(true)}
            />
          )}
        </div>
        <div className="px-6 py-4 bg-white dark:bg-neutral-800 border-t border-neutral-100 dark:border-neutral-700">
          <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 truncate">
            {productName}
          </p>
        </div>
      </div>
    </Modal>
  );
}
