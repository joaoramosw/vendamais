import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ConvidarUsuariosDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  user_ids!: string[];
}
