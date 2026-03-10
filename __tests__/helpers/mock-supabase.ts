/**
 * Mock Supabase client builder for unit tests.
 * Simulates the fluent query builder chain used by the cascade service.
 */

type FilterFn = (row: any) => boolean;

interface MockQueryBuilder {
  select: (columns: string) => MockQueryBuilder;
  eq: (column: string, value: any) => MockQueryBuilder;
  is: (column: string, value: null) => MockQueryBuilder;
  or: (expression: string) => MockQueryBuilder;
  order: (column: string) => MockQueryBuilder;
  single: () => Promise<{ data: any; error: any }>;
  maybeSingle: () => Promise<{ data: any; error: any }>;
  then: (resolve: (value: { data: any; error: any }) => any) => Promise<any>;
}

function parseOrExpression(expression: string): FilterFn {
  // Parse expressions like "action_type_id.eq.uuid,action_type_id.is.null"
  const parts = expression.split(',');
  const filters: FilterFn[] = parts.map((part) => {
    const match = part.match(/^(\w+)\.(eq|is)\.(.+)$/);
    if (match) {
      const [, col, op, val] = match;
      if (op === 'eq') return (row: any) => row[col] === val;
      if (op === 'is' && val === 'null') return (row: any) => row[col] === null || row[col] === undefined;
    }
    // Handle "column.is.null" without value
    const nullMatch = part.match(/^(\w+)\.is\.null$/);
    if (nullMatch) {
      return (row: any) => row[nullMatch[1]] === null || row[nullMatch[1]] === undefined;
    }
    return () => true;
  });
  return (row: any) => filters.some((f) => f(row));
}

function resolveJoins(row: any, selectStr: string, tables: Record<string, any[]>): any {
  const result = { ...row };

  // Match patterns like "findings(*)" or "materials(*)" or "unit_types(*)"
  const joinMatches = selectStr.matchAll(/(\w+)\(\*\)/g);
  for (const match of joinMatches) {
    const joinTable = match[1];
    const fkColumn = `${joinTable.replace(/s$/, '')}_id`.replace(/finding_id/, 'finding_id');

    // Determine the correct FK column name
    let fk: string;
    if (joinTable === 'findings') fk = 'finding_id';
    else if (joinTable === 'materials') fk = 'material_id';
    else if (joinTable === 'unit_types') fk = 'unit_type_id';
    else fk = `${joinTable.replace(/s$/, '')}_id`;

    const fkValue = row[fk];
    if (fkValue && tables[joinTable]) {
      result[joinTable] = tables[joinTable].find((r) => r.id === fkValue) || null;
    } else {
      result[joinTable] = null;
    }
  }

  return result;
}

export function createMockSupabase(tables: Record<string, any[]>) {
  return {
    from: (tableName: string) => {
      let rows = [...(tables[tableName] || [])];
      let filters: FilterFn[] = [];
      let selectStr = '*';

      const builder: MockQueryBuilder = {
        select(columns: string) {
          selectStr = columns;
          return builder;
        },
        eq(column: string, value: any) {
          filters.push((row) => row[column] === value);
          return builder;
        },
        is(column: string, _value: null) {
          filters.push((row) => row[column] === null || row[column] === undefined);
          return builder;
        },
        or(expression: string) {
          filters.push(parseOrExpression(expression));
          return builder;
        },
        order(_column: string) {
          return builder;
        },
        async single() {
          const filtered = rows.filter((row) => filters.every((f) => f(row)));
          const resolved = filtered.length > 0 ? resolveJoins(filtered[0], selectStr, tables) : null;
          return { data: resolved, error: null };
        },
        async maybeSingle() {
          const filtered = rows.filter((row) => filters.every((f) => f(row)));
          const resolved = filtered.length > 0 ? resolveJoins(filtered[0], selectStr, tables) : null;
          return { data: resolved, error: null };
        },
        then(resolve) {
          const filtered = rows.filter((row) => filters.every((f) => f(row)));
          const resolved = filtered.map((row) => resolveJoins(row, selectStr, tables));
          return Promise.resolve({ data: resolved, error: null }).then(resolve);
        },
      };

      return builder;
    },
  };
}
