import { Module } from '@nestjs/common';
import { EmpresarioAuthGuard } from './empresario-auth.guard';
import { AuthenticatedGuard } from './authenticated.guard';
import { FornecedorTokenService } from './fornecedor-token.service';

@Module({
  providers: [EmpresarioAuthGuard, AuthenticatedGuard, FornecedorTokenService],
  exports: [EmpresarioAuthGuard, AuthenticatedGuard, FornecedorTokenService],
})
export class AuthModule {}
