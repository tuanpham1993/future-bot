import { MigrationInterface, QueryRunner } from "typeorm";

export class addSubDcaAndCut1654741518705 implements MigrationInterface {
    name = 'addSubDcaAndCut1654741518705'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "slPrice"`);
        await queryRunner.query(`ALTER TABLE "position" ADD "cutPrice" numeric`);
        await queryRunner.query(`ALTER TABLE "position" ADD "subDcaPrice" numeric`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "subDcaPrice"`);
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "cutPrice"`);
        await queryRunner.query(`ALTER TABLE "position" ADD "slPrice" numeric`);
    }

}
