# ✅ VERIFICATION CHECKLIST - Hierarchical Question System

Use this checklist to verify your hierarchical question system is working correctly.

## 📋 Pre-Integration Checklist

### Database Setup
- [ ] Airtable base ID is `appYldhnqN8AdNgSF`
- [ ] Questions table has field: `Question Type` (Single Select)
- [ ] Questions table has field: `Parent Question` (Linked Record)
- [ ] Questions table has field: `Sub Question Number` (Number)
- [ ] Questions table has field: `Main Question Text` (Long Text)
- [ ] Field names match EXACTLY (not "Is Main Question", etc.)

### Environment Variables
- [ ] `AIRTABLE_PERSONAL_ACCESS_TOKEN` is set
- [ ] `AIRTABLE_BASE_ID` is set to `appYldhnqN8AdNgSF`
- [ ] Token starts with `pat` (not old API key)
- [ ] Token has read/write permissions

### Files Created
- [ ] `api/index_hierarchical.js` exists (594 lines)
- [ ] `HIERARCHICAL_SYSTEM_README.md` exists (539 lines)
- [ ] `test-hierarchical-system.js` exists (508 lines)
- [ ] `QUICK_START_HIERARCHICAL.md` exists (261 lines)
- [ ] `HIERARCHICAL_IMPLEMENTATION_SUMMARY.md` exists (360 lines)

## 🧪 Testing Checklist

### Run Automated Tests
```bash
node test-hierarchical-system.js
```

- [ ] Test 1: Parent question created successfully
- [ ] Test 2: 5 child questions created successfully
- [ ] Test 3: Children linked to parent correctly
- [ ] Test 4: Hierarchical fetch returns correct structure
- [ ] Test 5: Scoring logic calculates correctly (2.75 expected)
- [ ] Test 6: Cascade delete removes all 6 questions (parent + 5 children)
- [ ] Test 7: No orphan questions remain
- [ ] All tests show ✅ SUCCESS

### Manual Testing (Create Real Questions)

#### Test A: Create English Comprehension
- [ ] Create parent question:
  - ID: `ENG_COMP_001`
  - Question Type: `Main Question`
  - Main Question Text: [Full passage]
  - No options (leave A/B/C/D empty)

- [ ] Create 5 children:
  - IDs: `ENG_COMP_001_Q1` through `ENG_COMP_001_Q5`
  - Question Type: `Sub Question`
  - Parent Question: Link to `ENG_COMP_001`
  - Sub Question Number: 1, 2, 3, 4, 5
  - Each has Question, 4 options, correct answer

- [ ] Verify in Airtable:
  - [ ] Parent exists with passage text
  - [ ] 5 children exist and link to parent
  - [ ] Sub Question Numbers are 1-5

#### Test B: Fetch Hierarchically
```bash
curl "https://your-app.vercel.app/api/questions?hierarchical=true"
```

- [ ] Response is JSON with `success: true`
- [ ] Parent question in response
- [ ] Parent has `children` array
- [ ] `children` array has 5 items
- [ ] Children sorted by Sub Question Number
- [ ] Parent has `childCount: 5`
- [ ] Parent has `isParent: true`
- [ ] Parent has `totalScore: 5`

#### Test C: Cascade Delete
```bash
# Get parent's Airtable record ID (starts with "rec")
curl -X DELETE "https://your-app.vercel.app/api/questions/recXXXXXXX"
```

Expected Response:
- [ ] `success: true`
- [ ] Message: "Parent question and 5 child question(s) deleted successfully"
- [ ] `deleted.childrenDeleted: 5`
- [ ] `deleted.questionType: "Main Question"`

Verify in Airtable:
- [ ] Parent question deleted
- [ ] ALL 5 children deleted
- [ ] No orphan questions remain
- [ ] Only standalone questions remain (if any)

