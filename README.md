# Rslib TypeScript Declaration Generation Issue


## Reproduction Steps

### Local Reproduction

1. Install dependencies:
   ```bash
   cd repro
   pnpm install
   ```

2. First, verify TypeScript project references work correctly:
   ```bash
   pnpm runtsc
   ```
   This runs `pnpm --filter pkg-b run tsc:build` which executes `tsc --build`.

   **Expected result**: ✅ Success (no output means success)
   - TypeScript project references are configured correctly
   - pkg-b can find pkg-a and pkg-a/schemas type definitions via project references

3. Then reproduce the rslib issue:
   ```bash
   pnpm repro
   ```
   This runs `pnpm --filter pkg-b run build` which executes `rslib build`.

   **Expected result**: ❌ Fails with TS2307 errors:
   ```
   error [tsc] Cannot find module 'pkg-a' or its corresponding type declarations.
   error [tsc] Cannot find module 'pkg-a/schemas' or its corresponding type declarations.
   ```

   This demonstrates that rslib cannot resolve workspace packages via project references, even though the same configuration works with TypeScript's `tsc --build`.
