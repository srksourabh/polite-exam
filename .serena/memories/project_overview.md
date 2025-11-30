# Polite Exam - Project Overview

## Purpose
Polite Coaching Centre - Complete Exam Management System
- Web-based exam platform with Android app support via Capacitor
- Handles question banks, exam creation, candidate management, and result tracking
- Integrated with Airtable for database backend

## Tech Stack
- **Frontend**: Plain HTML/CSS/JavaScript (Single Page Application)
- **Backend**: Airtable API integration via serverless functions
- **Mobile**: Capacitor for Android app wrapping
- **Deployment**: Vercel for web hosting
- **PWA**: Service Worker (sw.js) for offline capabilities

## Key Files
- `index.html` - Main application file (~262KB, single-file SPA)
- `api/index.js` - Serverless API endpoints for Airtable integration
- `manifest.json` - PWA manifest
- `sw.js` - Service worker for PWA functionality
- `package.json` - Dependencies and build scripts

## Project Structure
- `/api` - Serverless API functions
- `/android` - Capacitor Android project
- `/docs` - Documentation
- `/icons` - App icons
- `/scripts` - Build scripts
- `/www` - Compiled web assets for Capacitor

## Current Issues to Fix
1. Marks calculation not working correctly
2. Answer selection UI needs radio buttons
3. Question bank needs sanitization and pagination
4. Candidate section needs email authentication (no mobile auth)
