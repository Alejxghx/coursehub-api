import { IsInt, Max, Min } from 'class-validator';

export class CreateEnrollmentDto {
  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  studentId: number;

  @IsInt()
  @Min(1)
  @Max(Number.MAX_SAFE_INTEGER)
  courseId: number;
}
