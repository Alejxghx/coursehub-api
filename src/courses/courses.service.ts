import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { postgresErrorCode } from '../common/postgres-error.js';
import { Course } from './entities/course.entity.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {} // 1

  findAll(level?: string) {
    // 2
    return this.coursesRepository.find({
      where: level ? { level } : {},
      order: { id: 'ASC' },
    }); // 3
  }

  async findOne(id: number): Promise<Course> {
    const course = await this.coursesRepository.findOneBy({ id }); // 4
    if (!course) throw new NotFoundException(`Course ${id} not found`); // 5
    return course;
  }

  create(dto: CreateCourseDto) {
    // 6
    const course = this.coursesRepository.create(dto);
    return this.coursesRepository.save(course);
  }

  async update(id: number, dto: UpdateCourseDto) {
    const course = await this.findOne(id); // 7
    if (dto.title !== undefined) course.title = dto.title;
    if (dto.level !== undefined) course.level = dto.level;
    return this.coursesRepository.save(course); // 8
  }

  async remove(id: number) {
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
