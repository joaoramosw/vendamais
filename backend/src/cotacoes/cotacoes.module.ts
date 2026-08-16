import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PropostasModule } from '../propostas/propostas.module';
import { CotacoesController } from './cotacoes.controller';
import { CotacoesService } from './cotacoes.service';
import { CotacoesExportService } from './cotacoes-export.service';

@Module({
  imports: [AuthModule, PropostasModule],
  controllers: [CotacoesController],
  providers: [CotacoesService, CotacoesExportService],
  exports: [CotacoesService],
})
export class CotacoesModule {}