#### Test D: Scoring (Create Exam)
- [ ] Create exam with hierarchical questions
- [ ] Include parent + 5 children
- [ ] Take exam and answer:
  - Q1: Correct (should get +1)
  - Q2: Correct (should get +1)
  - Q3: Wrong (should get -0.25)
  - Q4: Unanswered (should get 0)
  - Q5: Correct (should get +1)

- [ ] Submit exam
- [ ] Check score in Results table
- [ ] Expected score: 2.75 (1 + 1 - 0.25 + 0 + 1)
- [ ] Actual score matches expected

## 🔄 Integration Checklist

### Backup Current System
- [ ] Backup `api/index.js` to `api/index_backup.js`
- [ ] Note current commit hash: `git log -1 --oneline`
- [ ] Create rollback plan if needed

### Replace API
- [ ] Copy `api/index_hierarchical.js` to `api/index.js`
- [ ] Verify file copied correctly
- [ ] Check file has 594 lines (or close)
- [ ] Search for "cascadeDeleteChildren" function - should exist
- [ ] Search for "organizeHierarchically" function - should exist

### Deploy to Vercel
```bash
git add .
git commit -m "Add hierarchical question system with cascade delete"
git push origin main
```

- [ ] Git commit successful
- [ ] Git push successful
- [ ] Vercel deployment triggered
- [ ] Vercel deployment completed (check dashboard)
- [ ] No build errors in Vercel logs

### Verify Deployment
- [ ] Visit: `https://your-app.vercel.app/api/health`
  - [ ] Status: `ok`
  - [ ] Airtable: `connected`

- [ ] Visit: `https://your-app.vercel.app/api/questions?hierarchical=true`
  - [ ] Returns JSON
  - [ ] Has hierarchical structure
  - [ ] Parents have children arrays

## 🎯 Functional Testing (Post-Deployment)

### Test 1: Question Bank
- [ ] Login as admin
- [ ] Click "Question Bank"
- [ ] Questions load from Airtable
- [ ] Hierarchical questions displayed (if UI updated)
- [ ] Standalone questions also display

### Test 2: Create Question
- [ ] Click "Add Question" (if available)
- [ ] Create new standalone question
- [ ] Question appears in Question Bank
- [ ] Question has correct type: `Standalone`

### Test 3: Create Hierarchical Set (via Airtable)
- [ ] Go to Airtable
- [ ] Create new parent question
- [ ] Create 3-5 children
- [ ] Link children to parent
- [ ] Refresh Question Bank
- [ ] New hierarchical set appears

### Test 4: Delete Standalone
- [ ] Click delete on standalone question
- [ ] Confirm deletion
- [ ] Question removed from list
- [ ] Only that question deleted (no cascade)

### Test 5: Delete Parent
- [ ] Click delete on parent question
- [ ] Confirmation shows "Delete parent and X children?"
- [ ] Confirm deletion
- [ ] Parent and ALL children removed
- [ ] Verify in Airtable - all gone

### Test 6: Exam with Hierarchical Questions
- [ ] Create new exam
- [ ] Include parent + children questions
- [ ] Also include standalone questions
- [ ] Take exam as student
- [ ] Answer some correctly, some wrong, some unanswered
- [ ] Submit exam
- [ ] Check results
- [ ] Score calculated correctly (+1, -0.25, 0)

## 🐛 Error Testing

### Test Error: Try to create child without parent
- [ ] Create question with Type = `Sub Question`
- [ ] Don't link Parent Question
- [ ] Should work (but orphaned)
- [ ] Later, link to parent to fix

### Test Error: Try to delete non-existent question
```bash
curl -X DELETE "https://your-app.vercel.app/api/questions/invalidID"
```
- [ ] Response: `404 Not Found`
- [ ] Error message: "Question not found"

### Test Error: Try to delete child
```bash
curl -X DELETE "https://your-app.vercel.app/api/questions/recChildID"
```
- [ ] Response: `200 OK`
- [ ] Message: "Question deleted successfully"
- [ ] Only that child deleted (no cascade)
- [ ] Parent and siblings remain

