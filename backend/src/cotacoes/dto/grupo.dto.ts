import { ArrayNotEmpty, IsArray, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/** Criação e renomeação compartilham a mesma forma (só o nome muda). */
export class GrupoNomeDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(1, { message: 'Dê um nome ao grupo.' })
  @MaxLength(60, { message: 'O nome do grupo deve ter no máximo 60 caracteres.' })
  nome!: string;
}

/**
 * Move um lote de cotações para um grupo. `grupo_id: null` (ou ausente) tira
 * as cotações de qualquer grupo — é a ação "Remover do grupo" da UI, e não
 * um payload inválido.
 */
export class AtribuirGrupoDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  cotacao_ids!: string[];

  // IsOptional ignora undefined *e* null, que é exatamente a semântica de
  // "tirar do grupo" aqui.
  @IsOptional()
  @IsUUID('4')
  grupo_id?: string | null;
}
