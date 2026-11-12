jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest'),
);

// The native SQLite module doesn't exist under Jest. Every open() gets a fresh
// in-memory database backed by a real SQLite engine.
jest.mock('@op-engineering/op-sqlite', () => ({
  open: () => require('./test-utils/nodeSqlite').openMemoryDb(),
}));
