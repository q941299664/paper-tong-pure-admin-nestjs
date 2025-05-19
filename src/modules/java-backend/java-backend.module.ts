import { HttpModule } from '@nestjs/axios'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'

import { JavaBackendService } from '@/modules/java-backend/java-backend.service'

import { JavaBackendController } from './java-backend.controller'

@Module({
  imports: [HttpModule, ConfigModule],
  controllers: [JavaBackendController],
  providers: [JavaBackendService],
  exports: [JavaBackendService],
})
export class JavaBackendModule {}
