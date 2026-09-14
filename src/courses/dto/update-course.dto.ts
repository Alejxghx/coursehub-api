import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdateCourseDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsIn(['beginner', 'intermediate', 'advanced'])
  level?: string;
}
