export class CourseNotFoundError extends Error {
  constructor() {
    super('Course not found');
  }
}

export class CoursePermissionError extends Error {
  constructor() {
    super('You cannot modify this course');
  }
}
