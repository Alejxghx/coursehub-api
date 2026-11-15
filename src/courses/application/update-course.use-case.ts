import type { CourseRepository } from '../domain/course-repository.port.js';
import type { UpdateCourseChanges } from '../domain/course.js';
import {
  CourseNotFoundError,
  CoursePermissionError,
} from '../domain/course.errors.js';
import type { AuthenticatedUser } from '../../auth/types/jwt-payload.type.js';
import { UserRole } from '../../users/user-role.enum.js';

// No HTTP, Nest or TypeORM dependencies: this rule can run with any adapter.
export class UpdateCourseUseCase {
  constructor(private readonly courses: CourseRepository) {}

  async execute(
    id: number,
    changes: UpdateCourseChanges,
    actor: AuthenticatedUser,
  ) {
    const course = await this.courses.findById(id);
    if (!course) throw new CourseNotFoundError();
    const admin = actor.role === UserRole.ADMIN;
    const owner =
      actor.role === UserRole.TEACHER && course.createdByUserId === actor.id;
    if (!admin && !owner) throw new CoursePermissionError();
    // Explicitly copy editable fields; ownership never comes from changes.
    return this.courses.save({
      ...course,
      title: changes.title ?? course.title,
      level: changes.level ?? course.level,
    });
  }
}
