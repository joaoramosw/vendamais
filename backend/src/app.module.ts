import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from './supabase/supabase.module';
import { AuthModule } from './auth/auth.module';
import { CotacoesModule } from './cotacoes/cotacoes.module';
import { PropostasModule } from './propostas/propostas.module';
import { FornecedorModule } from './fornecedor/fornecedor.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    SupabaseModule,
    AuthModule,
    CotacoesModule,
    PropostasModule,
    FornecedorModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
