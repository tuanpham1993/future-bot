import Binance from 'binance-api-node';
import { filter } from 'lodash';

export class Bnc {
  static client = Binance({
    apiKey: process.env.BNC_FUTURE_API_KEY,
    apiSecret: process.env.BNC_FUTURE_SECRET,
  });

  static async getPositions() {
    return filter(
      await Bnc.client.futuresPositionRisk(),
      ({ positionAmt }) => +positionAmt > 0,
    );
  }

  static async getAllTickers(): Promise<any[]> {
    return new Promise((resolve) => {
      const clean = Bnc.client.ws.futuresAllTickers((res) => {
        clean();

        resolve(res);
      });
    });
  }
}
