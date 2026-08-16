import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateCotacaoItemDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantidade_sugerida?: number;

  @IsOptional()
  @IsNumber()
  @Min(0.01)
  preco_unitario_manual?: number;

  // Flag separada porque @IsOptional() do class-validator trata null e
  // undefined da mesma forma — não dá pra distinguir "não mexer" de "limpar"
  // usando só preco_unitario_manual.
  @IsOptional()
  @IsBoolean()
  resetar_preco_manual?: boolean;
}
