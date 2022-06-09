import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { find, isNil, map, round } from 'lodash';
import { PositionStatus } from './status';
import { PositionStorage } from 'src/storage/positions';
import { PriceStorage } from 'src/storage/prices';
import { CommonUtil } from 'src/util/common';
import { In, Repository } from 'typeorm';
import { Position } from './position';
import { OrderType } from 'binance-api-node';
import { OrderKind } from './type/order-kind';

@Injectable()
export class PositionService {
  constructor(
    @InjectRepository(Position)
    private positionRepository: Repository<Position>,
    private readonly priceStorage: PriceStorage,
    private readonly positionStorage: PositionStorage,
  ) {}

  async findAll() {
    const positions = await this.positionRepository.find({
      where: {
        status: In([
          PositionStatus.ENTRY,
          PositionStatus.DCA,
          PositionStatus.PROFIT,
        ]),
      },
    });

    return map(positions, (pos) => new Position(pos));
  }

  async add(position: Partial<Position>) {
    return new Position(await this.positionRepository.save(position));
  }

  public async update(position: Position) {
    if (position.status === PositionStatus.DONE) {
      return;
    }

    position.position = find(this.positionStorage.positions, {
      symbol: position.symbol,
    });

    if (!this.priceStorage.prices[position.symbol] || !position.position) {
      await CommonUtil.sleep(5);
      return this.update(position);
    }

    const { pricePrecision, quantityPrecision, price } =
      this.priceStorage.prices[position.symbol];

    position.pricePrecision = pricePrecision;
    position.quantityPrecision = quantityPrecision;
    position.currentPrice = price;

    position.checkLargeBudget();

    if (position.status === PositionStatus.ENTRY) {
      await this.updateOnEntry(position);
    } else if (position.status === PositionStatus.PROFIT) {
      await this.updateOnProfit(position);
    } else if (position.status === PositionStatus.DCA) {
      await this.updateOnDca(position);
    }

    await CommonUtil.sleep(5);
    this.update(position);
  }

  private async updateOnDca(position: Position) {
    if (position.isProfit()) {
      position.status = PositionStatus.PROFIT;

      return this.positionRepository.update(position.id, {
        status: position.status,
      });
    }

    if (position.currentPrice < position.nextDcaPrice) {
      position.dcaPrice = position.nextDcaPrice;
      position.dcaLevel += 1;
      position.nextDcaPrice = position.calcNextDcaPrice();

      await this.positionRepository.update(position.id, {
        dcaPrice: position.dcaPrice,
        dcaLevel: position.dcaLevel,
      });
    }

    if (!isNil(position.dcaPrice)) {
      if (position.currentPrice < position.dcaPrice * 0.99) {
        position.dcaPrice *= 0.99;

        await this.positionRepository.update(position.id, {
          dcaPrice: position.dcaPrice,
        });
      }

      if (position.currentPrice > position.dcaPrice * 1.005) {
        position.orders.push({
          ...(await position.createDcaOrder()),
          kind: OrderKind.DCA,
        });
        position.avgPrice = position.calcAvgPrice();
        position.dcaPrice = null;
        position.cutPrice = position.calcCutPrice();
        console.log({ symbol: position.symbol, cutPrice: position.cutPrice });

        await this.positionRepository.update(position.id, {
          orders: position.orders,
          avgPrice: position.avgPrice,
          dcaPrice: position.dcaPrice,
          cutPrice: position.cutPrice,
        });
      }
    }

    if (position.cutPrice) {
      if (position.currentPrice > position.cutPrice * 1.01) {
        position.cutPrice *= 1.01;

        await this.positionRepository.update(position.id, {
          cutPrice: position.cutPrice,
        });
      }

      if (position.currentPrice < position.cutPrice * 0.995) {
        position.orders.push({
          ...(await position.createCutOrder()),
          kind: OrderKind.CUT,
        });
        position.cutPrice = position.calcCutPrice();
        position.avgPrice = position.calcAvgPrice();
        position.subDcaPrice = position.calcSubDcaPrice();

        await this.positionRepository.update(position.id, {
          orders: position.orders,
          cutPrice: position.cutPrice,
          avgPrice: position.avgPrice,
          subDcaPrice: position.subDcaPrice,
        });
      }
    }

    if (position.subDcaPrice) {
      if (position.currentPrice < position.subDcaPrice * 0.99) {
        position.subDcaPrice *= 0.99;

        await this.positionRepository.update(position.id, {
          subDcaPrice: position.subDcaPrice,
        });
      }

      if (position.currentPrice > position.subDcaPrice * 1.005) {
        position.orders.push({
          ...(await position.createDcaOrder()),
          kind: OrderKind.SUBDCA,
        });
        position.cutPrice = position.calcCutPrice();
        position.avgPrice = position.calcAvgPrice();
        position.subDcaPrice = position.calcSubDcaPrice();

        await this.positionRepository.update(position.id, {
          orders: position.orders,
          cutPrice: position.cutPrice,
          avgPrice: position.avgPrice,
          subDcaPrice: position.subDcaPrice,
        });
      }
    }
  }

  private async updateOnEntry(position: Position) {
    if (position.isProfit()) {
      position.status = PositionStatus.PROFIT;

      return this.positionRepository.update(position.id, {
        status: position.status,
      });
    }

    if (position.currentPrice < position.nextDcaPrice) {
      position.status = PositionStatus.DCA;
      position.dcaPrice = position.nextDcaPrice;
      position.dcaLevel += 1;
      position.nextDcaPrice = position.calcNextDcaPrice();

      await this.positionRepository.update(position.id, {
        status: position.status,
        dcaPrice: position.dcaPrice,
        dcaLevel: position.dcaLevel,
      });

      return;
    }
  }

  private async updateOnProfit(position: Position) {
    const newProfitLevel = position.calcProfitLevel();

    if (newProfitLevel > position.profitLevel) {
      position.profitLevel = newProfitLevel;

      await this.positionRepository.update(position.id, {
        profitLevel: position.profitLevel,
      });
    }

    position.slPrice = position.calcSlPrice();

    if (position.currentPrice < position.slPrice) {
      position.status = PositionStatus.DONE;
      position.orders.push({
        ...(await position.createCloseOrder()),
        kind: OrderKind.PROFIT,
      });

      await this.positionRepository.update(position.id, {
        status: position.status,
        orders: position.orders,
      });
    }
  }
}
