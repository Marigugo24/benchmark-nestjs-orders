import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';
import { CreateOrderDto } from './dto/create-order.dto';

export interface OrderResponse {
  orderId: string;
  customerId: string;
  totalAmount: number;
  itemsCount: number;
  processedAt: string;
}

@Injectable()
export class OrdersService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async create(dto: CreateOrderDto): Promise<OrderResponse> {
    // 1. Calcular totalAmount e itemsCount (en centavos para evitar errores de float)
    let totalCents = 0;
    let itemsCount = 0;
    for (const item of dto.items) {
      totalCents += Math.round(item.price * 100) * item.quantity;
      itemsCount += item.quantity;
    }
    const totalAmount = totalCents / 100;
    const orderId = `ORD-${randomUUID()}`;

    // 2. Insertar en orders y order_items dentro de una transacción
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows } = await client.query<{ created_at: Date }>(
        `INSERT INTO orders (order_id, customer_id, total_amount, items_count)
         VALUES ($1, $2, $3, $4)
         RETURNING created_at`,
        [orderId, dto.customerId, totalAmount, itemsCount],
      );

      // Un solo INSERT multi-fila para todos los items
      const values: (string | number)[] = [];
      const placeholders = dto.items.map((item, i) => {
        const o = i * 4;
        values.push(orderId, item.productId, item.quantity, item.price);
        return `($${o + 1}, $${o + 2}, $${o + 3}, $${o + 4})`;
      });
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price)
         VALUES ${placeholders.join(', ')}`,
        values,
      );

      await client.query('COMMIT');

      // 3. Respuesta
      return {
        orderId,
        customerId: dto.customerId,
        totalAmount,
        itemsCount,
        processedAt: rows[0].created_at.toISOString(),
      };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }
}
