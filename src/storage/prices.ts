import { Injectable, OnApplicationBootstrap, OnModuleInit } from '@nestjs/common';
import { filter, map, round } from 'lodash';
import { Bnc } from '../util/bnc-client';

export class PriceStorage implements OnApplicationBootstrap {
  public prices = {};
  private symbols: any[];

  async onApplicationBootstrap() {
    const { symbols: allSymbols } = await Bnc.client.futuresExchangeInfo();
    this.symbols = filter(
      allSymbols,
      ({ symbol }) => !/BTCDOMUSDT/.test(symbol) && !/BUSD/.test(symbol),
    );

    this.watchPrices();
  }

  public watchPrices() {
    map(this.symbols, ({ symbol, pricePrecision, quantityPrecision }) => {
      Bnc.client.ws.futuresPartialDepth(
        { symbol: symbol, level: 5 },
        (depth) => {
          const price = round(
            // @ts-ignore
            (+depth.bidDepth[0].price + +depth.askDepth[0].price) / 2,
            pricePrecision,
          );

          this.prices[symbol] = { price, pricePrecision, quantityPrecision };
        },
      );
    });
  }
}
