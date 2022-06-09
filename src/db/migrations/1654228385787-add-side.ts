import { MigrationInterface, QueryRunner } from "typeorm";

export class addSide1654228385787 implements MigrationInterface {
    name = 'addSide1654228385787'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" ADD "side" character varying NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "side"`);
    }

}
