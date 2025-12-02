# 🚀 QUICK START: Hierarchical Question System

## ✅ What I've Created for You

1. **`api/index_hierarchical.js`** - Complete backend with cascade delete
2. **`HIERARCHICAL_SYSTEM_README.md`** - Comprehensive documentation
3. **`test-hierarchical-system.js`** - Test file to verify everything works

## 🎯 Integration in 5 Steps

### Step 1: Backup Your Current API
```bash
cd C:\Users\soura\Dropbox\AI\Projects\Polite_exam\polite-exam
cp api\index.js api\index_backup_$(date +%Y%m%d).js
```

### Step 2: Test the Hierarchical System
```bash
# Set environment variables (if not already in .env)
set AIRTABLE_PERSONAL_ACCESS_TOKEN=your_token_here
set AIRTABLE_BASE_ID=appYldhnqN8AdNgSF

# Run the test
node test-hierarchical-system.js
```

**Expected Output:**
```
╔══════════════════════════════════════════════════╗
║  HIERARCHICAL QUESTION SYSTEM - COMPREHENSIVE TESTS  ║
╚══════════════════════════════════════════════════╝

TEST 1: Creating Parent Question
✅ SUCCESS! Parent question created
   Record ID: recXXXXXXXXXXXXXX
   Field ID: Q_TEST_PARENT_001
   ...

TEST 2: Creating Child Questions
✅ Created child 1/5...
✅ Created child 2/5...
...

TEST 3: Fetching Hierarchical Questions
📖 PARENT QUESTION:
   ⤷ CHILDREN (5):
   ...

TEST 4: Testing CASCADE DELETE
✅ CASCADE DELETE SUCCESSFUL!

TEST 5: Testing Scoring Logic
✅ SCORING LOGIC CORRECT!

╔══════════════════════════════════════════════════╗
║              ALL TESTS COMPLETED!                    ║
╚══════════════════════════════════════════════════╝
```

### Step 3: Replace Your API
```bash
# Only do this after tests pass!
cp api\index_hierarchical.js api\index.js
```

### Step 4: Update Your Frontend (Optional)

The current frontend should work, but for better UI, update `index.html` and `api-integration.js` to:

1. **Display hierarchical questions in Question Bank**
2. **Show "Delete All" confirmation for parents**
3. **Group questions during exam**

I can help with this next if you'd like!

### Step 5: Deploy to Vercel
```bash
git add .
git commit -m "Add hierarchical question system with cascade delete"
git push origin main
```

Vercel will auto-deploy!

## 🧪 Manual Testing Checklist

### Test 1: Create Parent + Children in Airtable

**In Airtable:**

1. Create parent:
   ```
   ID: Q9999
   Question Type: Main Question
   Main Question Text: "A company has 8 employees on 8 floors..."
   [Leave options empty]
   ```

2. Create 5 children:
   ```
   ID: Q9999-1
   Question Type: Sub Question
   Parent Question: [Link to Q9999]
   Sub Question Number: 1
   Question: "Who is on the 5th floor?"
   Option A: "John"
   Option B: "Mary"
   Option C: "Peter"
   Option D: "Sarah"
   Correct: "B"
   ```

   Repeat for Q9999-2, Q9999-3, Q9999-4, Q9999-5

### Test 2: Verify Hierarchy

```bash
# Call your API
curl "https://your-app.vercel.app/api/questions?hierarchical=true"
```

**Expected:**
```json
{
  "success": true,
  "data": [
    {
      "id": "recXXX",
      "ID": "Q9999",
      "Question Type": "Main Question",
      "Main Question Text": "A company has...",
      "children": [
        {
          "id": "recYYY",
          "ID": "Q9999-1",
          "Question": "Who is on the 5th floor?",
          "Sub Question Number": 1,
          ...
        },
        ...
      ],
      "childCount": 5,
      "isParent": true,
      "totalScore": 5
    }
  ]
}
```

### Test 3: Test Cascade Delete

```bash
# Delete parent by Airtable record ID
curl -X DELETE "https://your-app.vercel.app/api/questions/recXXX"
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Parent question and 5 child question(s) deleted successfully",
  "deleted": {
    "questionId": "recXXX",
    "fieldId": "Q9999",
    "questionType": "Main Question",
    "childrenDeleted": 5
  }
}
```

**Verify in Airtable:**
- ✅ Q9999 should be deleted
- ✅ Q9999-1, Q9999-2, Q9999-3, Q9999-4, Q9999-5 should ALL be deleted

## ⚠️ Important Notes

### Field Names Must Match EXACTLY

Your Airtable already has these fields set up correctly:

✅ `Question Type` (not "Is Main Question")
✅ `Parent Question` (not "Parent Question ID")
✅ `Sub Question Number` (not "Sub Question Order")
✅ `Main Question Text` (not "Passage")

The new API uses these exact field names!

### Cascade Delete is Automatic

When you delete a parent question (Question Type = "Main Question"):
1. Backend finds all children (where Parent Question links to this parent)
2. Deletes all children in batches of 10
3. Then deletes the parent
4. Returns count of deleted children

### Scoring is Automatic

When submitting exam results:
- Parent questions (passages) are NOT scored
- Only children are scored: +1, -0.25, 0
- Parent's total score = sum of all children's scores

## 🎨 UI Integration (Optional)

Want to update the frontend to show hierarchical questions beautifully?

I can create updated versions of:
1. `index.html` - Show passages with grouped questions
2. `api-integration.js` - Handle hierarchical display and delete

Just let me know!

## 📚 Documentation

Read these for complete details:
- **HIERARCHICAL_SYSTEM_README.md** - Full system documentation
- **test-hierarchical-system.js** - Working code examples

## 🆘 Troubleshooting

### Issue: Test fails with "Question Type not found"
**Solution:** Verify Airtable has the exact field name "Question Type"

### Issue: Children not deleted with parent
**Solution:** Check that Parent Question field is linked correctly (should be array of record IDs)

### Issue: Scoring wrong
**Solution:** Verify Question Type is set correctly (Main Question vs Sub Question vs Standalone)

### Issue: Can't link children to parent
**Solution:** Create parent first, then use its Airtable record ID (starts with "rec") in children's Parent Question field

## ✅ Success Criteria

Your integration is successful when:

1. ✅ Tests pass completely
2. ✅ You can create parent + children in Airtable
3. ✅ API returns hierarchical structure
4. ✅ Deleting parent deletes all children
5. ✅ Exam scoring works correctly (only children scored)

## 🚀 Next Steps

After integration:

1. **Test with real exam data** - Create actual comprehension passages
2. **Update UI** - Make frontend display hierarchical questions beautifully
3. **Train users** - Show examiners how to create parent-child questions
4. **Monitor** - Check logs for cascade delete operations

---

**Questions?** Read HIERARCHICAL_SYSTEM_README.md for complete documentation!

**Ready to deploy?** Run the tests first, then replace the API file!

**Need UI updates?** Let me know and I'll create beautiful hierarchical displays!

🎉 **Your hierarchical question system is ready to use!** 🎉
