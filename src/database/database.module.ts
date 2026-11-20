import { Global, Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { Pool } from 'pg';

export const PG_POOL = 'PG_POOL';

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      useFactory: () =>
        new Pool({
          host: process.env.DB_HOST ?? 'localhost',
          port: Number(process.env.DB_PORT ?? 5432),
          user: process.env.DB_USER ?? 'postgres',
          password: process.env.DB_PASSWORD ?? 'postgres',
          database: process.env.DB_NAME ?? 'orders_db',
          // Tamaño del pool: ajustable por env para el benchmark.
          // Postgres permite 100 conexiones por defecto.
          max: Number(process.env.DB_POOL_MAX ?? 20),
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
        }),
    },
  ],
  exports: [PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
  }
}
