import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateCourseDto } from './dto/create-course.dto.js';
import { UpdateCourseDto } from './dto/update-course.dto.js';
import { Course } from './entities/course.entity.js';

@Injectable()
export class CoursesService {
  constructor(
    @InjectRepository(Course)
    private readonly coursesRepository: Repository<Course>,
  ) {}

  findAll(level?: string) {
    return this.coursesRepository.find({
      where: level ? { level } : {},
      order: { id: 'ASC' },
    });
  }

  async findOne(id: number): Promise<Course> {
    if (!Number.isInteger(id) || id < 1 || id > 2147483647) {
      throw new NotFoundException(`Course ${id} not found`);
    }
    const course = await this.coursesRepository.findOneBy({ id });
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    return course;
  }

  create(dto: CreateCourseDto) {
    const course = this.coursesRepository.create(dto);
    return this.coursesRepository.save(course);
  }

  async update(id: number, dto: UpdateCourseDto) {
    const course = await this.findOne(id);
    if (dto.title !== undefined) course.title = dto.title;
    if (dto.level !== undefined) course.level = dto.level;
    return this.coursesRepository.save(course);
  }

  async remove(id: number) {
    const course = await this.findOne(id);
    const removed = { ...course };
    await this.coursesRepository.remove(course);
    return removed;
  }
}
