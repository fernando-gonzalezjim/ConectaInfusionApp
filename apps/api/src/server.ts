import 'dotenv/config';
import { app } from './app.js';
import { pool } from './db.js';

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be between 1 and 65535');
const server = app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => { void pool.end().then(() => process.exit(0), () => process.exit(1)); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
}
