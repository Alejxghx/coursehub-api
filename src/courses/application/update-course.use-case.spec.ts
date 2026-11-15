import { UpdateCourseUseCase } from './update-course.use-case.js';
import type { CourseRepository } from '../domain/course-repository.port.js';
import type { CourseRecord } from '../domain/course.js';
import {
  CourseNotFoundError,
  CoursePermissionError,
} from '../domain/course.errors.js';
import { UserRole } from '../../users/user-role.enum.js';

const actor = (id: number, role: UserRole) => ({
  id,
  role,
  email: 'test@example.com',
});
describe('Actualizar curso sin HTTP ni TypeORM', () => {
  let course: CourseRecord;
  let saves: number;
  let useCase: UpdateCourseUseCase;
  beforeEach(() => {
    course = {
      id: 1,
      title: 'Original',
      level: 'beginner',
      createdByUserId: 10,
    };
    saves = 0;
    const repository: CourseRepository = {
      findById: async (id) => (id === course.id ? { ...course } : null),
      save: async (updated) => {
        saves++;
        course = { ...updated };
        return course;
      },
    };
    useCase = new UpdateCourseUseCase(repository);
  });
  it('el docente propietario edita y conserva el propietario', async () => {
    const result = await useCase.execute(
      1,
      { title: 'Nuevo' },
      actor(10, UserRole.TEACHER),
    );
    expect(result).toMatchObject({ title: 'Nuevo', createdByUserId: 10 });
    expect(saves).toBe(1);
  });
  it('el docente ajeno no modifica ni guarda', async () => {
    await expect(
      useCase.execute(1, { title: 'Ataque' }, actor(11, UserRole.TEACHER)),
    ).rejects.toBeInstanceOf(CoursePermissionError);
    expect(course.title).toBe('Original');
    expect(saves).toBe(0);
  });
  it('ser propietario no concede privilegio a un estudiante', async () => {
    await expect(
      useCase.execute(1, {}, actor(10, UserRole.STUDENT)),
    ).rejects.toBeInstanceOf(CoursePermissionError);
    expect(saves).toBe(0);
  });
  it('admin edita un curso antiguo sin propietario', async () => {
    course.createdByUserId = null;
    expect(
      (
        await useCase.execute(
          1,
          { level: 'advanced' },
          actor(1, UserRole.ADMIN),
        )
      ).level,
    ).toBe('advanced');
  });
  it('un recurso ausente produce un error de dominio', async () => {
    await expect(
      useCase.execute(99, {}, actor(1, UserRole.ADMIN)),
    ).rejects.toBeInstanceOf(CourseNotFoundError);
    expect(saves).toBe(0);
  });
  it('descarta un propietario inyectado incluso fuera de HTTP', async () => {
    const changes = { title: 'Permitido', createdByUserId: 99 };
    const result = await useCase.execute(
      1,
      changes,
      actor(10, UserRole.TEACHER),
    );
    expect(result.createdByUserId).toBe(10);
  });
});
