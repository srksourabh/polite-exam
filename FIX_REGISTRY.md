# Fix Registry

Track all fixes applied to the Polite Exam system.

## Status Legend
- `pending` - Issue identified, fix planned
- `in-progress` - Fix being applied
- `completed` - Fix applied and tested
- `rolled-back` - Fix reverted due to issues

## Fix ID Ranges
- F001-F099: P0 Critical
- F100-F199: P1 High
- F200-F299: P2 Medium
- F300+: P3 Low

## Registry

| Fix ID | File | Line(s) | Issue | Status | Dependencies | Rollback |
|--------|------|---------|-------|--------|--------------|----------|
| F100 | app.js | 8162-8163 | Double-click handler conflict causes answer deselection (marks = 0) | completed | None | Restore from backup |
| F101 | app.js | 4447-4821 | Duplicate event listeners in create-exam (5 questions → 15) | completed | None | Restore from backup |
| F200 | android/app/src/main/assets/public/app.js | 16 | Version mismatch: APP_VERSION='2.2.0' should be '3.1.1' | pending | None | Restore from backup |
| F201 | sw.js, app.js | 3, 16 | Version sync: CACHE_VERSION pattern differs from APP_VERSION | pending | None | Restore from backup |
| F202 | api/index.js | 782-849 | Hardcoded admin fallback 'admin'/'politeadmin' | completed | Requires 'Role' field in Candidates table | Restore from backup |
| F203 | app.js | 1859 | Hardcoded API URL fallback should use api-integration.js | pending | api-integration.js | Restore from backup |
| F300 | root | - | Staging files: push_app.txt, push_index.txt (cleanup) | pending | None | git restore |
| F301 | root | - | Orphan file: 'nul' (cleanup) | pending | None | None |
| F302 | api/index.js | 1263-1287 | Email verification stubs (not functional) | pending | SMTP configuration | Restore from backup |
| F102 | api/index.js | 970-977 | Candidate signup fails - 'Verified'/'Created At' fields don't exist | completed | None | Restore from backup |

## Rollback Commands

### General Rollback
```bash
# Restore single file from git
git checkout HEAD -- <file_path>

# Restore from backup
cp <file>.backup.YYYYMMDD <file>
```

### F200 Rollback
```bash
git checkout HEAD -- android/app/src/main/assets/public/app.js
```

### F201 Rollback
```bash
git checkout HEAD -- sw.js app.js
```

### F202 Rollback
```bash
git checkout HEAD -- api/index.js
```

### F100 Rollback
```bash
git checkout HEAD -- app.js
```

### F203 Rollback
```bash
git checkout HEAD -- app.js
```

---

## Completed Fixes

### F101 - Duplicate Event Listener Fix (2026-01-07)
**File:** app.js
**Lines:** 4447-4821
**Priority:** P1 High (Critical bug affecting exam creation)

**Problem:** Event listeners for buttons inside `create-exam-btn` click handler were being attached every time user clicked "Create Exam". Each click added another listener:
- Click 1: 1 listener
- Click 2: 2 listeners
- Click 3: 3 listeners → Random 5 becomes 15!

**Affected Buttons:**
- `random-select-btn` (main culprit)
- `reset-selection-btn`
- `show-cart-btn`, `close-cart-modal-btn`
- `cart-select-all-btn`, `cart-deselect-all-btn`
- `cart-clear-btn`, `add-cart-to-exam-btn`

**Fix:** Added `dataset.listenerAttached` flag guard to prevent duplicate attachment:
```javascript
const btn = document.getElementById('random-select-btn');
if (!btn.dataset.listenerAttached) {
    btn.dataset.listenerAttached = 'true';
    btn.addEventListener('click', function() {
        // handler code
    });
}
```

---

### F100 - Double-Click Handler Conflict Fix (2026-01-07)
**File:** app.js
**Line:** 8162-8163
**Priority:** P1 High (Critical bug affecting exam scoring)

**Problem:** Two click handlers both fired when user clicked an option:
1. Container handler (line 8162) → `selectOptionNewUI()` → sets answer
2. Global handler (line 6974) → `selectOption()` → sees answer already set → toggles OFF

Both handlers had toggle logic: "if same option clicked, deselect". The global handler saw the answer already set by the first handler and immediately deselected it.

**Symptoms:**
- Radio buttons appeared to select visually (briefly)
- Answers not stored (always `undefined`)
- All exams scored 0 marks

**Fix:** Added `e.stopPropagation()` to container handler to prevent event bubbling to global handler.

```javascript
newOptionsContainer.addEventListener('click', function(e) {
    e.stopPropagation(); // Prevent double-handler conflict
    // ... rest of handler
});
```

---

### F202 - Database-backed Admin Authentication (2026-01-07)
**File:** api/index.js
**Backup:** api/index.js.backup.20260107
**Change:** Moved admin credentials from hardcoded values to Airtable database
- Admin credentials now stored in Candidates table with Role='admin'
- Password hashed with SHA-256 + salt
- Auto-creates default admin (admin/politeadmin) on first login if none exists
- Admin can change password via database

**Airtable Requirement:** Add `Role` field (Single select: "admin", "candidate") to Candidates table

---

### F102 - Candidate Signup Field Error Fix (2026-01-07)
**File:** api/index.js
**Lines:** 970-977
**Priority:** P1 High (Critical bug blocking new user registration)

**Problem:** Candidate signup was failing with a 500 error because the API was trying to write fields that don't exist in the Airtable Candidates table:
- `'Verified': true`
- `'Created At': new Date().toISOString()`

**Fix:** Removed the non-existent fields from the signup create call. Only fields that exist in Airtable are now used:
- `Name`, `Email`, `Mobile`, `Password`

**Note:** Email verification is NOT implemented. All candidates are auto-verified on signup. F302 tracks the email verification stub.

---

*Last Updated: 2026-01-07 (F100, F101, F102 fixes applied)*
