import { Client } from 'pg';
try {
  process.loadEnvFile();
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
const [email, role] = process.argv.slice(2);
if (!email || !['admin', 'teacher', 'student'].includes(role)) {
  console.error(
    'Uso: node scripts/set-user-role.mjs correo@example.com admin|teacher|student',
  );
  process.exit(1);
}
const db = new Client({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  database: process.env.DATABASE_NAME,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
});
try {
  await db.connect();
  const { rows } = await db.query(
    'UPDATE users SET role = $1 WHERE email = $2 RETURNING id, email, role',
    [role, email.trim().toLowerCase()],
  );
  if (!rows.length) {
    console.error('Cuenta no encontrada. Regístrala primero.');
    process.exitCode = 1;
  } else console.log(JSON.stringify(rows[0]));
} catch {
  console.error(
    'No se pudo asignar el rol. Revisa la conexión y el esquema de la base.',
  );
  process.exitCode = 1;
} finally {
  await db.end();
}
