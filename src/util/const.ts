import { map, split } from "lodash"

require('dotenv').config()

export class Const {
    static budget = +process.env.BUDGET
    static minProfitPercent = +process.env.MIN_PROFIT_PERCENT
    static stopPricePercent = +process.env.STOP_PRICE_PERCENT
    static dcaPercent = map(split(process.env.DCA_PERCENT, ','), item => +item)
}