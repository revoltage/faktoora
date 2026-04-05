# AGENTS.md - Coding Guidelines for Agentic Agents

This is a React + TypeScript + Vite + Convex full-stack application.

## Build, Lint, and Test Commands

```bash
# Development (runs frontend + backend in parallel)
npm run dev

# Build for production
npm run build

# Lint (TypeScript check + Convex check + Vite build)
npm run lint

# No test runner configured currently
```

## Package Manager

Use `npm` (or `pnpm` if available). Do NOT use yarn.

## Project Structure

- `src/` - Frontend React application
  - `components/ui/` - Shadcn/ui components (do not modify)
  - `components/` - Custom React components
  - `pages/` - Page-level components
  - `hooks/` - Custom React hooks
  - `lib/utils.ts` - Utility functions (cn() for Tailwind)
- `convex/` - Backend Convex functions
  - `schema.ts` - Database schema definitions
  - `*.ts` - Query/mutation/action functions
  - `_generated/` - Auto-generated (do not edit)

## Import Patterns

### Frontend

```typescript
// Path aliases
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { api } from "../convex/_generated/api";

// External imports first, then internal
import React from "react";
import { useQuery } from "convex/react";
import { MyComponent } from "@/components/MyComponent";
```

### Backend (Convex)

```typescript
import { v } from "convex/values";
import { query, mutation, internalMutation, action } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { getAuthUserId } from "@convex-dev/auth/server";
```

## Code Style Guidelines

### TypeScript

- Strict mode enabled
- Explicit return types on Convex functions (via `returns:` validator)
- Use `type` for type aliases (not `interface`)
- Allow `any` types currently (relaxed ESLint rules)
- Use `as const` for string literals in discriminated unions

### Convex Functions

ALWAYS use the new function syntax with validators:

```typescript
export const myFunction = query({
  args: { name: v.string() },
  returns: v.null(), // Always include returns validator
  handler: async (ctx, args) => {
    // Function body
    return null;
  },
});
```

- Public functions: `query`, `mutation`, `action`
- Internal functions: `internalQuery`, `internalMutation`, `internalAction`
- Always include both `args` and `returns` validators
- If no return value, use `returns: v.null()`

### Naming Conventions

- Components: PascalCase (e.g., `Button.tsx`, `InvoiceList.tsx`)
- Functions: camelCase
- Convex functions: camelCase (e.g., `generateUploadUrl`)
- Files: PascalCase for components, camelCase for utilities
- Database tables: camelCase (e.g., `userSettings`, `featureFlags`)

### React Components

- Use functional components with hooks
- Forward refs using `React.forwardRef`
- Use destructured props
- Display name on forwarded components

### Error Handling

- Throw errors in Convex functions for unexpected failures
- Return null/optional values for "not found" cases
- Use try/catch for storage operations

### Database Queries

- Use `withIndex()` instead of `filter()` for performance
- Use `.unique()` for single document queries
- Use `.collect()` or `.take(n)` for multiple results
- Order matters for index queries

## Convex Schema Guidelines

- Define schema in `convex/schema.ts`
- Import from `convex/server` and `convex/values`
- Use `v.id("tableName")` for references
- Index naming: "by_field1_and_field2" for index on ["field1", "field2"]
- Use `v.optional()` for nullable fields

## Styling

- Tailwind CSS v3
- Use `cn()` utility from `@/lib/utils` for conditional classes
- Follow Shadcn/ui component patterns
- Use `class-variance-authority` for component variants

## Git Guidelines

From CLAUDE.md:

- Use atomic commits: each task gets its own commit
- Keep commits focused and single-purpose
- Commit proactively and push after the last commit

## Important Notes

- NEVER modify files in `convex/_generated/` - they are auto-generated
- NEVER modify files in `src/components/ui/` - they are Shadcn/ui components
- Use `Id<'tableName'>` type for document IDs (not `string`)
- Convex actions using Node.js modules need `"use node";` at the top
- For file storage, use `ctx.storage` methods

## Resources

- [Convex Rules](./.cursor/rules/convex_rules.mdc) - Comprehensive Convex guidelines
- [Convex Docs](https://docs.convex.dev/)
- [Shadcn/ui Docs](https://ui.shadcn.com/)
