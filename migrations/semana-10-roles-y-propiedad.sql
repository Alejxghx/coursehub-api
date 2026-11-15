-- Aplicar con respaldo y conexión a la base de destino ya revisada.
-- Esquema public predeterminado. En desarrollo synchronize realiza estos cambios.
BEGIN;
DO $$ BEGIN
  IF to_regtype('users_role_enum') IS NULL THEN
    CREATE TYPE users_role_enum AS ENUM ('admin','teacher','student');
  END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role users_role_enum NOT NULL DEFAULT 'student';
ALTER TABLE courses ADD COLUMN IF NOT EXISTS created_by_user_id integer NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_courses_created_by_user' AND conrelid = 'courses'::regclass) THEN
    ALTER TABLE courses ADD CONSTRAINT fk_courses_created_by_user FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;
COMMIT;
-- Cursos anteriores quedan con propietario NULL. Solo admin puede modificarlos
-- hasta asignarles un docente explícitamente mediante una operación local controlada.
