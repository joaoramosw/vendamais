import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { EmpresarioAuthGuard } from '../auth/empresario-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import type { EmpresarioUser } from '../auth/empresario-auth.guard';
import { CotacoesService } from './cotacoes.service';
import { CotacoesExportService } from './cotacoes-export.service';
import { CreateCotacaoDto } from './dto/create-cotacao.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { UpdateCotacaoItemDto } from './dto/update-item.dto';
import { ExportCotacaoQueryDto } from './dto/export-cotacao-query.dto';
import { ConvidarFornecedorDto } from './dto/convidar-fornecedor.dto';
import { ConvidarUsuariosDto } from './dto/convidar-usuarios.dto';
import { AtribuirGrupoDto, GrupoNomeDto } from './dto/grupo.dto';

@Controller('cotacoes')
@UseGuards(EmpresarioAuthGuard)
export class CotacoesController {
  constructor(
    private readonly cotacoesService: CotacoesService,
    private readonly cotacoesExportService: CotacoesExportService,
  ) {}

  @Post()
  criar(@CurrentUser() user: EmpresarioUser, @Body() dto: CreateCotacaoDto) {
    return this.cotacoesService.criarCotacao(user.id, dto);
  }

  @Post('enviar')
  criarEPublicar(@CurrentUser() user: EmpresarioUser, @Body() dto: CreateCotacaoDto) {
    return this.cotacoesService.criarEPublicarCotacao(user.id, dto);
  }

  // Precisa vir antes de ':id' — senão o Nest casa 'fornecedores' como o
  // param :id da rota de detalhe.
  @Get('fornecedores')
  buscarFornecedores(
    @Query('busca') busca?: string,
    @Query('segmento_id') segmentoId?: string,
  ) {
    return this.cotacoesService.buscarFornecedores(busca, segmentoId);
  }

  /* ─── Grupos de cotação ───
   * Declarados antes de qualquer rota com ':id' — o Nest casa por ordem, e
   * 'grupos' seria engolido como o :id da rota de detalhe. Pelo mesmo
   * motivo, 'grupos/atribuir' vem antes de 'grupos/:id'. */

  @Get('grupos')
  listarGrupos(@CurrentUser() user: EmpresarioUser) {
    return this.cotacoesService.listarGrupos(user.id);
  }

  @Post('grupos')
  criarGrupo(@CurrentUser() user: EmpresarioUser, @Body() dto: GrupoNomeDto) {
    return this.cotacoesService.criarGrupo(user.id, dto.nome);
  }

  @Patch('grupos/atribuir')
  atribuirGrupo(@CurrentUser() user: EmpresarioUser, @Body() dto: AtribuirGrupoDto) {
    return this.cotacoesService.atribuirGrupo(user.id, dto.cotacao_ids, dto.grupo_id ?? null);
  }

  @Patch('grupos/:grupoId')
  renomearGrupo(
    @CurrentUser() user: EmpresarioUser,
    @Param('grupoId') grupoId: string,
    @Body() dto: GrupoNomeDto,
  ) {
    return this.cotacoesService.renomearGrupo(user.id, grupoId, dto.nome);
  }

  @Delete('grupos/:grupoId')
  async excluirGrupo(@CurrentUser() user: EmpresarioUser, @Param('grupoId') grupoId: string) {
    await this.cotacoesService.excluirGrupo(user.id, grupoId);
    return { success: true };
  }

  @Post(':id/publicar')
  publicar(@CurrentUser() user: EmpresarioUser, @Param('id') id: string) {
    return this.cotacoesService.publicarCotacao(user.id, id);
  }

  @Get()
  listar(@CurrentUser() user: EmpresarioUser) {
    return this.cotacoesService.listar(user.id);
  }

  @Get(':id')
  detalhe(@CurrentUser() user: EmpresarioUser, @Param('id') id: string) {
    return this.cotacoesService.detalhe(user.id, id);
  }

  @Patch(':id/status')
  atualizarStatus(
    @CurrentUser() user: EmpresarioUser,
    @Param('id') id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.cotacoesService.atualizarStatus(user.id, id, dto.status);
  }

  @Delete(':id')
  async deletar(@CurrentUser() user: EmpresarioUser, @Param('id') id: string) {
    await this.cotacoesService.deletarCotacao(user.id, id);
    return { success: true };
  }

  @Get(':id/export')
  async exportar(
    @CurrentUser() user: EmpresarioUser,
    @Param('id') id: string,
    @Query() query: ExportCotacaoQueryDto,
    @Res({ passthrough: false }) reply: FastifyReply,
  ) {
    const { buffer, filename, mimeType } = await this.cotacoesExportService.exportar(
      user.id,
      id,
      query,
    );

    reply
      .header('Content-Type', mimeType)
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  }

  @Patch(':cotacaoId/itens/:itemId')
  atualizarItem(
    @CurrentUser() user: EmpresarioUser,
    @Param('cotacaoId') cotacaoId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateCotacaoItemDto,
  ) {
    return this.cotacoesService.atualizarItem(user.id, cotacaoId, itemId, dto);
  }

  @Post(':id/convites')
  convidarFornecedor(
    @CurrentUser() user: EmpresarioUser,
    @Param('id') id: string,
    @Body() dto: ConvidarFornecedorDto,
  ) {
    return this.cotacoesService.convidarFornecedor(user.id, id, {
      emailContato: dto.email_contato,
      whatsapp: dto.whatsapp,
      nomeEmpresa: dto.nome_empresa,
    });
  }

  @Get(':id/convites')
  listarConvites(@CurrentUser() user: EmpresarioUser, @Param('id') id: string) {
    return this.cotacoesService.listarConvites(user.id, id);
  }

  @Post(':id/convites/usuarios')
  convidarPorUsuarios(
    @CurrentUser() user: EmpresarioUser,
    @Param('id') id: string,
    @Body() dto: ConvidarUsuariosDto,
  ) {
    return this.cotacoesService.convidarPorUsuarios(user.id, id, dto.user_ids);
  }
}
