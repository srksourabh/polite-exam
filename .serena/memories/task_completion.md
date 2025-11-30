# Task Completion Workflow

## When a Task is Completed

### 1. Code Changes
- Make changes to appropriate files
- Ensure functionality is not broken
- Test changes locally in browser

### 2. Git Workflow
```powershell
# Create feature branch
git checkout -b fix/issue-description

# Stage changes
git add .

# Commit with descriptive message
git commit -m "Fix: Description of the fix"

# Push to remote
git push origin fix/issue-description
```

### 3. Create Pull Request
- Push branch to GitHub
- Create PR via GitHub web interface
- Provide clear description of changes
- Link to any related issues

### 4. Verification
- Test in browser
- Test Android build if mobile-related
- Verify no console errors
- Check responsive design

## PR Guidelines
- One feature/fix per PR
- Clear title describing the change
- Description explains what was fixed and how
- Include any breaking changes or migration notes

## Testing Checklist
- [ ] Works in Chrome/Edge
- [ ] No console errors
- [ ] Responsive on mobile
- [ ] Data persists correctly
- [ ] API calls work (if applicable)
- [ ] Session management intact
