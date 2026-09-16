type StoredDoc = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

type Seed = Record<string, Array<Record<string, unknown> & { _id: string }>>;
type Identity = { subject: string } | null;
type Predicate = (doc: StoredDoc) => boolean;

function cloneTables(tables: Map<string, Map<string, StoredDoc>>) {
  const copy = new Map<string, Map<string, StoredDoc>>();
  for (const [table, rows] of tables)
    copy.set(
      table,
      new Map(
        [...rows].map(([id, row]) => [id, structuredClone(row)]),
      ),
    );
  return copy;
}

class IndexFilter {
  readonly predicates: Predicate[] = [];

  eq(field: string, value: unknown) {
    this.predicates.push((doc) => doc[field] === value);
    return this;
  }
}

class FilterExpression {
  field(name: string) {
    return (doc: StoredDoc) => doc[name];
  }

  eq(left: unknown, right: unknown): Predicate {
    return (doc) => this.value(left, doc) === this.value(right, doc);
  }

  neq(left: unknown, right: unknown): Predicate {
    return (doc) => this.value(left, doc) !== this.value(right, doc);
  }

  and(...predicates: Predicate[]): Predicate {
    return (doc) => predicates.every((predicate) => predicate(doc));
  }

  or(...predicates: Predicate[]): Predicate {
    return (doc) => predicates.some((predicate) => predicate(doc));
  }

  private value(value: unknown, doc: StoredDoc) {
    return typeof value === "function"
      ? (value as (doc: StoredDoc) => unknown)(doc)
      : value;
  }
}

class Query {
  private predicates: Predicate[] = [];
  private direction: "asc" | "desc" = "asc";

  constructor(private readonly rows: Map<string, StoredDoc>) {}

  withIndex(_indexName: string, build: (filter: IndexFilter) => unknown) {
    const filter = new IndexFilter();
    build(filter);
    this.predicates.push(...filter.predicates);
    return this;
  }

  filter(build: (expression: FilterExpression) => Predicate) {
    this.predicates.push(build(new FilterExpression()));
    return this;
  }

  order(direction: "asc" | "desc") {
    this.direction = direction;
    return this;
  }

  async collect() {
    return this.results();
  }

  async first() {
    return this.results()[0] ?? null;
  }

  async unique() {
    const results = this.results();
    if (results.length > 1) throw new Error("Query returned more than one row.");
    return results[0] ?? null;
  }

  async take(count: number) {
    return this.results().slice(0, count);
  }

  private results() {
    const direction = this.direction === "asc" ? 1 : -1;
    return [...this.rows.values()]
      .filter((doc) => this.predicates.every((predicate) => predicate(doc)))
      .sort((left, right) =>
        direction * (left._creationTime - right._creationTime),
      )
      .map((doc) => structuredClone(doc));
  }
}

export type FailurePoint = {
  operation: "insert" | "patch";
  table: string;
  occurrence?: number;
  error?: Error;
};

/**
 * A narrow Convex database test double with transaction commit and rollback.
 * Transactions enter through one queue, so competing calls observe a serial
 * database history, as successful Convex mutation retries do.
 */
export class InMemoryConvex {
  private tables = new Map<string, Map<string, StoredDoc>>();
  private nextId = 1;
  private queue: Promise<void> = Promise.resolve();

  constructor(seed: Seed) {
    let creationTime = 1;
    for (const [table, docs] of Object.entries(seed))
      this.tables.set(
        table,
        new Map(
          docs.map((doc) => [
            doc._id,
            { ...structuredClone(doc), _creationTime: creationTime++ },
          ]),
        ),
      );
  }

  async transaction<Result>(
    identity: Identity,
    handler: (ctx: unknown) => Promise<Result>,
    failure?: FailurePoint,
  ): Promise<Result> {
    let release!: () => void;
    const turn = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.queue;
    this.queue = previous.then(() => turn);
    await previous;

    const working = cloneTables(this.tables);
    const nextIdAtStart = this.nextId;
    const operationCounts = new Map<string, number>();
    const failIfRequested = (operation: "insert" | "patch", table: string) => {
      const key = `${operation}:${table}`;
      const occurrence = (operationCounts.get(key) ?? 0) + 1;
      operationCounts.set(key, occurrence);
      if (
        failure?.operation === operation &&
        failure.table === table &&
        occurrence === (failure.occurrence ?? 1)
      )
        throw failure.error ?? new Error(`Injected ${operation} failure for ${table}.`);
    };
    const find = (id: string) => {
      for (const [table, rows] of working) {
        const row = rows.get(id);
        if (row !== undefined) return { table, rows, row };
      }
      return null;
    };
    const db = {
      get: async (id: string) => {
        const found = find(id);
        return found === null ? null : structuredClone(found.row);
      },
      query: (table: string) =>
        new Query(working.get(table) ?? new Map<string, StoredDoc>()),
      insert: async (table: string, value: Record<string, unknown>) => {
        failIfRequested("insert", table);
        const id = `${table}:generated-${this.nextId++}`;
        const rows = working.get(table) ?? new Map<string, StoredDoc>();
        working.set(table, rows);
        rows.set(id, {
          ...structuredClone(value),
          _id: id,
          _creationTime: Date.now() + this.nextId,
        });
        return id;
      },
      patch: async (id: string, value: Record<string, unknown>) => {
        const found = find(id);
        if (found === null) throw new Error(`Cannot patch missing row ${id}.`);
        failIfRequested("patch", found.table);
        found.rows.set(id, {
          ...found.row,
          ...structuredClone(value),
        });
      },
      replace: async (id: string, value: Record<string, unknown>) => {
        const found = find(id);
        if (found === null) throw new Error(`Cannot replace missing row ${id}.`);
        found.rows.set(id, {
          ...structuredClone(value),
          _id: id,
          _creationTime: found.row._creationTime,
        });
      },
      delete: async (id: string) => {
        const found = find(id);
        if (found !== null) found.rows.delete(id);
      },
    };

    try {
      const result = await handler({
        auth: { getUserIdentity: async () => identity },
        db,
      });
      this.tables = working;
      return result;
    } catch (error) {
      this.nextId = nextIdAtStart;
      throw error;
    } finally {
      release();
    }
  }

  all(table: string) {
    return [...(this.tables.get(table)?.values() ?? [])].map((doc) =>
      structuredClone(doc),
    );
  }

  get(id: string) {
    for (const rows of this.tables.values()) {
      const row = rows.get(id);
      if (row !== undefined) return structuredClone(row);
    }
    return null;
  }
}
