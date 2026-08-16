import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { EmpresarioAuthGuard } from '../auth/empresario-auth.guard';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { CurrentAuthenticatedUser } from '../auth/current-authenticated-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated.guard';
import type { EmpresarioUser } from '../auth/empresario-auth.guard';
import { PropostasService } from './propostas.service';
import { EnviarPropostaDto } from './dto/enviar-proposta.dto';
import { GerenciarPropostaDto } from './dto/gerenciar-proposta.dto';

@Controller()
export class PropostasController {
  constructor(private readonly propostasService: PropostasService) {}

  /**
   * Público — pré-visualização do convite para quem abre o link **sem estar
   * logado** (o gate de acesso mostra o título da cotação antes de pedir
   * login/cadastro). `:identificador` é o token do convite ou o id de uma
   * proposta já enviada.
   *
   * ⚠️ Esta rota precisa vir **antes** de `convite/:identificador/acesso`? Não:
   * caminhos com número de segmentos diferente não competem. Mas qualquer
   * rota nova de um segmento só sob `convite/` (ex.: `convite/buscar`) teria
   * que vir antes desta, senão seria engolida como identificador.
   */
  @Get('convite/:identificador')
  getConvite(@Param('identificador') identificador: string) {
    return this.propostasService.getConvite(identificador);
  }

  /**
   * Acesso com sessão (Cenário A/B do fluxo por link): garante que a conta
   * logada faz parte da cotação — vinculando-a se necessário — e devolve o
   * convite dela, já com o token que o envio da proposta deve usar.
   */
  @Post('convite/:identificador/acesso')
  @UseGuards(AuthenticatedGuard)
  acessar(
    @CurrentAuthenticatedUser() user: AuthenticatedUser,
    @Param('identificador') identificador: string,
  ) {
    return this.propostasService.acessarComoUsuario(identificador, {
      email: user.email,
      whatsapp: user.whatsapp,
      nomeEmpresa: user.nomeEmpresa,
    });
  }

  // Public — identified by token_acesso in the body, not a JWT.
  @Post('propostas')
  enviar(@Body() dto: EnviarPropostaDto) {
    return this.propostasService.enviarProposta(dto);
  }

  @Get('cotacoes/:cotacaoId/propostas')
  @UseGuards(EmpresarioAuthGuard)
  listarPorCotacao(@CurrentUser() user: EmpresarioUser, @Param('cotacaoId') cotacaoId: string) {
    return this.propostasService.listarPorCotacao(user.id, cotacaoId);
  }

  @Get('cotacoes/:cotacaoId/resultado')
  @UseGuards(EmpresarioAuthGuard)
  resultadoPorItem(@CurrentUser() user: EmpresarioUser, @Param('cotacaoId') cotacaoId: string) {
    return this.propostasService.resultadoPorItem(user.id, cotacaoId);
  }

  @Get('propostas/:id')
  @UseGuards(EmpresarioAuthGuard)
  detalhe(@CurrentUser() user: EmpresarioUser, @Param('id') id: string) {
    return this.propostasService.getPropostaComItens(user.id, id);
  }

  @Patch('propostas/:id')
  @UseGuards(EmpresarioAuthGuard)
  gerenciar(
    @CurrentUser() user: EmpresarioUser,
    @Param('id') id: string,
    @Body() dto: GerenciarPropostaDto,
  ) {
    return this.propostasService.gerenciarProposta(user.id, id, dto.status);
  }
}
