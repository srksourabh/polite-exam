# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Polite Exam is an exam management system for an online coaching centre. It's a full-stack PWA with an Android app built via Capacitor.

**Tech Stack:**
- Frontend: Vanilla JS (~8,500 lines in app.js), HTML5, Tailwind CSS + DaisyUI
- Backend: Vercel Serverless Functions (Node.js) with Airtable as database
- Mobile: Capacitor v6 for Android
- Features: PWA with offline support, LaTeX/KaTeX for math expressions, Chart.js for visualization

## Commands

```bash
# Build for Android (copies files to www/)
npm run build

# Sync web files to Android project
npm run cap:sync

# Full Android build pipeline
npm run android:build

# Build and open in Android Studio
npm run android:studio
```

No test suite is configured. The `npm test` command is a placeholder.

## Architecture

### Key Files
- `app.js` - Core application logic: screen management, exam rendering, state handling, rich content parsing
- `api/index.js` - All API endpoints: Airtable CRUD operations, authentication, AI question generation
- `api-integration.js` - API client layer with environment detection (local vs deployed)
- `index.html` - Single-page app shell with all HTML screens
- `sw.js` - Service Worker for PWA caching

### Screen States (in app.js)
The app uses a state machine with screens: `hero-landing`, `auth`, `dashboard`, `exam`, `results`, `admin`

### Rich Content Syntax
Questions support special syntax parsed by app.js:
- LaTeX math: `$x^2 + y^2$`
- Images: `[img:URL]`
- Graphs: `[graph:type:data]`
- Tables: `[table:headers|rows]`

### Data Model (Airtable)
Tables: `Questions`, `Exams`, `Results`, `Candidates`

Questions support parent-child relationships for hierarchical display.

## Branch Strategy

| Branch | Purpose | Deploys To |
|--------|---------|------------|
| `main` | Production only | polite-exam.vercel.app |
| `beta` | Development & testing | Vercel preview URLs |

**Workflow:** Always push to `beta` first, test on preview URL, then create PR to `main`.

Never push directly to `main`.

## Environment Variables

Required in `.env` (see `.env.example`):
- `AIRTABLE_PERSONAL_ACCESS_TOKEN`, `AIRTABLE_BASE_ID` - Database access
- `GEMINI_API_KEY` - AI question generation
- `SMTP_*` - Email verification (Nodemailer)
- `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `PASSWORD_SALT` - Authentication

## Android Build

The Capacitor build copies web files to `www/` directory, then syncs to the `android/` project. Open in Android Studio for APK/AAB generation.

App ID: `com.politecoaching.exam`
