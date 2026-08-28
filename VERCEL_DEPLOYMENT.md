# Alpha Market GitHub and Vercel handoff

## Repository preparation

This repository contains the existing Alpha Market Vite + Express + tRPC + Drizzle/MySQL application. The checked-in `vercel.env.example` is a secret-free environment template. The environment file named `.env.example` is intentionally not created by the managed workspace; copy `vercel.env.example` to `.env.example` locally if your tooling requires that exact filename. Never commit a populated environment file.

The current application is configured for the existing managed Express host. A plain Vercel import may require a Vercel-compatible Express/serverless adapter and database connection review; do not replace the MySQL/TiDB `DATABASE_URL` with a PostgreSQL or Supabase URL, and do not enable unsupported `NEXT_PUBLIC_SITE_URL` or `BYPASS_KYC_TEST_MODE` settings. The repository is prepared for source control, but this document does not claim that a direct Vercel import is a tested production deployment.

## Push the private repository

The current repository already has a private GitHub remote configured as `user_github`. If you are working from a fresh local clone, use these commands with your private repository URL:

```bash
git init
git branch -M main
git remote add origin https://github.com/azralpha/alpha-collective.git
git add .
git commit -m "feat: prepare for initial Vercel production deployment"
git push -u origin main
```

If `origin` already exists, update it rather than adding a duplicate:

```bash
git remote set-url origin https://github.com/azralpha/alpha-collective.git
git push -u origin main
```

When Git prompts for credentials, use your GitHub username and a GitHub Personal Access Token as the password. Do not paste a PAT into source files, `.env.example`, chat, or a remote URL. The managed workspace uses its preconfigured GitHub authentication and does not require you to provide a PAT here.

## Vercel environment settings

In Vercel, import the private repository, choose the `main` branch, and add the keys from `vercel.env.example` to the appropriate environment scopes. Keep server-only credentials out of `VITE_*` variables. Set `PUBLIC_APP_URL` only to a domain that is actually configured for the running deployment. Leave provider test flags, payment credentials, KYC settings, and newsletter sending disabled until their callback and deployment paths have been separately reviewed.
