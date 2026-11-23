/** @type {import('jest').Config} */
export default {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.spec.ts'],
  extensionsToTreatAsEsm: ['.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { useESM: true, tsconfig: 'tsconfig.spec.json' }],
  },
  // NodeNext imports use .js; Jest executes the corresponding .ts source.
  moduleNameMapper: { '^(\\.{1,2}/.*)\\.js$': '$1' },
  setupFiles: ['reflect-metadata'],
  clearMocks: true,
  restoreMocks: true,
  coverageProvider: 'v8',
  collectCoverageFrom: [
    'src/courses/application/update-course.use-case.ts',
    'src/courses/courses.controller.ts',
  ],
  coverageReporters: ['text', 'html', 'json-summary'],
  coverageDirectory: 'coverage',
};
