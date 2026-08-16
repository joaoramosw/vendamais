'use client'

import { publishHomeBlocks, updateHomeBlocksDraft } from '@/actions/theme'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input, Textarea } from '@/components/ui/input'
import { showToast } from '@/components/ui/toast'
import { HomeBlocksRenderer } from '@/components/home/HomeBlocksRenderer'
import { HOME_BLOCK_LABELS, type HomeBlock } from '@/lib/theme/home-blocks'
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ChevronDown, Eye, EyeOff, GripVertical, UploadCloud } from 'lucide-react'
import { useState, useTransition } from 'react'

function SortableBlockItem({
  block,
  expanded,
  onToggleExpand,
  onToggleVisible,
  onChange,
}: {
  block: HomeBlock
  expanded: boolean
  onToggleExpand: () => void
  onToggleVisible: () => void
  onChange: (patch: Partial<Pick<HomeBlock, 'titulo' | 'texto'>>) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 3 : 1,
    ...(isDragging
      ? { boxShadow: '0 10px 28px rgba(0, 0, 0, 0.28)', scale: '1.02' }
      : {}),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`rounded-[var(--radius-md)] border transition-colors ${
        isDragging
          ? 'border-primary-500/50 bg-primary-500/10'
          : block.visivel
            ? 'border-white/[0.08] bg-neutral-900'
            : 'border-white/[0.04] bg-neutral-900 opacity-60'
      }`}
    >
      <div className="flex items-center gap-3 px-3 py-2.5">
        <div
          {...attributes}
          {...listeners}
          // touch-action: none no handle — sem isso o toque inicia scroll da
          // página em vez do arrasto; o delay do TouchSensor cuida do long-press.
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 touch-none"
          style={{ touchAction: 'none' }}
        >
          <GripVertical className="h-4 w-4 text-neutral-400 pointer-events-none" />
        </div>
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex-1 flex items-center gap-2 text-left cursor-pointer"
        >
          <ChevronDown className={`h-3.5 w-3.5 text-neutral-500 transition-transform ${expanded ? 'rotate-180' : ''}`} />
          <span className={`text-sm font-medium ${block.visivel ? 'text-neutral-200' : 'text-neutral-500 line-through'}`}>
            {HOME_BLOCK_LABELS[block.tipo]}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleVisible}
          className={`p-1 rounded transition-colors cursor-pointer ${
            block.visivel
              ? 'text-primary-400 hover:text-primary-300 hover:bg-primary-500/10'
              : 'text-neutral-600 hover:text-neutral-400 hover:bg-white/5'
          }`}
          title={block.visivel ? 'Ocultar bloco' : 'Mostrar bloco'}
        >
          {block.visivel ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </button>
      </div>

      {expanded && (
        <div className="px-3 pb-3 space-y-2 border-t border-white/[0.06] pt-3">
          <Input
            label="Título"
            value={block.titulo}
            onChange={(e) => onChange({ titulo: e.target.value })}
          />
          <Textarea
            label="Texto"
            value={block.texto}
            onChange={(e) => onChange({ texto: e.target.value })}
            rows={2}
          />
        </div>
      )}
    </div>
  )
}

export function HomeTab({ initialDraft }: { initialDraft: HomeBlock[] }) {
  const [blocks, setBlocks] = useState<HomeBlock[]>(initialDraft)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [showPublishConfirm, setShowPublishConfirm] = useState(false)
  const [isSaving, startSaveTransition] = useTransition()
  const [isPublishing, startPublishTransition] = useTransition()

  const orderedIds = [...blocks].sort((a, b) => a.ordem - b.ordem).map((b) => b.id)

  const sensors = useSensors(
    // Mouse: arrasto imediato (distância mínima pra não brigar com clique).
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    // Touch: long-press de ~200ms antes de iniciar o arrasto, para não
    // conflitar com o scroll da página no celular.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    setBlocks((prev) => {
      const sorted = [...prev].sort((a, b) => a.ordem - b.ordem)
      const oldIndex = sorted.findIndex((b) => b.id === active.id)
      const newIndex = sorted.findIndex((b) => b.id === over.id)
      const reordered = arrayMove(sorted, oldIndex, newIndex)
      return reordered.map((block, index) => ({ ...block, ordem: index }))
    })
  }

  const updateBlock = (id: string, patch: Partial<Pick<HomeBlock, 'titulo' | 'texto'>>) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)))
  }

  const toggleVisible = (id: string) => {
    setBlocks((prev) => prev.map((b) => (b.id === id ? { ...b, visivel: !b.visivel } : b)))
  }

  const handleSaveDraft = () => {
    startSaveTransition(async () => {
      const result = await updateHomeBlocksDraft(blocks)
      if (result.error) {
        showToast(result.error, 'error')
        return
      }
      showToast('Rascunho salvo.', 'success')
    })
  }

  const handlePublish = () => {
    setShowPublishConfirm(false)
    startPublishTransition(async () => {
      const result = await publishHomeBlocks()
      if (result.error) {
        showToast(result.error, 'error')
        return
      }
      showToast('Página inicial publicada.', 'success')
    })
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <p className="text-xs text-neutral-400">
          Arraste para reordenar, clique num bloco para editar título/texto. Alterações aqui só valem depois de &quot;Salvar rascunho&quot; e ficam públicas só depois de &quot;Publicar&quot;.
        </p>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={orderedIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {orderedIds.map((id) => {
                const block = blocks.find((b) => b.id === id)
                if (!block) return null
                return (
                  <SortableBlockItem
                    key={id}
                    block={block}
                    expanded={expandedId === id}
                    onToggleExpand={() => setExpandedId((prev) => (prev === id ? null : id))}
                    onToggleVisible={() => toggleVisible(id)}
                    onChange={(patch) => updateBlock(id, patch)}
                  />
                )
              })}
            </div>
          </SortableContext>
        </DndContext>

        <div className="flex gap-2 pt-2">
          <Button variant="secondary" onClick={handleSaveDraft} loading={isSaving} className="flex-1">
            Salvar rascunho
          </Button>
          <Button onClick={() => setShowPublishConfirm(true)} loading={isPublishing} className="flex-1">
            <UploadCloud className="h-4 w-4" />
            Publicar
          </Button>
        </div>
      </div>

      {/* Preview do rascunho */}
      <div className="lg:sticky lg:top-6 self-start">
        <p className="text-xs text-neutral-400 mb-2">Pré-visualização do rascunho:</p>
        <div className="rounded-[var(--radius-lg)] border border-white/[0.06] overflow-hidden" style={{ height: 480 }}>
          <div className="origin-top-left" style={{ transform: 'scale(0.4)', width: '250%' }}>
            <HomeBlocksRenderer blocks={blocks} />
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={showPublishConfirm}
        onClose={() => setShowPublishConfirm(false)}
        onConfirm={handlePublish}
        title="Publicar página inicial?"
        description="Isso substitui a versão pública da home pelo rascunho atual imediatamente."
        confirmLabel="Publicar"
        variant="info"
        loading={isPublishing}
      />
    </div>
  )
}
