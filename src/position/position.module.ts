import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StorageModule } from 'src/storage/storage.module';
import { Position } from './position';
import { PositionService } from './position.service';

@Module({
  imports: [TypeOrmModule.forFeature([Position]), StorageModule],
  providers: [PositionService],
  exports: [PositionService],
})
export class PositionModule {}
