'use client'

import { setThemeLogoFromUrl, uploadThemeLogo } from '@/actions/theme'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { showToast } from '@/components/ui/toast'
import { compressImage, isAcceptedImageFile, isValidImageUrl } from '@/lib/image-utils'
import { Loader2, Upload, X } from 'lucide-react'
import Image from 'next/image'
import { useRef, useState, useTransition } from 'react'

export function LogoUploader({
  logoUrl,
  onChange,
}: {
  logoUrl: string | null
  onChange: (url: string | null) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [urlInput, setUrlInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const [preview, setPreview] = useState<string | null>(logoUrl)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!isAcceptedImageFile(file)) {
      showToast(`Tipo não suportado: ${file.type || 'desconhecido'}. Use JPG, PNG, WebP ou SVG.`, 'warning')
      return
    }

    const previewUrl = URL.createObjectURL(file)
    setPreview(previewUrl)

    startTransition(async () => {
      try {
        const isSvg = file.type === 'image/svg+xml'
        const uploadFile = isSvg ? file : new File([await compressImage(file, 512, 0.9)], 'logo.webp', { type: 'image/webp' })

        const formData = new FormData()
        formData.set('file', uploadFile)

        const result = await uploadThemeLogo(formData)
        URL.revokeObjectURL(previewUrl)

        if (result.error) {
          showToast(result.error, 'error')
          setPreview(logoUrl)
        } else if (result.url) {
          setPreview(result.url)
          onChange(result.url)
          showToast('Logo atualizado.', 'success')
        }
      } catch {
        URL.revokeObjectURL(previewUrl)
        setPreview(logoUrl)
        showToast('Erro ao processar imagem.', 'error')
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = ''
      }
    })
  }

  const handleUrlSubmit = () => {
    const url = urlInput.trim()
    if (!url) return
    if (!isValidImageUrl(url)) {
      showToast('URL inválida. Use https://...', 'warning')
      return
    }

    setPreview(url)
    startTransition(async () => {
      const result = await setThemeLogoFromUrl(url)
      if (result.error) {
        showToast(result.error, 'error')
        setPreview(logoUrl)
      } else if (result.url) {
        setPreview(result.url)
        onChange(result.url)
        setUrlInput('')
        showToast('Logo atualizado.', 'success')
      }
    })
  }

  const handleRemove = () => {
    setPreview(null)
    onChange(null)
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-neutral-300">Logo</label>

      <div className="flex items-center gap-4">
        <div className="h-16 w-16 rounded-[var(--radius-md)] border border-white/10 bg-neutral-900 flex items-center justify-center overflow-hidden shrink-0">
          {preview ? (
            <Image src={preview} alt="Logo" width={64} height={64} className="object-contain h-full w-full" unoptimized />
          ) : (
            <span className="text-[10px] text-neutral-500 text-center px-1">Sem logo</span>
          )}
        </div>

        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
              id="logo-file-input"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              Enviar arquivo
            </Button>
            {preview && (
              <Button type="button" variant="ghost" size="sm" onClick={handleRemove} disabled={isPending}>
                <X className="h-4 w-4" />
                Remover
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="ou cole uma URL de imagem…"
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={isPending}
              className="flex-1"
            />
            <Button type="button" variant="secondary" size="sm" onClick={handleUrlSubmit} disabled={isPending || !urlInput.trim()}>
              Usar URL
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
