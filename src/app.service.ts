import {
  Injectable,
  OnApplicationBootstrap,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import binanceApiNode from 'binance-api-node';
import { differenceBy, filter, isEmpty, sortBy } from 'lodash';
import { Position } from './position/position';
import { PositionService } from './position/position.service';
import { PositionStatus } from './position/status';
import { OrderKind } from './position/type/order-kind';
import { PositionStorage } from './storage/positions';
import { PriceStorage } from './storage/prices';
import { Bnc } from './util/bnc-client';
import { CommonUtil } from './util/common';
import { Const } from './util/const';

@Injectable()
export class AppService implements OnModuleInit, OnApplicationBootstrap {
  async onModuleInit() {
    var types = require('pg').types;
    types.setTypeParser(1700, function (val) {
      return +val;
    });

    Bnc.client = binanceApiNode({
      apiKey: process.env.BNC_FUTURE_API_KEY,
      apiSecret: process.env.BNC_FUTURE_SECRET,
    });
  }

  async onApplicationBootstrap() {
    const positions = await this.positionService.findAll();
    for (const position of positions) {
      position.nextDcaPrice = position.calcNextDcaPrice();
      this.positionService.update(position);
    }
  }

  constructor(
    private priceStorage: PriceStorage,
    private positionStorage: PositionStorage,
    private configService: ConfigService,
    private positionService: PositionService,
  ) {}

  private maxLongPositions = +this.configService.get('MAX_LONG');
  private budget = +this.configService.get('BUDGET');
  private priceChangePercentToLong = +this.configService.get(
    'PRICE_CHANGE_PERCENT_TO_LONG',
  );

  // Create new position
  @Cron(CronExpression.EVERY_MINUTE)
  public async createMany() {
    const currentPositions = await this.positionService.findAll();
    let numOfRiskyLongPos = filter(
      currentPositions,
      ({ status, side }) =>
        side === 'LONG' &&
        // @ts-ignore
        [PositionStatus.ENTRY, PositionStatus.DCA].includes(status),
    ).length;

    let priceChanges = await Bnc.getAllTickers();

    const availLongPos = sortBy(
      filter(
        priceChanges,
        (pc) =>
          !currentPositions.some((p) => p.symbol === pc.symbol) &&
          !this.positionStorage.positions.some((p) => p.symbol === pc.symbol) &&
          !/BTCDOMUSDT/.test(pc.symbol) &&
          !/BUSD/.test(pc.symbol) &&
          +pc.priceChangePercent < this.priceChangePercentToLong,
      ),
      (item) => +item.priceChangePercent,
    );

    while (
      !isEmpty(availLongPos) &&
      numOfRiskyLongPos < this.maxLongPositions
    ) {
      try {
        const { symbol } = availLongPos.shift();
        await this.create(symbol);

        numOfRiskyLongPos += 1;
      } catch (err) {
        console.log(err);
        continue;
      }
    }
  }

  // Add new created position (via app or by bot) to monitoring
  @Cron(CronExpression.EVERY_5_SECONDS)
  async addNewPosition() {
    const dbPositions = await this.positionService.findAll();
    const bncPositions = await Bnc.getPositions();

    const newPositions = differenceBy(bncPositions, dbPositions, 'symbol');
    for (const newPosition of newPositions) {
      // @ts-ignore
      const orders = await Bnc.client.futuresAllOrders({
        symbol: newPosition.symbol,
      });

      if (isEmpty(orders)) {
        console.log('Cound find entry order ' + newPosition.symbol);
      } else {
        const entryOrder = {
          ...orders.pop(),
          kind: OrderKind.ENTRY,
        };

        const positionInput = new Position({
          symbol: newPosition.symbol,
          status: PositionStatus.ENTRY,
          side: +newPosition.positionAmt > 0 ? 'LONG' : 'SHORT',
          orders: [entryOrder],
          avgPrice: +entryOrder.avgPrice,
          dcaLevel: 0,
        });
        positionInput.nextDcaPrice = positionInput.calcNextDcaPrice();

        const position = await this.positionService.add(positionInput);

        this.positionService.update(position);
      }
    }
  }

  private async create(symbol) {
    const currentprice = this.priceStorage.prices[symbol].price;
    const buyQty = await CommonUtil.calcBestQty(
      this.budget / currentprice,
      this.priceStorage.prices[symbol].quantityPrecision,
      currentprice,
      5.1,
      this.budget + 0.5,
    );

    await Bnc.client.futuresOrder({
      symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity: `${buyQty}`,
    });
  }
}
