import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const openapiPath = join(dirname(fileURLToPath(import.meta.url)), '../docs/openapi.yaml');
const spec = readFileSync(openapiPath, 'utf-8');

const expectedOperations = [
  {
    path: '/api/v1/users/register',
    method: 'post',
    codes: ['201', '400', '403', '409', '429'],
  },
  {
    path: '/api/v1/users/login',
    method: 'post',
    codes: ['200', '400', '401', '429'],
  },
  {
    path: '/api/v1/users',
    method: 'get',
    codes: ['200', '400', '401', '403', '429'],
  },
  {
    path: '/api/v1/users/{id}',
    method: 'get',
    codes: ['200', '400', '401', '403', '404', '429'],
  },
  {
    path: '/api/v1/users/{id}/block',
    method: 'patch',
    codes: ['200', '400', '401', '403', '404', '429'],
  },
] as const;

function pathBlock(path: string): string {
  const marker = `  ${path}:`;
  const start = spec.indexOf(marker);
  if (start === -1) {
    throw new Error(`path not found in openapi.yaml: ${path}`);
  }

  const rest = spec.slice(start + marker.length);
  const nextPath = rest.search(/\n  \/[\w/{}]+:/);
  return nextPath === -1 ? spec.slice(start) : spec.slice(start, start + marker.length + nextPath);
}

function operationSection(path: string, method: string): string {
  const block = pathBlock(path);
  const methodMarker = `    ${method}:`;
  const methodStart = block.indexOf(methodMarker);
  if (methodStart === -1) {
    throw new Error(`method ${method} not found for ${path}`);
  }

  const rest = block.slice(methodStart + methodMarker.length);
  const nextMethod = rest.search(/\n    [a-z]+:/);
  const operationYaml =
    nextMethod === -1
      ? block.slice(methodStart)
      : block.slice(methodStart, methodStart + methodMarker.length + nextMethod);

  return operationYaml;
}

function documentedStatusCodes(operationYaml: string): string[] {
  return [...operationYaml.matchAll(/^\s+'(\d{3})':/gm)].map((match) => match[1]);
}

describe('openapi.yaml', () => {
  it.each(expectedOperations)(
    '$method $path has documented status codes',
    ({ path, method, codes }) => {
      const section = operationSection(path, method);
      const documented = documentedStatusCodes(section);
      for (const code of codes) {
        expect(documented, `missing ${code} on ${method} ${path}`).toContain(code);
      }
    },
  );

  it('BadRequest example has error.code', () => {
    expect(spec).toMatch(
      /BadRequest:[\s\S]*?examples:[\s\S]*?code:\s*VALIDATION_ERROR/,
    );
  });

  it('GET /users example has total and totalPages in meta', () => {
    const section = operationSection('/api/v1/users', 'get');
    expect(section).toMatch(/meta:/);
    expect(section).toMatch(/total:\s*\d+/);
    expect(section).toMatch(/totalPages:\s*\d+/);
  });
});
