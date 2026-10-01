import type { CafeProduct, StudioOverview, YogaClass } from '@conecta/contracts';
import { pool } from '../../db.js';

export async function getStudioOverview(): Promise<StudioOverview> {
  const classes = await pool.query<YogaClass>(`
    SELECT s.id, s.title AS name, i.full_name AS instructor,
      to_char(s.starts_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "startsAt",
      s.duration_minutes AS "durationMinutes", s.capacity,
      count(b.id)::integer AS booked
    FROM class_sessions s
    JOIN instructors i ON i.id = s.instructor_id
    LEFT JOIN bookings b ON b.class_session_id = s.id AND b.status IN ('confirmed', 'attended')
    WHERE s.starts_at >= now()
    GROUP BY s.id, i.full_name
    ORDER BY s.starts_at, s.id
    LIMIT 20
  `);
  const products = await pool.query<CafeProduct>(`
    SELECT id, name, category, price_minor AS "priceMinor", currency
    FROM products WHERE active = true ORDER BY name, id LIMIT 100
  `);
  return { mode: 'live', classes: classes.rows, products: products.rows };
}
