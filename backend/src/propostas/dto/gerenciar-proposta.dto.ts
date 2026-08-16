import { IsIn } from 'class-validator';

export class GerenciarPropostaDto {
  @IsIn(['aceita', 'recusada'])
  status!: 'aceita' | 'recusada';
}
