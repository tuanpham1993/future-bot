import { OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { filter } from 'lodash';
import { Bnc } from '../util/bnc-client';

export class PositionStorage implements OnApplicationBootstrap {
  public positions: any[];

  async onApplicationBootstrap() {
    this.watch();
  }

  @Cron(CronExpression.EVERY_10_SECONDS)
  async watch() {
    const positions = await Bnc.client.futuresPositionRisk();

    this.positions = filter(positions, ({ positionAmt }) => +positionAmt !== 0);
  }
}
