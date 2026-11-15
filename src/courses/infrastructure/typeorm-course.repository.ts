import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Course } from '../entities/course.entity.js';
import type { CourseRecord } from '../domain/course.js';
import type { CourseRepository } from '../domain/course-repository.port.js';

@Injectable()
export class TypeOrmCourseRepository implements CourseRepository {
  constructor(
    @InjectRepository(Course) private readonly repository: Repository<Course>,
  ) {}

  findById(id: number): Promise<CourseRecord | null> {
    return this.repository.findOneBy({ id });
  }

  async save(course: CourseRecord): Promise<CourseRecord> {
    const saved = await this.repository.save(course);
    return {
      id: saved.id,
      title: saved.title,
      level: saved.level,
      createdByUserId: saved.createdByUserId,
    };
  }
}
