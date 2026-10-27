import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { EnrollmentsService } from './enrollments.service.js';
import { CreateEnrollmentDto } from './dto/create-enrollment.dto.js';
import { EnrollmentsQueryDto } from './dto/enrollments-query.dto.js';
import { EnrollmentIdPipe } from './pipes/enrollment-id.pipe.js';

@Controller()
export class EnrollmentsController {
  constructor(private readonly enrollmentsService: EnrollmentsService) {}

  @Post('enrollments')
  create(@Body() input: CreateEnrollmentDto) {
    return this.enrollmentsService.create(input);
  }

  @Get('enrollments')
  findAll(@Query() query: EnrollmentsQueryDto) {
    return this.enrollmentsService.search(query);
  }

  @Get('students/:studentId/enrollments')
  findByStudent(@Param('studentId', EnrollmentIdPipe) studentId: string) {
    // Keep the raw text until the ID pipe validates its decimal format.
    return this.enrollmentsService.findByStudent(Number(studentId));
  }

  @Get('courses/:courseId/enrollments')
  findByCourse(@Param('courseId', EnrollmentIdPipe) courseId: string) {
    return this.enrollmentsService.findByCourse(Number(courseId));
  }

  @Delete('enrollments/:id')
  @HttpCode(204)
  remove(@Param('id', EnrollmentIdPipe) id: string) {
    return this.enrollmentsService.remove(Number(id));
  }
}
