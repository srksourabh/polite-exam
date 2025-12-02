# 🎯 HIERARCHICAL QUESTION SYSTEM - COMPLETE IMPLEMENTATION

## 📋 Overview

This implements a **parent-child question system** for complex competitive exam scenarios like:
- **English comprehension passages** with 4-5 sub-questions
- **Reasoning puzzles** (e.g., "8 persons on 8 floors") with 5 related questions
- **Data interpretation** with multiple questions based on tables/graphs

## 🏗️ Database Structure (Already Set Up!)

Your Airtable "Questions" table has these fields:

### Core Fields
- `ID` - Question identifier (Q0001, Q0002, etc.)
- `Subject` - Subject category
- `Question` - Question text
- `Option A`, `Option B`, `Option C`, `Option D` - Answer options
- `Correct` - Correct answer (A/B/C/D)
- `Difficulty` - Easy/Medium/Hard

### Hierarchical Fields (NEW!)
- **`Question Type`** (Single Select)
  - `Standalone` - Regular single question
  - `Main Question` - Parent (passage/scenario)
  - `Sub Question` - Child question

- **`Parent Question`** (Linked Record)
  - Links to the parent's Airtable record ID
  - Only filled for Sub Questions

- **`Sub Question Number`** (Number)
  - Ordering: 1, 2, 3, 4, 5
  - For displaying children in correct sequence

- **`Main Question Text`** (Long Text)
  - The passage/scenario text for parent questions
  - Example: Full English comprehension passage

## 🎯 Three Types of Questions

### 1. Standalone Question
```
Question Type: Standalone
Has: Question, 4 options, 1 correct answer
No parent, no children
```

### 2. Main Question (Parent)
```
Question Type: Main Question
Has: Main Question Text (the passage/scenario)
No options (not a question itself)
Has: 4-5 child questions linked to it
```

### 3. Sub Question (Child)
```
Question Type: Sub Question
Has: Question, 4 options, 1 correct answer
Has: Parent Question (linked)
Has: Sub Question Number (for ordering)
```

## ✅ Key Features Implemented

### 1. CASCADE DELETE ✅
**When you delete a parent, ALL children are automatically deleted!**

```javascript
// In api/index.js
DELETE /api/questions/:id

Logic:
1. Check if question is a parent (Question Type = "Main Question")
2. If yes, find all children (Parent Question links to this parent)
3. Delete all children first (in batches of 10)
4. Then delete the parent
5. Return count of deleted children
```

**Response:**
```json
{
  "success": true,
  "message": "Parent question and 5 child question(s) deleted successfully",
  "deleted": {
    "questionId": "recABC123",
    "fieldId": "Q0001",
    "questionType": "Main Question",
    "childrenDeleted": 5
  }
}
```

### 2. Hierarchical Display ✅
**Questions are organized: parents with their children**

```javascript
GET /api/questions?hierarchical=true

Returns:
[
  {
    id: "recParent1",
    ID: "Q0001",
    "Question Type": "Main Question",
    "Main Question Text": "Read the following passage...",
    children: [
      { id: "recChild1", ID: "Q0002", Question: "What is...", ... },
      { id: "recChild2", ID: "Q0003", Question: "Why did...", ... },
      { id: "recChild3", ID: "Q0004", Question: "How many...", ... }
    ],
    childCount: 3,
    isParent: true,
    totalScore: 3
  },
  {
    id: "recStandalone1",
    ID: "Q0005",
    Question: "Regular question...",
    children: [],
    childCount: 0,
    isStandalone: true
  }
]
```

### 3. Scoring System ✅
**Proper scoring for hierarchical questions**

```
Parent (passage): Worth 0 points (not scored)
Each child: 
  - Correct: +1.0
  - Incorrect: -0.25
  - Unanswered: 0

Example:
English Passage (Parent) with 5 children:
- Maximum possible: 5 points
- If student gets 3 correct, 1 wrong, 1 unanswered:
  Score = (3 × 1) + (1 × -0.25) + (1 × 0) = 2.75
```

### 4. Auto-Detection ✅
**System automatically sets Question Type based on content**

```javascript
// When creating a question:
if (no options && has Main Question Text) {
  → Question Type = "Main Question" (Parent)
}
else if (has Parent Question link) {
  → Question Type = "Sub Question" (Child)
}
else {
  → Question Type = "Standalone" (Regular)
}
```

## 📝 How to Create Hierarchical Questions

### Method 1: In Airtable Directly

#### Step 1: Create Parent Question
```
ID: Q0001
Subject: English
Question Type: Main Question
Main Question Text: "Read the following passage about climate change..."
Option A: (leave empty)
Option B: (leave empty)
Option C: (leave empty)
Option D: (leave empty)
Correct: (leave empty)
```

