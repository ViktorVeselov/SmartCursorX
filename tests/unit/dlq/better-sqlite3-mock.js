// Mock better-sqlite3 for test environment
class Statement {
  run(...args) { return { changes: 1, lastInsertRowid: 1 }; }
  get(...args) { return null; }
  all(...args) { return []; }
  bind(...args) { return this; }
}

class Database {
  constructor(path, options) {}
  prepare(sql) { return new Statement(); }
  exec(sql) {}
  close() {}
}

export default Database;
