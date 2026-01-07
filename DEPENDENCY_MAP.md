# Dependency Map - Polite Exam System

**Generated:** 2026-01-07

## File Dependency Chain

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER/BROWSER                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  index.html (133KB)                                             │
│  - Loads all CSS (styles.css, Tailwind CDN, DaisyUI CDN)        │
│  - Loads JS (app.js, api-integration.js, KaTeX CDN, Chart.js)   │
│  - Contains all HTML screens/sections                           │
│  - PWA manifest link                                            │
└─────────────────────────────────────────────────────────────────┘
                                │
                    ┌───────────┼───────────┐
                    ▼           ▼           ▼
┌──────────────┐ ┌──────────────┐ ┌──────────────────┐
│  styles.css  │ │   app.js     │ │ api-integration  │
│  (32KB)      │ │  (418KB)     │ │     .js (32KB)   │
│              │ │              │ │                  │
│  - Custom    │ │ - State mgmt │ │ - API calls      │
│  - Tailwind  │ │ - UI render  │ │ - Environment    │
│  - DaisyUI   │ │ - Exam logic │ │   detection      │
│    overrides │ │ - localStorage│ │ - Error handling│
└──────────────┘ └──────────────┘ └──────────────────┘
                        │                   │
                        │                   ▼
                        │         ┌──────────────────┐
                        │         │  api/index.js    │
                        │         │  (Vercel)        │
                        │         │                  │
                        │         │ - All endpoints  │
                        │         │ - Airtable CRUD  │
                        │         │ - Auth logic     │
                        │         │ - Email (SMTP)   │
                        │         │ - AI (Gemini)    │
                        │         └──────────────────┘
                        │                   │
                        │                   ▼
                        │         ┌──────────────────┐
                        │         │    AIRTABLE      │
                        │         │                  │
                        │         │ Tables:          │
                        │         │ - Questions      │
                        │         │ - Exams          │
                        │         │ - Candidates     │
                        │         │ - Results        │
                        │         └──────────────────┘
                        │
                        ▼
              ┌──────────────────┐
              │     sw.js        │
              │  (Service Worker)│
              │                  │
              │ - Cache strategy │
              │ - Offline support│
              │ - Asset caching  │
              └──────────────────┘

```

## Impact Analysis: What Breaks If Changed?

### index.html
| Change Type | Impact | Affected Components |
|-------------|--------|---------------------|
| Screen HTML structure | HIGH | app.js screen rendering, CSS selectors |
| Script load order | CRITICAL | App initialization, API availability |
| CDN links | HIGH | Styling (Tailwind/DaisyUI), Math (KaTeX) |
| Form IDs/classes | HIGH | app.js event handlers, form submissions |
| Button IDs | HIGH | All click handlers in app.js |

### app.js
| Change Type | Impact | Affected Components |
|-------------|--------|---------------------|
| State management | CRITICAL | All screens, data persistence |
| API call functions | CRITICAL | Data flow to/from backend |
| Screen navigation | HIGH | User flow, URL routing |
| Question rendering | HIGH | Exam display, answer selection |
| Timer logic | HIGH | Exam submission, auto-submit |
| localStorage keys | HIGH | Session persistence, exam state |

### api-integration.js
| Change Type | Impact | Affected Components |
|-------------|--------|---------------------|
| API_BASE_URL | CRITICAL | All API calls, local vs production |
| Endpoint paths | CRITICAL | app.js API consumers |
| Error handling | MEDIUM | User feedback, retry logic |
| Response parsing | HIGH | Data display in app.js |

### api/index.js
| Change Type | Impact | Affected Components |
|-------------|--------|---------------------|
| Endpoint routes | CRITICAL | api-integration.js, app.js |
| Airtable field names | CRITICAL | Data CRUD, all features |
| Auth logic | CRITICAL | Login, session management |
| Response format | HIGH | Frontend data consumption |
| CORS headers | CRITICAL | Browser security, requests |

### styles.css
| Change Type | Impact | Affected Components |
|-------------|--------|---------------------|
| Class names | MEDIUM | HTML elements, JS classList |
| Layout rules | MEDIUM | Screen appearance |
| Responsive rules | MEDIUM | Mobile display |
| Animation classes | LOW | UI transitions |

### sw.js
| Change Type | Impact | Affected Components |
|-------------|--------|---------------------|
| Cache name | MEDIUM | Cache invalidation |
| Cached routes | MEDIUM | Offline availability |
| Network strategy | MEDIUM | Performance, freshness |

### manifest.json
| Change Type | Impact | Affected Components |
|-------------|--------|---------------------|
| App name | LOW | Installed app display |
| Icons | MEDIUM | PWA icon display |
| Theme color | LOW | Browser UI color |
| Start URL | MEDIUM | PWA launch point |

## Critical Constants

### app.js
- `APP_VERSION` - Cache busting
- Screen state names
- localStorage key names
- Timer intervals

### api-integration.js
- `API_BASE_URL` - Backend URL
- Environment detection logic

### api/index.js
- Airtable table names
- Airtable field mappings
- Admin credentials check
- Password salt

## Shared Data Contracts

### localStorage Keys (app.js ↔ Browser)
| Key | Purpose | Set By | Read By |
|-----|---------|--------|---------|
| candidate | User session | auth flow | all screens |
| currentExam | Active exam data | exam start | exam screen |
| examState | Answers, time left | exam screen | resume logic |
| examResults | Completed exam | submit | results screen |

### API Request/Response (app.js ↔ api/index.js)
| Endpoint | Request | Response |
|----------|---------|----------|
| /api/login | {email, password} | {candidate} |
| /api/signup | {name, email, password} | {candidate} |
| /api/exams | - | [{exam}] |
| /api/questions | {examId} | [{question}] |
| /api/submit | {candidateId, examId, answers, timeTaken} | {result} |

---
*Last Updated: 2026-01-07*
