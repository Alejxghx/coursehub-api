export interface CourseRecord {
  id: number;
  title: string;
  level: string;
  createdByUserId: number | null;
}

export type UpdateCourseChanges = Partial<
  Pick<CourseRecord, 'title' | 'level'>
>;
