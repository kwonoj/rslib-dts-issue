# Rslib TypeScript Declaration Generation Issue

[![Reproduce Issue](https://github.com/USERNAME/REPO/actions/workflows/reproduce-issue.yml/badge.svg)](https://github.com/USERNAME/REPO/actions/workflows/reproduce-issue.yml)

This is a minimal reproduction of TypeScript errors when building with rslib in a monorepo with TypeScript project references and package subpath exports.

> **Note**: Replace `USERNAME/REPO` in the badge URL above with your actual GitHub repository path.

## Structure

```
repro/
├── packages/
│   ├── tsconfig/                # Shared TypeScript config
│   │   ├── package.json
│   │   └── tsconfig.base.json
│   ├── pkg-a/                   # Dependency package with subpath exports
│   │   ├── package.json         # Exports: "." and "./schemas"
│   │   ├── tsconfig.json        # For tsc --build (with paths)
│   │   ├── tsconfig.rslib.json  # For rslib (without paths, project refs only)
│   │   ├── rslib.config.ts      # Uses tsconfig.rslib.json
│   │   └── src/
│   │       ├── index.ts
│   │       └── schemas/
│   │           └── index.ts
│   └── pkg-b/                   # Package that depends on pkg-a
│       ├── package.json
│       ├── tsconfig.json        # For tsc --build (with paths)
│       ├── tsconfig.rslib.json  # For rslib (without paths, project refs only)
│       ├── rslib.config.ts      # Uses tsconfig.rslib.json
│       └── src/
│           └── index.ts         # Imports from 'pkg-a' and 'pkg-a/schemas'
├── package.json
└── pnpm-workspace.yaml
```

### TypeScript Configuration Strategy

Each package has **two TypeScript configurations** following best practices:

1. **`tsconfig.json`**: Base configuration used by `tsc --build`
   - Extends `../tsconfig/tsconfig.base.json`
   - Includes `paths` mapping for workspace packages
   - Outputs to `dist/tsc/`
   - Works correctly with TypeScript project references

2. **`tsconfig.rslib.json`**: rslib-specific configuration
   - **Extends `./tsconfig.json`** (inherits all settings from the base config)
   - Used by rslib via `source.tsconfigPath` in `rslib.config.ts`
   - Overrides `outDir`, `declarationDir`, and `tsBuildInfoFile` to use `dist/rslib-tsc/`
   - In `pkg-b`: Overrides `paths` to `{}` (empty) to remove path mappings
   - **Only** uses TypeScript project references (no custom `paths`)
   - Demonstrates that rslib cannot resolve workspace packages via project references alone

**Why this inheritance pattern?**
- Follows DRY principle - shared settings defined once in `tsconfig.json`
- `tsconfig.rslib.json` only contains rslib-specific overrides
- Makes it clear what's different between tsc and rslib builds
- Easier to maintain - changes to base config automatically apply to both

This dual-config approach proves that:
- TypeScript can resolve workspace packages using project references + paths
- rslib fails to resolve the same packages even with project references configured
- The issue is specific to rslib's handling of TypeScript project references

## Issue

When running `npx rslib build` in `packages/pkg-b`, TypeScript cannot find module declarations for:
- `pkg-a`
- `pkg-a/schemas`

This happens even though:
1. TypeScript project references are configured
2. Package exports are properly defined in package.json
3. The same structure works in the actual monorepo before running rslib

## Expected Errors

```
error   [tsc] Cannot find module 'pkg-a' or its corresponding type declarations.
error   [tsc] Cannot find module 'pkg-a/schemas' or its corresponding type declarations.
```

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

### GitHub Actions (CI)

A GitHub Actions workflow is included that runs both tests in parallel to demonstrate the issue:

```
┌─────────────────────────────────────────┐
│  Reproduce rslib TypeScript Issue       │
│  (Runs in Parallel)                     │
└─────────────────────────────────────────┘
           │
           ├──────────────────────┬──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │ typescript-build │  │  rslib-build     │  │    summary       │
  │                  │  │                  │  │                  │
  │ pnpm runtsc      │  │ pnpm repro       │  │ Check results    │
  │                  │  │                  │  │                  │
  │ ✅ SUCCESS       │  │ ❌ FAILS         │  │ Report status    │
  │ (as expected)    │  │ (as expected)    │  │                  │
  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

**Jobs:**
- **`typescript-build`**: Runs `pnpm runtsc` and verifies TypeScript build succeeds
- **`rslib-build`**: Runs `pnpm repro` and verifies rslib build fails as expected
  (uses `continue-on-error: true` to validate the failure is expected)
- **`summary`**: Aggregates results from both jobs and confirms the issue is reproduced

**Triggers:**
- Push to `main` or `master` branches
- Pull requests
- Manual workflow dispatch

**View the workflow:** `.github/workflows/reproduce-issue.yml`

## Root Cause

The issue is that **rslib's TypeScript declaration generation doesn't properly handle TypeScript project references** combined with package subpath exports.

### Key Findings

1. **TypeScript (`tsc --build`) works correctly**:
   - When running `pnpm runtsc`, TypeScript successfully builds pkg-b
   - TypeScript properly resolves pkg-a and pkg-a/schemas using project references and paths configuration
   - Declarations are generated in `dist/tsc/` for both packages

2. **rslib fails**:
   - When running `pnpm repro`, rslib fails to build pkg-b
   - Even after pkg-a is successfully built, rslib's TypeScript invocation reports:
     ```
     error TS6305: Output file '.../pkg-a/dist/tsc/index.d.ts' has not been built from source file
     ```
   - This suggests rslib doesn't properly coordinate with TypeScript's composite build system

### Technical Details

**Configuration Differences:**

| Feature | tsconfig.json (tsc) | tsconfig.rslib.json (rslib) |
|---------|---------------------|------------------------------|
| Project References | ✅ Yes | ✅ Yes |
| Path Mappings | ✅ Yes (`paths`) | ❌ No |
| Output Directory | `dist/tsc/` | `dist/rslib-tsc/` |
| tsBuildInfoFile | `dist/tsc/*.tsbuildinfo` | `dist/rslib-tsc/*.tsbuildinfo` |
| Result | ✅ Success | ❌ Fails with TS2307 |

**Key Points:**
- Both configs extend the same base configuration
- Both configs use TypeScript project references
- **Only difference**: `tsconfig.json` includes `paths` mapping, `tsconfig.rslib.json` does not
- **rslib requirement**: The `source.tsconfigPath` in rslib.config.ts points to `tsconfig.rslib.json`

**Why this demonstrates the bug:**
- TypeScript's `tsc --build` can resolve workspace packages using **just project references + paths**
- rslib fails even with project references, suggesting it doesn't properly handle:
  - TypeScript composite builds
  - Workspace package resolution via package.json exports
  - Project reference dependency resolution

## Verification

**Running `pnpm runtsc`** (TypeScript with project references):
```bash
$ pnpm runtsc

> repro-rslib-dts@ runtsc
> pnpm --filter pkg-b run tsc:build

> pkg-b@0.0.0 tsc:build
> tsc --build
```
✅ **Success** - No errors, exits with code 0

**Running `pnpm repro`** (rslib with project references):
```bash
$ pnpm repro

> repro-rslib-dts@ repro
> pnpm --filter pkg-b run build

> pkg-b@0.0.0 build
> rslib build

error   [tsc] src/index.ts:1:37 - error TS2307: Cannot find module 'pkg-a'
error   [tsc] src/index.ts:2:40 - error TS2307: Cannot find module 'pkg-a/schemas'
error   Failed to generate declaration files.
```
❌ **Fails** - Cannot resolve workspace packages

This demonstrates that the TypeScript configuration is correct, but rslib cannot properly use it for declaration generation.

## CI/CD Integration

The GitHub Actions workflow provides automated validation of this issue:

1. **Parallel Execution**: Both TypeScript and rslib builds run simultaneously
2. **Expected Behavior Validation**:
   - TypeScript job must succeed (proves config is correct)
   - rslib job must fail (demonstrates the bug)
   - Summary job validates both outcomes
3. **Continuous Verification**: Any changes to the repository will re-run these tests
4. **Public Demonstration**: Anyone can see the issue reproduced in GitHub Actions logs

This setup is ideal for:
- Reporting the issue to rslib maintainers with CI evidence
- Tracking when/if the issue gets fixed (workflow will detect when rslib starts working)
- Documenting the exact conditions that trigger the bug
