# Invoice Manager App

This is a project built with [Chef](https://chef.convex.dev) using [Convex](https://convex.dev) as its backend.
You can find docs about Chef with useful information like how to deploy to production [here](https://docs.convex.dev/chef).

This project is connected to the Convex deployment named [`elegant-grasshopper-918`](https://dashboard.convex.dev/d/elegant-grasshopper-918).

## Project structure

The frontend code is in the `app` directory and is built with [Vite](https://vitejs.dev/).

The backend code is in the `convex` directory.

`npm run dev` will start the frontend and backend servers.

## App authentication

Chef apps use [Convex Auth](https://auth.convex.dev/) with Anonymous auth for easy sign in. You may wish to change this before deploying your app.

## Developing and deploying your app

Check out the [Convex docs](https://docs.convex.dev/) for more information on how to develop with Convex.

- If you're new to Convex, the [Overview](https://docs.convex.dev/understanding/) is a good place to start
- Check out the [Hosting and Deployment](https://docs.convex.dev/production/) docs for how to deploy your app
- Read the [Best Practices](https://docs.convex.dev/understanding/best-practices/) guide for tips on how to improve you app further

## Uploading via API

Upload invoices and statements programmatically using API keys.

Quick start:

```bash
# 1. Get a signed upload URL
UPLOAD_URL=$(curl -sS -X POST "https://<your-deployment>.convex.site/api/v1/upload-url" \
  -H "Authorization: Bearer sk_faktoora_..." \
  -d '{"kind":"invoice"}' | jq -r '.uploadUrl')

# 2. Upload file directly
STORAGE_ID=$(curl -sS -X POST "$UPLOAD_URL" \
  -H "Content-Type: application/pdf" \
  --data-binary "@invoice.pdf" | jq -r '.storageId')

# 3. Register it
curl -sS -X POST "https://<your-deployment>.convex.site/api/v1/invoices" \
  -H "Authorization: Bearer sk_faktoora_..." \
  -d "{\"monthKey\":\"2026-02\",\"storageId\":\"$STORAGE_ID\",\"fileName\":\"invoice.pdf\"}"
```

See `HEADLESS_API.md` for full details.

## HTTP API

User-defined http routes are defined in the `convex/router.ts` file. We split these routes into a separate file from `convex/http.ts` to allow us to prevent the LLM from modifying the authentication routes.
