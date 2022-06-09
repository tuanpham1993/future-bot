import { MigrationInterface, QueryRunner } from "typeorm";

export class addProfit1654572822996 implements MigrationInterface {
    name = 'addProfit1654572822996'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" ADD "profitLevel" numeric`);
        await queryRunner.query(`ALTER TABLE "position" ADD "slPrice" numeric`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "slPrice"`);
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "profitLevel"`);
    }

}
