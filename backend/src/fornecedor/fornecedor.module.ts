import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { FornecedorController } from './fornecedor.controller';
import { FornecedorService } from './fornecedor.service';

@Module({
  imports: [AuthModule],
  controllers: [FornecedorController],
  providers: [FornecedorService],
})
export class FornecedorModule {}
