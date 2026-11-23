import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'src/courses/application/update-course.use-case.ts');
const original = readFileSync(source, 'utf8');
const rule = 'course.createdByUserId === actor.id';
assert.equal(
  original.split(rule).length,
  2,
  'La regla cambió; revisa la demostración antes de ejecutarla.',
);
const directory = mkdtempSync(join(tmpdir(), 'coursehub-week12-'));
const useCase = 'src/courses/application/update-course.use-case.spec.ts';
const controller = 'src/courses/courses.controller.spec.ts';
const focused = [
  '--runTestsByPath',
  useCase,
  '--testNamePattern',
  'rechaza al docente ajeno antes de guardar',
];

function run(label, args) {
  console.log(`\n${label}`);
  const report = join(directory, `${label}.json`);
  const result = spawnSync(
    process.execPath,
    [
      '--experimental-vm-modules',
      join(root, 'node_modules/jest/bin/jest.js'),
      '--runInBand',
      '--json',
      `--outputFile=${report}`,
      ...args,
    ],
    { cwd: root, stdio: 'inherit' },
  );
  if (result.error) throw result.error;
  assert.equal(result.signal, null, 'La ejecución fue interrumpida.');
  return {
    status: result.status,
    report: JSON.parse(readFileSync(report, 'utf8')),
  };
}

try {
  const before = run('1-regla-original', focused);
  assert.equal(before.status, 0);
  assert.equal(before.report.numPassedTests, 1);

  let mutated;
  try {
    // Fallo deliberado: cualquier docente puede editar, aunque no sea propietario.
    writeFileSync(source, original.replace(rule, 'true'));
    mutated = run('2-fallo-esperado-sin-comprobar-propietario', focused);
  } finally {
    // Incluso si Jest falla o no puede arrancar, recupera el contenido original.
    writeFileSync(source, original);
  }
  assert.equal(
    mutated.status,
    1,
    'La prueba debía detectar la autorización incorrecta.',
  );
  assert.equal(mutated.report.numFailedTests, 1);
  const failed = mutated.report.testResults
    .flatMap((suite) => suite.assertionResults)
    .filter((test) => test.status === 'failed');
  assert.equal(failed.length, 1);
  assert.equal(failed[0].title, 'rechaza al docente ajeno antes de guardar');
  assert.equal(readFileSync(source, 'utf8'), original);

  const restored = run('3-regla-restaurada', [
    '--runTestsByPath',
    useCase,
    controller,
  ]);
  assert.equal(restored.status, 0);
  const summary = {
    original: { passed: before.report.numPassedTests },
    mutation: {
      failedAsExpected: mutated.report.numFailedTests,
      rule: 'Se omitió la comparación del propietario',
    },
    restored: {
      passed: restored.report.numPassedTests,
      sourceUnchanged: readFileSync(source, 'utf8') === original,
    },
    sourceSha256: createHash('sha256').update(original).digest('hex'),
  };
  console.log(
    '\nDemostración correcta: se detectó el fallo y se restauró la regla.',
  );
  console.log(JSON.stringify(summary, null, 2));
} finally {
  rmSync(directory, { recursive: true, force: true });
}
