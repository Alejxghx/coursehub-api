import type { CourseRecord } from './course.js';

export const COURSE_REPOSITORY = Symbol('COURSE_REPOSITORY');
export interface CourseRepository {
  findById(id: number): Promise<CourseRecord | null>;
  save(course: CourseRecord): Promise<CourseRecord>;
}
