import { IsEmail, IsOptional, IsString } from 'class-validator';

/** email_contato e whatsapp são ambos opcionais no DTO — o service exige
 * que pelo menos um dos dois esteja presente (mensagem de erro mais clara
 * do que uma regra de validação cruzada aqui). */
export class ConvidarFornecedorDto {
  @IsOptional()
  @IsEmail()
  email_contato?: string;

  @IsOptional()
  @IsString()
  whatsapp?: string;

  @IsOptional()
  @IsString()
  nome_empresa?: string;
}
