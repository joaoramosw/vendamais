import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { AuthenticatedGuard } from '../auth/authenticated.guard';
import { CurrentAuthenticatedUser } from '../auth/current-authenticated-user.decorator';
import type { AuthenticatedUser } from '../auth/authenticated.guard';
import { FornecedorService } from './fornecedor.service';

@Controller('fornecedor')
@UseGuards(AuthenticatedGuard)
export class FornecedorController {
  constructor(private readonly fornecedorService: FornecedorService) {}

  @Get('convites')
  listarMeusConvites(@CurrentAuthenticatedUser() user: AuthenticatedUser) {
    return this.fornecedorService.listarMeusConvites(user.email, user.whatsapp);
  }

  @Get('propostas')
  listarMinhasPropostas(@CurrentAuthenticatedUser() user: AuthenticatedUser) {
    return this.fornecedorService.listarMinhasPropostas(user.email, user.whatsapp);
  }

  @Get('propostas/:id')
  detalharMinhaProposta(
    @CurrentAuthenticatedUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ) {
    return this.fornecedorService.detalharMinhaProposta(user.email, id, user.whatsapp);
  }
}
