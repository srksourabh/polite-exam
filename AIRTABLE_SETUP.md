# Airtable Database Setup Guide

## Required Tables

Your Airtable base needs the following tables with specific field configurations:

### 1. **Questions Table**
| Field Name | Field Type | Notes |
|------------|-----------|-------|
| ID | Single line text | Unique identifier (e.g., Q0001, Q0002) |
| Subject | Single line text | Subject category (Math, GK, Reasoning, English, Others) |
| Question | Long text | The question text |
| Option A | Long text | First option |
| Option B | Long text | Second option |
| Option C | Long text | Third option |
| Option D | Long text | Fourth option |
| Correct | Single line text | Correct answer (A, B, C, or D) |

### 2. **Exams Table**
| Field Name | Field Type | Notes |
|------------|-----------|-------|
| Exam Code | Single line text | Unique exam code (e.g., SAMPLE01) |
| Title | Single line text | Exam title |
| Duration (mins) | Number | Duration in minutes |
| Expiry (IST) | Date | Expiry date in IST timezone |
| Question IDs | Multiple record links | Links to Questions table |

### 3. **Results Table**
| Field Name | Field Type | Notes |
|------------|-----------|-------|
| Exam | Link to another record | Links to Exams table |
| Name | Single line text | Candidate name |
| Mobile | Phone number | Candidate mobile number |
| Score | Number | Exam score |
| Answers | Long text | JSON string of detailed answers |
| Created | Created time | Auto-generated timestamp |

### 4. **Candidates Table** ⚠️ **IMPORTANT - NEW TABLE**
| Field Name | Field Type | Notes |
|------------|-----------|-------|
| Name | Single line text | Candidate's full name |
| Email | Email | Candidate's email (used as username) |
| Mobile | Phone number | 10-digit mobile number |
| Password | Single line text | Password (plain text for simplicity) |
| First Exam Date | Date | Date when candidate first signed up |

## Setup Instructions

### Step 1: Create the Candidates Table

1. Go to your Airtable base
2. Click the **"+"** button to add a new table
3. Name it exactly: **"Candidates"** (case-sensitive)
4. Add the following fields:

   - **Name**: Single line text
   - **Email**: Email field
   - **Mobile**: Phone number
   - **Password**: Single line text
   - **First Exam Date**: Date field

### Step 2: Verify Permissions

Make sure your Airtable Personal Access Token has these permissions:
- ✅ `data.records:read`
- ✅ `data.records:write`
- ✅ `schema.bases:read`

### Step 3: Test the Setup

1. Try creating a test candidate account through the signup form
2. If you get an authorization error, check:
   - Table name is exactly "Candidates"
   - All field names match exactly (case-sensitive)
   - Your API token has write permissions

## Quick Setup Script

If you want to test the setup, use this endpoint:

```
GET /api/admin/verify-tables
```

This will check if all required tables and fields exist.

## Common Errors

### "You are not authorized to perform this operation"
- **Cause**: Candidates table doesn't exist OR API token lacks write permissions
- **Fix**: Create the Candidates table with exact field names listed above

### "Unknown field name"
- **Cause**: Field name mismatch
- **Fix**: Ensure field names in Airtable match exactly (case-sensitive)

### "Invalid request: invalid cell value for field"
- **Cause**: Wrong field type (e.g., using Single line text instead of Email)
- **Fix**: Update field type in Airtable to match requirements

## Sample Data

After creating the Candidates table, you can add a test record:

| Name | Email | Mobile | Password | First Exam Date |
|------|-------|--------|----------|-----------------|
| Test User | test@example.com | 1234567890 | password123 | 2025-01-01 |

Then try logging in with:
- Email: test@example.com
- Password: password123

## Next Steps

Once the Candidates table is set up:
1. Test signup functionality
2. Test login functionality
3. Test password reset
4. Test candidate dashboard

## Support

If you continue to have issues:
1. Check the browser console for detailed error messages
2. Verify your Airtable base ID and token are correct in Vercel environment variables
3. Ensure the base ID matches the base containing all your tables
