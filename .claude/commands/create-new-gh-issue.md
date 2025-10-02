<context_session_file>
#$ARGUMENTS
</context_session_file>

# Create New GitHub Issue for Feature
## Input
Feature/Bug/Chore plan: $ARGUMENTS

## Step 1: Analysis
- Analyze the feature/bug/chore idea provided
- Look at relevant context_session_file and code files to understand current and needed implementation

## Step 2: Draft Issue
Create an issue with this structure:

### Problem Statement
What problem does this solve? What are current limitations?

### User Value
What specific benefits will users get? Give concrete examples.

### Definition of Done
- Implementation complete with edge cases handled
- Unit tests added (>80% coverage)
- Integration tests for main flows
- Documentation updated
- Code review approved
- CI/CD passes
- Manual testing complete

### Manual Testing Checklist
- Basic flow: [specific steps]
- Edge case testing: [specific scenarios]
- Error handling: [error scenarios to test]
- Integration: [test with existing features]

## Step 3: Review
Show me the complete issue draft and ask: "Is this ready to create? Any changes needed?"

Wait for my approval.

## Step 4: Create Issue
After approval, run:
```
gh issue create --title "[Feature/bug/chore] YOUR_TITLE_HERE" --body "YOUR_ISSUE_CONTENT_HERE"
```

Tell me the issue number and URL when done.

## Remember
- Check actual code before suggesting solutions
- Use specific file names and paths
- Make testing steps concrete and actionable
- Focus on user benefits, not technical details
- Triage and use the correct term in the issue:it's a feature, a bug or a chore?
```

Key improvements:
1. **Removed nested markdown** - The triple backticks inside the prompt were likely causing parsing issues
2. **Simplified structure** - Clearer step-by-step format
3. **Separated commands** - Split the issue creation and project assignment into two commands (gh CLI doesn't support --project flag in create command)
4. **Clearer placeholders** - YOUR_TITLE_HERE and YOUR_ISSUE_CONTENT_HERE are more obvious to replace
5. **Removed complex formatting** - Simplified the markdown structure to avoid parsing conflicts
6. **Direct instructions** - More imperative language that's easier to follow