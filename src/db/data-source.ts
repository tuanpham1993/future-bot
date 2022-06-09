import { Position } from '../../src/position/position';
import { DataSource, DataSourceOptions } from 'typeorm';

export const datasourceOptions: DataSourceOptions = {
  type: 'postgres',
  host: 'localhost',
  port: 5433,
  username: 'postgres',
  password: 'postgres',
  database: 'platform',
  logging: true,
  entities: [Position],
  subscribers: [],
  migrations: ['./src/**/migrations/*.ts'],
};

export const AppDataSource = new DataSource(datasourceOptions);
