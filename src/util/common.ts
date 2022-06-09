import { isNil, floor, ceil } from 'lodash';

export class CommonUtil {
  static async sleep(seconds) {
    return new Promise((resolve) => {
      setTimeout(resolve, seconds * 1000);
    });
  }

  static calcBestQty(
    qty: number,
    qtyPrecision: number,
    price: number,
    min: number,
    max?: number,
  ) {
    const lower = floor(qty, qtyPrecision);

    if (lower * price < min) {
      const higher = ceil(qty, qtyPrecision);

      if (!isNil(max) && higher > max) {
        throw new Error('Greater than max');
      }

      return higher;
    }

    return lower;
  }
}
