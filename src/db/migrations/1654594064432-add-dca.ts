import { MigrationInterface, QueryRunner } from "typeorm";

export class addDca1654594064432 implements MigrationInterface {
    name = 'addDca1654594064432'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" ADD "dcaLevel" numeric`);
        await queryRunner.query(`ALTER TABLE "position" ADD "dcaPrice" numeric`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "dcaPrice"`);
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "dcaLevel"`);
    }

}
