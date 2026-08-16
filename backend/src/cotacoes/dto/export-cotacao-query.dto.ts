import { Transform } from 'class-transformer';
import { IsBoolean, IsIn, IsOptional } from 'class-validator';

export class ExportCotacaoQueryDto {
  @IsIn(['xlsx', 'pdf'])
  formato!: 'xlsx' | 'pdf';

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  incluir_internos?: boolean = true;
}
