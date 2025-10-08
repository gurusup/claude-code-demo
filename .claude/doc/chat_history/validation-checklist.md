# Chat History - Validation Checklist

**Purpose**: Quick reference for Playwright validation after implementation
**Related Document**: [Full Acceptance Criteria](./acceptance-criteria.md)

---

## Critical Path Scenarios (Must Pass)

### 1. Happy Path - First Time User
- [ ] User opens app with no conversations
- [ ] Sends first message "Hello, what can you do?"
- [ ] Conversation auto-saves with title "Hello, what can you do?"
- [ ] Opens sidebar - sees 1 conversation in the list
- [ ] Refreshes page - conversation persists
- [ ] **Validation**: Check MongoDB for conversation document

### 2. Happy Path - Load Existing Conversation
- [ ] User with 5 conversations opens app
- [ ] Opens sidebar - sees all 5 conversations sorted by recent
- [ ] Clicks on 3rd conversation
- [ ] All messages load correctly (order preserved)
- [ ] Active conversation highlighted in sidebar
- [ ] **Validation**: Message count matches, no duplicates

### 3. Happy Path - Create New Conversation
- [ ] User clicks "New Chat" button in sidebar
- [ ] Chat area clears
- [ ] Input receives focus
- [ ] Sends message
- [ ] New conversation appears in sidebar (top of list)
- [ ] **Validation**: Two conversations exist in MongoDB

### 4. Happy Path - Delete Conversation
- [ ] User hovers over conversation in sidebar
- [ ] Delete icon appears
- [ ] Clicks delete → confirmation dialog shows
- [ ] Clicks "Delete" → conversation removed from sidebar
- [ ] **Validation**: Conversation deleted from MongoDB (hard delete)

### 5. Happy Path - Filter by Status
- [ ] User opens sidebar
- [ ] Selects "Active" filter → only active conversations shown
- [ ] Selects "Archived" filter → only archived shown
- [ ] Selects "All" → all conversations shown
- [ ] **Validation**: API calls include correct query params

---

## Responsive Behavior (Must Pass)

### Desktop (1920x1080)
- [ ] Sidebar collapses by default
- [ ] Hamburger menu opens sidebar (300ms slide animation)
- [ ] Sidebar width = 320px
- [ ] Chat area resizes to (viewport - 320px)
- [ ] Sidebar state persists after refresh

### Tablet (768x1024)
- [ ] Sidebar pushes chat area (not overlay)
- [ ] Both sidebar and chat visible simultaneously
- [ ] Rotation from portrait to landscape maintains state

### Mobile (375x667)
- [ ] Sidebar overlays chat (full screen - 48px)
- [ ] Semi-transparent backdrop appears
- [ ] Tapping backdrop closes sidebar
- [ ] Auto-closes after selecting conversation
- [ ] Swipe left gesture closes sidebar

---

## Error Handling (Must Pass)

### MongoDB Connection Failure
- [ ] Disconnect MongoDB → open sidebar
- [ ] Error state displays: "Unable to load conversations"
- [ ] "Retry" button shown
- [ ] Click retry → reconnects and loads
- [ ] **Validation**: Console shows error logs, no crashes

### Conversation Not Found
- [ ] Load conversation ID that doesn't exist
- [ ] Error message: "This conversation no longer exists"
- [ ] User redirected to new conversation
- [ ] localStorage cleared
- [ ] **Validation**: No infinite redirect loop

### Network Timeout
- [ ] Simulate slow network (>10s)
- [ ] Request aborts
- [ ] Toast: "Request timed out. Please try again."
- [ ] Loading state clears
- [ ] **Validation**: No hanging spinners

---

## Performance Benchmarks (Should Pass)

### Load Time
- [ ] Sidebar opens in < 300ms (smooth 60fps animation)
- [ ] Conversation list of 50 items loads in < 2s
- [ ] Single conversation (50 messages) loads in < 1.5s
- [ ] Message send appears optimistically in < 100ms

### Memory
- [ ] Load 20 conversations → memory < 200MB
- [ ] Long session (8 hours) → no memory leaks
- [ ] Images lazy-load outside viewport

---

## Data Integrity Checks (Must Pass)

### No Message Loss
- [ ] Send message → verify in MongoDB before API returns
- [ ] Interrupt streaming → partial response saved
- [ ] Browser crash → conversation recovers on reopen

### No Duplicates
- [ ] Create 10 conversations → each has unique UUID
- [ ] Open same conversation in 2 tabs → both load same data
- [ ] Send message from both tabs → no duplicate messages

### Correct Ordering
- [ ] Load conversation with 100 messages
- [ ] Messages sorted by timestamp (ascending)
- [ ] User/assistant alternation preserved
- [ ] Tool messages placed after assistant messages

---

## Accessibility Checks (Should Pass)

### Keyboard Navigation
- [ ] Tab through sidebar: hamburger → filter → list → new chat
- [ ] Enter selects conversation
- [ ] Delete key triggers delete confirmation
- [ ] ESC closes sidebar

### Screen Reader
- [ ] Conversation list announced as "list"
- [ ] Active conversation announced as "selected"
- [ ] Loading states announced
- [ ] Delete dialog read correctly

### Color Contrast
- [ ] Text meets 4.5:1 contrast ratio
- [ ] Status indicators use icons + color (not color alone)

---

## Edge Cases (Nice to Have)

- [ ] First message is 500 characters → title truncates to 50 + "..."
- [ ] Click 5 conversations rapidly → only last one loads
- [ ] Send empty message (whitespace only) → error shown
- [ ] Conversation at 1,000 messages → error prevents 1,001st
- [ ] MongoDB quota exceeded → clear error message

---

## Browser Compatibility (Spot Check)

- [ ] Chrome (latest) - all features work
- [ ] Firefox (latest) - all features work
- [ ] Safari (latest) - all features work
- [ ] Mobile Safari iOS 14+ - touch gestures work
- [ ] Chrome Mobile Android - responsive layout correct

---

## Playwright Test Structure

```typescript
// Example test structure for validation

test.describe('Chat History - Critical Path', () => {
  test('First time user creates conversation', async ({ page }) => {
    // Navigate to app
    // Verify no conversations
    // Send message
    // Verify conversation saved
    // Verify sidebar shows conversation
  });

  test('Load existing conversation', async ({ page }) => {
    // Create 5 conversations via API
    // Open sidebar
    // Click 3rd conversation
    // Verify messages load
    // Verify highlight
  });

  // ... more tests
});

test.describe('Chat History - Responsive', () => {
  test.use({ viewport: { width: 1920, height: 1080 } });
  // Desktop tests

  test.use({ viewport: { width: 768, height: 1024 } });
  // Tablet tests

  test.use({ viewport: { width: 375, height: 667 } });
  // Mobile tests
});
```

---

## Manual Validation Notes

**After Implementation, Fran Should Test:**

1. **Conversation Flow** (5 min)
   - Create, load, delete conversations
   - Verify MongoDB persistence via Atlas UI

2. **Responsive Design** (5 min)
   - Resize browser from 375px → 1920px
   - Test sidebar behavior at each breakpoint

3. **Error States** (3 min)
   - Disconnect internet → verify error handling
   - Kill MongoDB → verify graceful degradation

4. **Performance** (2 min)
   - Open sidebar with 50+ conversations
   - Switch between conversations rapidly
   - Verify smooth animations

**Total Manual Testing Time**: ~15 minutes

---

**Document Version**: 1.0
**Created By**: QA Criteria Validator Agent
**Date**: 2025-10-08