## 📊 Performance Testing

### Test 1: Large Question Set
- [ ] Create parent with 10 children (max for some exams)
- [ ] Fetch hierarchically
- [ ] Delete parent
- [ ] All 11 questions deleted (1 + 10)
- [ ] No timeout errors

### Test 2: Multiple Parents
- [ ] Create 5 different parent questions
- [ ] Each with 5 children (25 children total)
- [ ] Fetch hierarchically
- [ ] All 5 groups organized correctly
- [ ] Delete 1 parent
- [ ] Only that group deleted (1 parent + 5 children)
- [ ] Other 4 groups remain intact

### Test 3: Mixed Questions
- [ ] Database has:
  - 10 standalone questions
  - 3 parent questions (each with 5 children)
  - Total: 10 + 3 + 15 = 28 questions
- [ ] Fetch hierarchically
- [ ] Returns 13 items (10 standalone + 3 parents with children)
- [ ] Fetch flat (without ?hierarchical=true)
- [ ] Returns 28 items (all questions flat)

## 🔒 Security Testing

### Test 1: Verify Cascade Delete Permissions
- [ ] Parent deletion requires proper auth (if implemented)
- [ ] Can't delete via direct Airtable API bypass
- [ ] Logs show who deleted what

### Test 2: Verify Field Validation
- [ ] Can't create question with invalid Question Type
- [ ] Can't link child to non-existent parent
- [ ] Can't set negative Sub Question Number

## 📈 Monitoring

### After 1 Day
- [ ] Check Vercel function logs
- [ ] Look for any 500 errors
- [ ] Verify no stuck questions
- [ ] Check for orphan children

### After 1 Week
- [ ] Review all delete operations in logs
- [ ] Count cascade deletes performed
- [ ] Verify no data integrity issues
- [ ] Check user feedback

### After 1 Month
- [ ] Analyze question bank growth
- [ ] Review hierarchical vs standalone ratio
- [ ] Check average children per parent (should be 4-5)
- [ ] Verify scoring accuracy

## ✅ Success Criteria

Your implementation is successful if:

### Core Functionality
- [x] Can create parent questions (passages/scenarios)
- [x] Can create child questions (linked to parent)
- [x] Can fetch questions hierarchically organized
- [x] Can delete parent (cascades to children)
- [x] Can delete child (doesn't affect parent)
- [x] Children sorted by Sub Question Number

### Data Integrity
- [x] No orphan questions after parent delete
- [x] Children always linked to valid parent
- [x] Question Types set correctly
- [x] Sub Question Numbers sequential

### Scoring
- [x] Parents not scored (containers only)
- [x] Children scored: +1, -0.25, 0
- [x] Total score = sum of children
- [x] Scoring matches manual calculation

### User Experience
- [x] Questions display correctly
- [x] Delete confirms before cascade
- [x] Exams show hierarchical questions properly
- [x] Results show correct scores

### Performance
- [x] Hierarchical fetch fast (< 2 seconds)
- [x] Delete cascade fast (< 5 seconds)
- [x] No timeouts or errors
- [x] Handles 100+ questions efficiently

## 🎓 Final Sign-Off

Before considering this feature complete:

- [ ] All automated tests pass ✅
- [ ] All manual tests pass ✅
- [ ] All error tests handled correctly ✅
- [ ] Performance acceptable ✅
- [ ] Documentation complete ✅
- [ ] Users trained on how to use ✅
- [ ] Deployed to production ✅
- [ ] Monitoring in place ✅

## 📞 Support

If any test fails:
1. Check HIERARCHICAL_SYSTEM_README.md for troubleshooting
2. Review test-hierarchical-system.js for examples
3. Check Vercel function logs for errors
4. Verify Airtable field names match exactly
5. Confirm environment variables set correctly

---

**Status:** [ ] Not Started  [ ] In Progress  [ ] Complete
**Tested By:** _________________
**Date:** _________________
**Notes:** _________________________________________________
