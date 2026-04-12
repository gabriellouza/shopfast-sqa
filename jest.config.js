/**
 * jest.config.js
 *
 * QUALITY GATE — REGRA 1 (IEEE 730-2014, §5.3.3):
 * Cobertura minima de 90% em branches para src/services/
 * Pipeline falha automaticamente se threshold nao atingido.
 */

module.exports = {
  testEnvironment: "node",
  testMatch: ["**/tests/**/*.test.js"],
  collectCoverage: true,
  collectCoverageFrom: ["src/**/*.js"],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],

  /**
   * ENFORCEMENT AUTOMATICO — Quality Gate
   * Se qualquer threshold nao for atingido, jest retorna exit code 1
   * e o pipeline de CI bloqueia o merge automaticamente.
   */
  coverageThreshold: {
    "./src/services/": {
      branches: 90,
      functions: 90,
      lines: 90,
      statements: 90
    },
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
