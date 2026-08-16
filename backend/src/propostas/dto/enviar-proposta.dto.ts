import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateNested,
} from 'class-validator';

export class PropostaItemDto {
  @IsUUID()
  cotacao_item_id!: string;

  @IsNumber()
  @Min(0)
  preco_unitario!: number;

  @IsOptional()
  @IsString()
  observacao?: string;

  /** false = fornecedor marcou explicitamente que não tem o item (preço
   * é gravado como 0 independente do que vier aqui). Default true. */
  @IsOptional()
  @IsBoolean()
  disponivel?: boolean;
}

export class EnviarPropostaDto {
  @IsString()
  @IsNotEmpty()
  token_acesso!: string;

  @IsOptional()
  @IsString()
  prazo_entrega?: string;

  /** "Observações gerais" — vale pra proposta inteira (≠ observação por item).
   * Só é persistida depois da migration 023; antes disso o backend ignora o
   * campo em vez de recusar o envio. */
  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  nome_empresa?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PropostaItemDto)
  itens!: PropostaItemDto[];
}
