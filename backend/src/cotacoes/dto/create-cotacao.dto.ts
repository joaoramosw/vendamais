import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class CreateCotacaoItemDto {
  @IsString()
  @IsNotEmpty()
  nome_produto!: string;

  @IsString()
  @IsNotEmpty()
  unidade!: string;

  @IsNumber()
  @IsPositive()
  quantidade!: number;

  @IsOptional()
  @IsString()
  observacao?: string;

  @IsOptional()
  @IsString()
  codigo_barras?: string;

  @IsOptional()
  @IsString()
  categoria?: string;

  @IsOptional()
  @IsUUID()
  product_id?: string;

  @IsOptional()
  @IsString()
  descricao?: string;

  @IsOptional()
  @IsNumber()
  estoque_atual?: number;

  @IsOptional()
  @IsNumber()
  quantidade_sugerida?: number;

  @IsString()
  @IsNotEmpty()
  tipo_unidade!: string;
}

export class CreateCotacaoDto {
  @IsString()
  @IsNotEmpty()
  titulo!: string;

  @IsOptional()
  @IsString()
  data_limite?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateCotacaoItemDto)
  itens!: CreateCotacaoItemDto[];
}