#### Step 2: Create Child Questions
```
Question 1:
ID: Q0002
Subject: English
Question Type: Sub Question
Parent Question: [Link to Q0001]
Sub Question Number: 1
Question: "What is the main theme of the passage?"
Option A: "Climate science"
Option B: "Global warming effects"
Option C: "Environmental policies"
Option D: "Renewable energy"
Correct: "B"

Question 2:
ID: Q0003
Subject: English
Question Type: Sub Question
Parent Question: [Link to Q0001]
Sub Question Number: 2
Question: "According to the passage, when did..."
Option A: "1990"
Option B: "2000"
Option C: "2010"
Option D: "2020"
Correct: "C"

... (and so on for 3, 4, 5)
```

### Method 2: Via API (Bulk Upload)

```javascript
POST /api/questions/bulk

Body:
{
  "questions": [
    // Parent
    {
      "ID": "Q0001",
      "Subject": "English",
      "Question Type": "Main Question",
      "Main Question Text": "Read the passage about..."
      // No options for parent
    },
    // Children (create parent first, then use its record ID)
    {
      "ID": "Q0002",
      "Subject": "English",
      "Question Type": "Sub Question",
      "Parent Question": ["recParentRecordId"], // Airtable record ID
      "Sub Question Number": 1,
      "Question": "What is the main theme?",
      "Option A": "Science",
      "Option B": "Technology",
      "Option C": "History",
      "Option D": "Geography",
      "Correct": "A"
    },
    {
      "ID": "Q0003",
      "Subject": "English",
      "Question Type": "Sub Question",
      "Parent Question": ["recParentRecordId"],
      "Sub Question Number": 2,
      "Question": "According to the passage...",
      "Option A": "Yes",
      "Option B": "No",
      "Option C": "Maybe",
      "Option D": "Not mentioned",
      "Correct": "D"
    }
    // ... more children
  ]
}
```

## 🎨 UI Display (How It Should Look)

### In Question Bank:
```
┌─────────────────────────────────────────────────────────┐
│ 📖 MAIN QUESTION Q0001 - English        [🗑️ Delete All] │
├─────────────────────────────────────────────────────────┤
│ 📝 Passage:                                             │
│ Read the following passage about climate change.        │
│ Climate change refers to long-term shifts in            │
│ temperatures and weather patterns...                    │
│                                                         │
│ ⤷ Sub-Questions (5):                                    │
│                                                         │
│   1️⃣ Q0002: What is the main theme?                    │
│      A) Climate science                                 │
│      B) Global warming effects ✓                        │
│      C) Environmental policies                          │
│      D) Renewable energy                                │
│                                                         │
│   2️⃣ Q0003: According to the passage, when did...      │
│      A) 1990                                            │
│      B) 2000                                            │
│      C) 2010 ✓                                          │
│      D) 2020                                            │
│                                                         │
│   3️⃣ Q0004: The author suggests that...                │
│   4️⃣ Q0005: Which of the following is NOT mentioned?   │
│   5️⃣ Q0006: What can be inferred from...               │
│                                                         │
│ 🎯 Total Score: 5 marks (1 per sub-question)           │
└─────────────────────────────────────────────────────────┘
```

### During Exam:
```
════════════════════════════════════════════════
Question 15-19: English Comprehension
════════════════════════════════════════════════

📖 Read the following passage:

Climate change refers to long-term shifts in 
temperatures and weather patterns. These shifts 
may be natural, but since the 1800s, human 
activities have been the main driver...

────────────────────────────────────────────────

15. What is the main theme of the passage?
    ○ A. Climate science
    ○ B. Global warming effects
    ○ C. Environmental policies
    ○ D. Renewable energy

16. According to the passage, when did...?
    ○ A. 1990
    ○ B. 2000
    ○ C. 2010
    ○ D. 2020

17. The author suggests that...
    [options]

18. Which is NOT mentioned?
    [options]

19. What can be inferred?
    [options]

════════════════════════════════════════════════
Total: 5 marks (Questions 15-19)
════════════════════════════════════════════════
```

## 🧪 Testing the System

### Test 1: Create Hierarchical Question Set
```bash
# Use the test file
node test-hierarchical.js
```

### Test 2: Delete Parent (Cascade Test)
```bash
curl -X DELETE http://localhost:3000/api/questions/recParentId

Expected Response:
{
  "success": true,
  "message": "Parent question and 5 child question(s) deleted successfully",
  "deleted": {
    "childrenDeleted": 5
  }
}
```

