import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { FilterEnrollmentsDto } from './dto/filter-enrollments.dto.js';
import { EnrollmentIdPipe } from './pipes/enrollment-id.pipe.js';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('enrollments')
  create(@Body() input: CreateEnrollmentDto) {
    return this.enrollmentsService.create(input);
  }

  @Get('enrollments')
  findAll(
    @Query(new ValidationPipe({ transform: true }))
    filters: FilterEnrollmentsDto,
  ) {
    return this.enrollmentsService.findAll(filters.studentId, filters.courseId);
  }

  @Get('students/:studentId/enrollments')
  findByStudent(@Param('studentId', EnrollmentIdPipe) studentId: number) {
    return this.enrollmentsService.findByStudent(studentId);
  }

  @Get('courses/:courseId/enrollments')
  findByCourse(@Param('courseId', EnrollmentIdPipe) courseId: number) {
    return this.enrollmentsService.findByCourse(courseId);
  }

  @Delete('enrollments/:id')
  @HttpCode(204)
  remove(@Param('id', EnrollmentIdPipe) id: number) {
    return this.enrollmentsService.remove(id);
  }
}
