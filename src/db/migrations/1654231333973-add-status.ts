import { MigrationInterface, QueryRunner } from "typeorm";

export class addStatus1654231333973 implements MigrationInterface {
    name = 'addStatus1654231333973'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" ADD "status" text NOT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "position" DROP COLUMN "status"`);
    }

}
