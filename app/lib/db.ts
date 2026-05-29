type RunResult = {
  changes: number;
  lastInsertRowid: number;
};

type Statement = {
  run: (..._args: unknown[]) => RunResult;
  all: (..._args: unknown[]) => unknown[];
  get: (..._args: unknown[]) => unknown | null;
};

export const db = {
  prepare: (_sql: string): Statement => ({
    run: (..._args: unknown[]) => ({
      changes: 0,
      lastInsertRowid: 0,
    }),
    all: (..._args: unknown[]) => [],
    get: (..._args: unknown[]) => null,
  }),
};

export default db;