### Test 3: Fetch Hierarchically
```bash
curl http://localhost:3000/api/questions?hierarchical=true

Expected: Parents with children nested
```

## 🔒 Data Integrity Rules

### ✅ What's Enforced:
1. **CASCADE DELETE**: Parent deleted → ALL children deleted
2. **No orphans**: Children can't exist without parents
3. **Ordering**: Children displayed by Sub Question Number
4. **Scoring**: Only children scored, parents are containers

### ⚠️ What to Ensure Manually:
1. **Don't link standalone as children** - Only Sub Questions should have Parent Question
2. **Don't give parents options** - Main Questions shouldn't have A/B/C/D
3. **Sequential numbering** - Use 1, 2, 3, 4, 5 for Sub Question Number

## 📊 API Endpoints

### Get All Questions (Hierarchical)
```
GET /api/questions?hierarchical=true
```

### Create Question (Auto-detects type)
```
POST /api/questions
Body: { ID, Subject, Question, options... }
```

### Delete Question (With Cascade)
```
DELETE /api/questions/:id
→ If parent: deletes all children first
→ If child: deletes only that child
→ If standalone: deletes just that question
```

### Create Bulk (With Hierarchy)
```
POST /api/questions/bulk
Body: { questions: [...] }
```

### Get Exam Questions (Hierarchical)
```
GET /api/exams/:examCode
→ Returns questions organized hierarchically
```

### Submit Results (Scores Hierarchically)
```
POST /api/results
→ Parents not scored
→ Only children scored: +1, -0.25, 0
```

## 🚀 Integration Steps

1. **Backup Current API**
   ```bash
   cp api/index.js api/index_backup.js
   ```

2. **Replace with Hierarchical Version**
   ```bash
   cp api/index_hierarchical.js api/index.js
   ```

3. **Update Frontend** (coming next)
   - Display hierarchical questions
   - Show delete confirmation for parents
   - Group questions in exam view

4. **Test Thoroughly**
   - Create parent + children
   - Delete parent (verify cascade)
   - Take exam with hierarchical questions
   - Check scoring

## 📝 Notes

### Field Names (Critical!)
```
✅ CORRECT (Use These):
- Question Type
- Parent Question
- Sub Question Number
- Main Question Text

❌ WRONG (Old Names, Don't Use):
- Is Main Question
- Parent Question ID
- Sub Question Order
- Is Sub Question
```

### Scoring Formula
```javascript
score = 0;
for each child question:
  if (answer === correct) score += 1.0
  else if (answer !== 'unanswered') score -= 0.25
  else score += 0  // unanswered

parent total = sum of all child scores
```

### Display Logic
```javascript
// In UI:
if (question['Question Type'] === 'Main Question') {
  // Show passage
  // Don't show options
  // Show all children below
  // Show total score = number of children
}
else if (question['Question Type'] === 'Sub Question') {
  // Show as regular MCQ
  // But indented/grouped under parent
}
else {
  // Regular standalone question
}
```

## 🎓 Example Use Cases

### 1. English Comprehension
- 1 passage (parent) + 5 questions (children)
- Passage displayed once at top
- 5 MCQs below referring to passage
- Total: 5 marks

### 2. Reasoning Puzzle
- 1 scenario (parent) + 5 questions (children)
- Example: "8 persons live on 8 floors..."
- 5 questions about the arrangement
- Total: 5 marks

### 3. Data Interpretation
- 1 table/graph description (parent) + 4 questions (children)
- Table shown once
- 4 calculation questions
- Total: 4 marks

## 🆘 Troubleshooting

### Issue: Children not deleted with parent
**Check:** Is `Question Type` = "Main Question" for parent?
**Fix:** Update parent record with correct Question Type

### Issue: Children not showing under parent
**Check:** Is `Parent Question` field linked correctly?
**Fix:** Link child's Parent Question to parent's record ID

### Issue: Wrong score calculation
**Check:** Are children's answers being read correctly?
**Fix:** Verify answer format matches question ID

### Issue: Can't delete parent
**Check:** Backend logs for cascade delete errors
**Fix:** Ensure Airtable API token has write permissions

## ✅ Success Criteria

Your implementation is correct when:
1. ✅ Parent deleted → All children deleted
2. ✅ Question bank shows hierarchical groups
3. ✅ Exam displays passages with grouped questions
4. ✅ Scoring correctly: only children scored
5. ✅ No orphan children exist in database

---

**Need Help?** 
- Check test-hierarchical.js for examples
- Review API logs for delete operations
- Verify Airtable field names match exactly

**Ready to Deploy!** 🚀
