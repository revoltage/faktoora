# Faktoora

Faktoora is a Convex-backed Vite app for managing invoice and Revolut statement workflows.

This project is connected to the Convex deployment named [`elegant-grasshopper-918`](https://dashboard.convex.dev/d/elegant-grasshopper-918).

## Project structure

The frontend code is in the `src` directory and is built with [Vite](https://vitejs.dev/).

The backend code is in the `convex` directory.

## Prerequisites

- Node.js 22 or newer
- pnpm 10.34.3 (`corepack enable && corepack prepare pnpm@10.34.3 --activate`)

## Developing and deploying your app

Install dependencies with `pnpm install`.

`pnpm dev` starts the frontend and backend development servers.

Useful checks:

- `pnpm typecheck`
- `pnpm lint`
- `pnpm format:check`
- `pnpm test`
- `pnpm build`

## App authentication

Faktoora uses [Convex Auth](https://auth.convex.dev/) with Anonymous auth for easy sign in. You may wish to change this before deploying your app.

## HTTP API

User-defined HTTP routes are defined in the `convex/router.ts` file. These routes are split from `convex/http.ts` so authentication routes stay isolated.
