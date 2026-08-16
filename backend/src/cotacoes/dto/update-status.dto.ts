import { IsIn } from 'class-validator';
import { CotacaoStatus } from '../cotacoes.types';

// 'aberta' entra como alvo por causa do par Pausar/Retomar da tela de
// gerenciamento (ver ALLOWED_TRANSITIONS em cotacoes.service.ts): a transição
// válida a partir daqui é 'fechada' -> 'aberta'; publicar rascunho continua
// tendo rota própria (POST /cotacoes/:id/publicar).
const TARGET_STATUSES: CotacaoStatus[] = ['aberta', 'fechada', 'cancelada'];

export class UpdateStatusDto {
  @IsIn(TARGET_STATUSES)
  status!: CotacaoStatus;
}
