import { MigrationInterface, QueryRunner } from "typeorm";

export class addColumns1654492178472 implements MigrationInterface {
    name = 'addColumns1654492178472'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" ADD "avgPrice" numeric NOT NULL`);
        await queryRunner.query(`ALTER TABLE "position" ADD "orders" jsonb NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "orders"`);
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "avgPrice"`);
    }

}
