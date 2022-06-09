import { ceil, filter, floor, isNil, round } from 'lodash';
import { PositionStatus } from './status';
import { Const } from '../util/const';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { Bnc } from '../util/bnc-client';
import { CommonUtil } from '../util/common';
import { OrderKind } from './type/order-kind';

@Entity()
export class Position {
  @PrimaryGeneratedColumn()
  public id?: number;

  @Column()
  public symbol: string;

  @Column()
  public side: string;

  @Column({ type: 'text' })
  public status: keyof typeof PositionStatus;

  @Column({ type: 'numeric' })
  public avgPrice: number;

  @Column({ type: 'jsonb' })
  public orders: any[];

  public position;

  @Column({ type: 'numeric', nullable: true })
  profitLevel?: number;

  slPrice?: number;

  @Column({ type: 'numeric', nullable: true })
  dcaLevel?: number;

  @Column({ type: 'numeric', nullable: true })
  dcaPrice?: number;

  @Column({ type: 'numeric', nullable: true })
  cutPrice?: number;

  @Column({ type: 'numeric', nullable: true })
  subDcaPrice?: number;

  nextDcaPrice?: number;

  public currentPrice: number;

  public pricePrecision: number;

  public quantityPrecision: number;

  constructor(pos: any) {
    Object.assign(this, pos);
  }

  isProfit(): boolean {
    return this.calcProfitLevel() > this.profitLevel;
  }

  calcProfitLevel(): number {
    if (
      (this.currentPrice / this.avgPrice - 1) * 100 <
      Const.minProfitPercent
    ) {
      return 0;
    }

    return (
      floor((this.currentPrice / this.avgPrice - 1) * 100) -
      Const.minProfitPercent +
      1
    );
  }

  calcSlPrice(): number {
    return (
      (1 +
        (this.profitLevel + Const.minProfitPercent) / 100 -
        (0.005 + this.profitLevel * 0.001)) *
      this.avgPrice
    );
  }

  calcDcaLevel(): number {
    if ((1 - this.currentPrice / this.avgPrice) * 100 < Const.dcaPercent[0]) {
      return -1;
    }

    if (this.status === PositionStatus.ENTRY) {
      if (this.currentPrice < this.avgPrice * (1 - Const.dcaPercent[0] / 100)) {
        return 0;
      }
    }

    if (
      this.currentPrice <
      (this.avgPrice *
        (1 - Const.dcaPercent[this.dcaLevel] / 100) *
        (1 - Const.dcaPercent[this.dcaLevel + 1])) /
        100
    ) {
      return this.dcaLevel + 1;
    }

    return this.dcaLevel;
  }

  calcNextDcaPrice(): number {
    let nextDcaPrice = this.avgPrice;

    for (let i = 0; i <= this.dcaLevel; i += 1) {
      nextDcaPrice *= 1 - Const.dcaPercent[i] / 100;
    }

    return nextDcaPrice;
  }

  calcDcaPrice(): number {
    if (isNil(this.dcaLevel) || this.dcaLevel === 0) {
      return this.avgPrice * (1 - Const.dcaPercent[0] / 100);
    }
  }

  calcAvgPrice(): number {
    if (this.side === 'LONG') {
      const buyOrders = filter(this.orders, { side: 'BUY' });
      const sellOrders = filter(this.orders, { side: 'SELL' });

      let buyBudget = 0;
      let buyQty = 0;

      for (const buyOrder of buyOrders) {
        buyBudget +=
          (+buyOrder.price || +buyOrder.avgPrice || +buyOrder.stopPrice) *
          +buyOrder.origQty;
        buyQty += +buyOrder.origQty;
      }

      let sellBudget = 0;
      let sellQty = 0;
      for (const sellOrder of sellOrders) {
        sellBudget +=
          (+sellOrder.price || +sellOrder.avgPrice || +sellOrder.stopPrice) *
          +sellOrder.origQty;
        sellQty += +sellOrder.origQty;
      }

      const buyAvgPrice = buyBudget / buyQty;

      if (sellQty > 0) {
        const sellAvgPrice = sellBudget / sellQty;

        if (sellAvgPrice < buyAvgPrice) {
          const lostProfit = (buyAvgPrice - sellAvgPrice) * sellQty;

          return round(
            buyAvgPrice + lostProfit / (buyQty - sellQty),
            this.pricePrecision,
          );
        }

        if (buyAvgPrice < sellAvgPrice) {
          const gotProfit = (sellAvgPrice - buyAvgPrice) * sellQty;

          return round(
            buyAvgPrice - gotProfit / (buyQty - sellQty),
            this.pricePrecision,
          );
        }

        return round(buyAvgPrice, this.pricePrecision);
      }

      return round(buyAvgPrice, this.pricePrecision);
    }
  }

  calcNumCutOrders() {
    const dcaOrders = filter(this.orders, { kind: OrderKind.DCA });

    return floor(dcaOrders.length / 2);
  }

  calcCutPrice() {
    const cutNumber = this.calcNumCutOrders();

    if (cutNumber <= 0) {
      return null;
    }

    return (
      this.currentPrice + (this.avgPrice - this.currentPrice) / (cutNumber + 1)
    );
  }

  calcNumSubDcaOrders() {
    const cutOrders = filter(this.orders, { kind: OrderKind.CUT });
    const subDcaOrders = filter(this.orders, { kind: OrderKind.SUBDCA });

    return cutOrders.length - subDcaOrders.length;
  }

  calcSubDcaPrice() {
    const subDcaNumber = this.calcNumSubDcaOrders();

    if (subDcaNumber <= 0) {
      return null;
    }

    return (
      this.currentPrice -
      (this.currentPrice - this.nextDcaPrice) / (subDcaNumber + 1)
    );
  }

  checkLargeBudget() {
    if (+this.position.positionAmt * this.currentPrice > 7) {
      console.log(this.symbol + +this.position.positionAmt * this.currentPrice);
    }
  }

  async createDcaOrder() {
    return Bnc.client.futuresOrder({
      symbol: this.symbol,
      side: 'BUY',
      type: 'MARKET',
      quantity: `${CommonUtil.calcBestQty(
        Const.budget / this.currentPrice,
        this.quantityPrecision,
        this.currentPrice,
        5.1,
      )}`,
      newOrderRespType: 'RESULT',
    });
  }

  async createCutOrder() {
    return Bnc.client.futuresOrder({
      symbol: this.symbol,
      side: 'SELL',
      type: 'MARKET',
      quantity: `${CommonUtil.calcBestQty(
        Const.budget / this.currentPrice,
        this.quantityPrecision,
        this.currentPrice,
        5.1,
      )}`,
      newOrderRespType: 'RESULT',
    });
  }

  async createCloseOrder() {
    return Bnc.client.futuresOrder({
      type: 'MARKET',
      side: 'SELL',
      symbol: this.symbol,
      quantity: `${round(+this.position.positionAmt, this.quantityPrecision)}`,
      reduceOnly: 'true',
      newOrderRespType: 'RESULT',
    });
  }
}
