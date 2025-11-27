# Polite Coaching Centre - Online Examination System

## Complete Project Documentation

**Version:** 1.0.0
**Last Updated:** November 2024
**Repository:** https://github.com/srksourabh/polite-exam

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [Project Structure](#3-project-structure)
4. [Database Schema](#4-database-schema)
5. [API Endpoints](#5-api-endpoints)
6. [User Flows](#6-user-flows)
7. [Security Features](#7-security-features)
8. [Environment Configuration](#8-environment-configuration)
9. [Deployment Guide](#9-deployment-guide)
10. [Testing Credentials](#10-testing-credentials)
11. [Features Summary](#11-features-summary)
12. [Known Limitations](#12-known-limitations)

---

## 1. Project Overview

### Purpose
A complete online examination platform for coaching centres with features for both administrators (exam creation, question management) and candidates (exam taking, result tracking).

### Key Capabilities
- **Admin Portal**: Manage questions, create exams, view results, AI-powered question generation
- **Candidate Portal**: Take exams, view results, track exam history
- **AI Integration**: Question extraction from images (OCR) and AI question generation
- **Real-time Monitoring**: System health dashboard with service status

---

## 2. Technology Stack

### Frontend
| Technology | Purpose |
|------------|---------|
| HTML5 | Structure and markup |
| CSS3 | Styling with custom properties |
| Vanilla JavaScript (ES6+) | Application logic |
| Flatpickr | Date picker component |
| Single Page Application | Architecture pattern |

### Backend
| Technology | Purpose |
|------------|---------|
| Node.js | Runtime environment |
| Vercel Serverless | Hosting platform |
| Express-style routing | API handling |

### Database
| Service | Purpose |
|---------|---------|
| Airtable | Cloud database |
| Personal Access Token | Authentication |

### External Services
| Service | Purpose |
|---------|---------|
| Gemini AI (gemini-2.0-flash-exp) | Question extraction & generation |
| OCR Space | Backup OCR service |

---

## 3. Project Structure

```
polite-exam/
├── index.html              # Main SPA frontend (UI + logic)
├── api/
│   └── index.js            # Serverless backend API
├── api-integration.js      # API client library
├── vercel.json             # Deployment configuration
├── package.json            # Node dependencies
├── .env.example            # Environment variable template
├── .gitignore              # Git ignore rules
├── create-test-candidate.js    # Test account utility
├── setup-sample-exams.js       # Sample data utility
└── Documentation files:
    ├── PROJECT_DOCUMENTATION.md  # This file
    ├── DESIGN_UPDATE_SUMMARY.md
    ├── IMPLEMENTATION_COMPLETE.md
    ├── IMPLEMENTATION_GUIDE.md
    ├── ENV_VARIABLES.md
    ├── QUICK_START.md
    ├── START_HERE.md
    └── README_NOW.md
```

### File Descriptions

| File | Lines | Description |
|------|-------|-------------|
| `index.html` | ~5,280 | Complete frontend SPA with HTML, CSS, and JavaScript |
| `api/index.js` | ~1,328 | Serverless API with all backend endpoints |
| `api-integration.js` | ~700 | Frontend API client with helper functions |
| `vercel.json` | 28 | Vercel deployment and routing configuration |
| `package.json` | 18 | Node.js dependencies (airtable, dotenv) |

---

## 4. Database Schema

### Airtable Base ID: `appYldhnqN8AdNgSF`

### Table: Questions

| Field | Type | Description |
|-------|------|-------------|
| ID | Text | Question identifier (Q0001 format) |
| Subject | Single Select | Category (Math, GK, Reasoning, English, Others) |
| Question | Long Text | Question text |
| Option A | Text | First choice |
| Option B | Text | Second choice |
| Option C | Text | Third choice |
| Option D | Text | Fourth choice |
| Correct | Single Select | Correct answer (A, B, C, D) |

### Table: Exams

| Field | Type | Description |
|-------|------|-------------|
| Exam Code | Text | Unique identifier |
| Title | Text | Display name |
| Duration (mins) | Number | Exam duration |
| Expiry (IST) | Date | Expiry date in IST |
| Questions | Linked Records | Links to Questions table |

### Table: Candidates

| Field | Type | Description |
|-------|------|-------------|
| Name | Text | Full name |
| Email | Email | Unique email address |
| Mobile | Text | 10-digit phone number |
| Password | Text | SHA256 hashed password |

### Table: Results

| Field | Type | Description |
|-------|------|-------------|
| Name | Text | Candidate name |
| Mobile | Text | Candidate mobile |
| Score | Number | Numerical score |
| Answers | Long Text | JSON string of answers |
| Exam | Linked Record | Link to Exams table |
| Exam Code | Text | Exam identifier |
| Total Questions | Number | Question count |
| Correct Answers | Number | Correct count |
| Wrong Answers | Number | Incorrect count |
| Percentage | Number | Score percentage |
| Time Taken | Number | Duration in seconds |
| Date | DateTime | Submission timestamp |
| Status | Text | Completion status |

---

## 5. API Endpoints

### Health & Status
```
GET /api/health
Returns: { airtable, gemini, ocr } status
```

### Questions Management
```
GET    /api/questions              # List all questions
POST   /api/questions              # Create new question
PUT    /api/questions/:id          # Update question
DELETE /api/questions/:id          # Delete question
POST   /api/questions/migrate      # Migrate ID format
```

### Exams Management
```
GET    /api/exams                  # List all exams
POST   /api/exams                  # Create new exam
GET    /api/exams/:code            # Get exam by code
POST   /api/admin/create-sample-exams  # Create sample data
```

### Authentication
```
POST   /api/auth/candidate/signup  # Candidate registration
POST   /api/auth/candidate/login   # Candidate login
POST   /api/auth/admin/login       # Admin login
POST   /api/auth/reset-password    # Password reset
```

### Candidate Profile
```
GET    /api/candidates/profile/:email  # Get profile
GET    /api/candidates/exams/:email    # Get exam history
```

### Results
```
POST   /api/results                # Submit result
GET    /api/results/:examCode      # Get results by exam
```

### AI Integration
```
POST   /api/gemini/extract-questions   # Extract from image
POST   /api/gemini/generate-question   # Generate question
```

### Response Format
```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Error message" }
```

### HTTP Status Codes
| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request |
| 401 | Unauthorized |
| 404 | Not Found |
| 429 | Rate Limited |
| 500 | Server Error |

---

## 6. User Flows

### Candidate Flow

```
┌─────────────────┐
│   Hero Landing  │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌───────┐ ┌────────┐
│Sign In│ │Sign Up │
└───┬───┘ └────┬───┘
    │          │
    └────┬─────┘
         ▼
┌─────────────────┐
│    Dashboard    │
│  (Exam History) │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Enter Exam     │
│  Code + Start   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Exam Screen    │
│  (MCQ + Timer)  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Result Screen  │
│  (Score + Log)  │
└─────────────────┘
```

### Admin Flow

```
┌─────────────────┐
│   Admin Login   │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Admin Dashboard │
│ (System Status) │
└────────┬────────┘
         │
    ┌────┼────┬────┬────┐
    ▼    ▼    ▼    ▼    ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│Q Bank││Create││Results││Upload││AI Gen│
│      ││ Exam │├──────┤│ OCR  ││      │
└──────┘└──────┘└──────┘└──────┘└──────┘
```

### Exam Taking Features
- Real-time countdown timer
- Auto-save every 30 seconds (localStorage)
- Auto-submit on time expiry
- Session tracking
- Resume exam on page reload (within 24 hours)

---

## 7. Security Features

### Authentication
| Feature | Implementation |
|---------|----------------|
| Password Hashing | SHA256 with salt |
| Admin Auth | Environment variable credentials |
| Rate Limiting | 5 attempts per 15 minutes (auth) |
| Rate Limiting | 100 requests per 15 minutes (general) |

### Data Protection
| Feature | Implementation |
|---------|----------------|
| XSS Prevention | HTML entity escaping |
| Input Validation | Format and length checks |
| CORS | Configurable allowed origins |

### Security Headers
```
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

---

## 8. Environment Configuration

### Required Variables

```bash
# Airtable Configuration
AIRTABLE_PERSONAL_ACCESS_TOKEN=pat_xxxxxxxxxxxxx
AIRTABLE_BASE_ID=appYldhnqN8AdNgSF

# AI Services
GEMINI_API_KEY=AIzaSyxxxxxxxxxxxxxxxxx
OCR_SPACE_API_KEY=K85624353188957

# Admin Credentials (optional - has defaults)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=politeadmin

# Security (optional)
PASSWORD_SALT=your_custom_salt
ALLOWED_ORIGINS=*
```

### Airtable Token Scopes
- `data.records:read`
- `data.records:write`
- `schema.bases:read`

---

## 9. Deployment Guide

### Vercel Deployment

1. **Push to GitHub**
   ```bash
   git add .
   git commit -m "Deploy"
   git push origin main
   ```

2. **Connect to Vercel**
   - Go to vercel.com
   - Import GitHub repository
   - Framework: Other

3. **Configure Environment Variables**
   - Add all variables from Section 8
   - Deploy

### vercel.json Configuration
```json
{
  "version": 2,
  "builds": [
    { "src": "api/index.js", "use": "@vercel/node" },
    { "src": "index.html", "use": "@vercel/static" },
    { "src": "api-integration.js", "use": "@vercel/static" }
  ],
  "routes": [
    { "src": "/api/(.*)", "dest": "/api/index.js" },
    { "src": "/(.*)", "dest": "/$1" }
  ]
}
```

---

## 10. Testing Credentials

### Default Admin
```
Username: admin
Password: politeadmin
```

### Test Candidate
```
Email: srksourabh@gmail.com
Password: soourabh
Mobile: 9999999999
```

### Sample Exams
| Exam Code | Duration | Questions |
|-----------|----------|-----------|
| MATH_BASICS_01 | 15 min | 5 |
| GK_TEST_01 | 10 min | 5 |
| REASONING_01 | 12 min | 5 |
| ENGLISH_01 | 10 min | 5 |
| MIXED_TEST_01 | 20 min | 10 |

---

## 11. Features Summary

### Candidate Features
| Feature | Status |
|---------|--------|
| User Registration | Implemented |
| User Login | Implemented |
| Password Reset | Implemented |
| Take Exams (MCQ + Timer) | Implemented |
| Auto-save Exam Progress | Implemented |
| Auto-submit on Timeout | Implemented |
| View Results | Implemented |
| View Exam History | Implemented |
| Session Management | Implemented |

### Admin Features
| Feature | Status |
|---------|--------|
| Secure Login | Implemented |
| System Status Dashboard | Implemented |
| Question Bank Management | Implemented |
| Add/Delete Questions | Implemented |
| Unique ID Generation | Implemented |
| Export Questions (CSV) | Implemented |
| Create Exams | Implemented |
| Flatpickr Date Picker | Implemented |
| View Results by Exam | Implemented |
| OCR Upload (Gemini Vision) | Implemented |
| AI Question Generation | Implemented |

### System Features
| Feature | Status |
|---------|--------|
| Real-time Status Monitoring | Implemented |
| Sample Data Creation | Implemented |
| Question Format Migration | Implemented |
| Rate Limiting | Implemented |
| Error Handling | Implemented |
| Responsive UI | Implemented |

---

## 12. Known Limitations

### Current Limitations
1. **Authentication**: No JWT tokens (stateless approach)
2. **Pagination**: Not implemented for large datasets
3. **Caching**: No client-side caching
4. **Negative Marking**: Not supported
5. **Section-wise Timing**: Not supported
6. **Email Notifications**: Not implemented

### Recommended Enhancements
1. Implement JWT-based authentication
2. Add pagination for questions/results
3. Implement client-side caching
4. Add comprehensive analytics dashboard
5. Email notification system
6. Question categories/tags
7. Negative marking support
8. Section-wise time allocation

---

## Appendix: Code Statistics

| Metric | Value |
|--------|-------|
| Total Lines (Frontend) | ~5,280 |
| Total Lines (Backend) | ~1,328 |
| Total Lines (API Client) | ~700 |
| Total Documentation | ~2,000+ |
| External Dependencies | 2 (airtable, dotenv) |

---

## Support & Feedback

For issues and feature requests, please visit:
https://github.com/srksourabh/polite-exam/issues

---

*Document generated for Polite Coaching Centre Online Examination System*
