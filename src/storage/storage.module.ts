import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PositionStorage } from './positions';
import { PriceStorage } from './prices';

@Module({
  imports: [ConfigModule],
  providers: [PriceStorage, PositionStorage],
  exports: [PriceStorage, PositionStorage],
})
export class StorageModule {}
