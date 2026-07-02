module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testTimeout: 15000,
  setupFiles: ["<rootDir>/jest.setup.ts"],
  // Without this, `npm run build`'s compiled output under dist/ (which
  // includes the compiled .test.js files too — tsc doesn't know which .ts
  // files are tests) gets picked up alongside the real .ts sources, running
  // every test twice and causing duplicate-manual-mock warnings for arctic.
  testPathIgnorePatterns: ["/node_modules/", "<rootDir>/dist/"],
  // arctic (OAuth client lib) ships ESM-only; Jest can't load it transitively
  // through app.ts without a full ESM pipeline. Redirect it to a stub —
  // see src/__mocks__/arctic.ts for why that's safe.
  moduleNameMapper: {
    "^arctic$": "<rootDir>/src/__mocks__/arctic.ts",
  },
  // DB-backed test files share one fancall_test database and truncate
  // tables between tests. Running files in parallel workers would let one
  // file's truncate wipe rows another file is mid-assertion on. Serializing
  // is cheap here (whole suite runs in seconds); correctness > speed.
  maxWorkers: 1,
};

