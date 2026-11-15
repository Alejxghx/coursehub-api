import {
  ConflictException,
  Injectable,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { postgresErrorCode } from '../common/postgres-error.js';
import { Course } from './entities/course.entity.js';
import type { CoursesQueryDto } from './dto/courses-query.dto.js';
import type { AuthenticatedUser } from '../auth/types/jwt-payload.type.js';
import { UserRole } from '../users/user-role.enum.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {} // 1

  async findAll(query: CoursesQueryDto) {
    const { level, page, limit, sortBy, order } = query;
    const [items, total] = await this.coursesRepository.findAndCount({
      where: level ? { level } : {},
      order: { [sortBy]: order, id: sortBy === 'id' ? order : 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return {
      items,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: number): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id }); // 4
    if (!course) throw new NotFoundException(`Course ${id} not found`); // 5
    return course;
  }

  create(dto: CreateCourseDto, actor: AuthenticatedUser) {
    if (![UserRole.ADMIN, UserRole.TEACHER].includes(actor.role))
      throw new ForbiddenException();
    // 6
    const course = this.coursesRepository.create({
      title: dto.title,
      level: dto.level,
      createdByUserId: actor.id,
    });
    return this.coursesRepository.save(course);
  }

  async remove(id: number, actor: AuthenticatedUser) {
    if (actor.role !== UserRole.ADMIN) throw new ForbiddenException();
    const course = await this.findOne(id); // 9
    const deletedCourse = { ...course };
    try {
      await this.coursesRepository.remove(course);
      return deletedCourse;
    } catch (error) {
      if (postgresErrorCode(error) === '23503') {
        throw new ConflictException(
          'Cancela las matrículas del curso antes de eliminarlo',
        );
      }
      throw error;
    }
  }
}
