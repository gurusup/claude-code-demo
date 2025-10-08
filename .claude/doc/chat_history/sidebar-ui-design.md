# Conversation History Sidebar - UI/UX Design Recommendations

**Project**: Next.js AI Chat Application
**Feature**: Chat History Sidebar
**Style Guide**: shadcn/ui (new-york)
**Theme**: Dark Mode
**Date**: 2025-10-08

---

## 1. Component Selection

### Primary Components

#### **Sidebar Component** (shadcn/ui v4 `Sidebar`)
- **Why**: Built-in responsive behavior, collapsible state management, mobile support
- **Key Features**:
  - `SidebarProvider` - Manages sidebar state across the app
  - `SidebarTrigger` - Hamburger menu button (already understood by users)
  - `SidebarInset` - Main content wrapper that adjusts when sidebar opens/closes
  - `collapsible="icon"` prop - Shrinks to icon-only mode (good for desktop power users)
  - Built-in `useSidebar()` hook for state management (`isMobile`, `open`, `setOpen`)

**Recommendation**: Use the shadcn Sidebar component as the foundation. It handles all the complexity of responsive collapsing, state management, and accessibility.

#### **ScrollArea Component**
- **Why**: Handles 50-100 conversations with custom scrollbar styling
- **Usage**: Wrap the conversation list for smooth, styled scrolling
- **Benefits**:
  - Consistent scrollbar appearance across browsers
  - Better touch support on mobile
  - Proper overflow handling without layout shifts

#### **Button Component**
- **"New Chat" button**: `variant="default"` (primary action, visually prominent)
- **Delete button**: `variant="ghost" size="icon"` (subtle, icon-only)
- **Filter buttons**: `variant="outline"` when inactive, `variant="secondary"` when active

#### **Badge Component**
- **Status indicators**: Show conversation status (Active/Archived)
- **Variants**:
  - Active: `variant="default"` or custom blue badge (`bg-blue-500 text-white`)
  - Archived: `variant="secondary"` (muted appearance)
- **Size**: Small, non-intrusive (`text-xs px-2 py-0.5`)

#### **AlertDialog Component**
- **Delete confirmation**: Standard destructive action pattern
- **Why**: Prevents accidental deletion, follows UX best practices
- **Structure**:
  ```tsx
  <AlertDialog>
    <AlertDialogTrigger asChild>
      <Button variant="ghost" size="icon">
        <Trash2 />
      </Button>
    </AlertDialogTrigger>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>Delete conversation?</AlertDialogTitle>
        <AlertDialogDescription>
          This action cannot be undone. This will permanently delete this conversation.
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel>Cancel</AlertDialogCancel>
        <AlertDialogAction variant="destructive">Delete</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
  ```

#### **Separator Component**
- **Usage**: Between header sections (filters and list)
- **Styling**: `className="mx-0"` for full-width separators

#### **Skeleton Component**
- **Loading states**: Show skeleton conversation items while fetching
- **Pattern**: Use existing `.skeleton` class from `globals.css`

---

## 2. Layout Structure

### Overall Sidebar Dimensions

#### **Collapsed State** (Mobile & Icon Mode)
- **Width**: `0` (completely hidden on mobile with overlay option)
- **Icon Mode (Desktop)**: `56px` (shows only icons)
- **Trigger**: Hamburger icon button in Navbar or main content header

#### **Expanded State**
- **Width**: `280px` (desktop) - industry standard for sidebars
- **Mobile**: `100vw` or `80vw` (full-screen overlay with backdrop)
- **Transition**: Smooth `300ms ease-in-out` animation

### Sidebar Internal Structure

```
┌─────────────────────────────────┐
│ HEADER (fixed)                  │
│ ├─ New Chat Button              │
│ └─ Filter Buttons (Active/All)  │
├─────────────────────────────────┤
│ CONTENT (scrollable)            │
│ ├─ ScrollArea                   │
│ │  ├─ ConversationItem          │
│ │  ├─ ConversationItem          │
│ │  ├─ ConversationItem (active) │
│ │  └─ ... (50-100 items)        │
├─────────────────────────────────┤
│ FOOTER (optional, fixed)        │
│ └─ User settings or info        │
└─────────────────────────────────┘
```

### Header Section
**Height**: `auto` (flexible, ~120px with padding)
**Content**:
1. **New Chat Button** (primary CTA)
   - Full width with icon: `<Plus className="mr-2 h-4 w-4" /> New Chat`
   - `variant="default"` (prominent)
   - Margin: `p-4 pb-2`

2. **Filter Buttons** (Toggle group or button group)
   - Layout: Horizontal flex row
   - Options: "Active" | "Archived" | "All"
   - Styling:
     - Active filter: `variant="secondary"`
     - Inactive filter: `variant="ghost"`
   - Gap: `gap-2`
   - Margin: `px-4 pb-4`

3. **Separator** after header

### List Section
**Height**: `flex-1` (fills remaining space)
**Overflow**: ScrollArea handles vertical scrolling
**Padding**: `px-2 py-2`

**Virtualization Decision**:
- **For 50-100 items**: NOT necessary
- **Reasoning**:
  - Modern browsers handle 100 DOM elements efficiently
  - Each item is lightweight (text + timestamp)
  - Added complexity not justified
  - If list grows to 500+, then consider `@tanstack/react-virtual`

**Empty State Design**:
```tsx
<div className="flex flex-col items-center justify-center py-12 px-4 text-center">
  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
  <p className="text-sm font-medium">No conversations yet</p>
  <p className="text-xs text-muted-foreground mt-1">
    Start a new chat to begin
  </p>
</div>
```

### Footer Section (Optional)
**Recommendation**: Skip footer for simplicity unless needed for user profile/settings
**Alternative**: Use Navbar for user-related actions

---

## 3. Conversation List Item Design

### Item Structure
```tsx
<button className={cn(
  "w-full text-left rounded-lg p-3 transition-all",
  "hover:bg-accent hover:text-accent-foreground",
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
  isActive && "bg-secondary text-secondary-foreground"
)}>
  <div className="flex items-start justify-between gap-2 mb-1">
    <h3 className="font-medium text-sm line-clamp-1">{title}</h3>
    <Button
      variant="ghost"
      size="icon"
      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
      onClick={(e) => {
        e.stopPropagation();
        handleDelete(id);
      }}
    >
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  </div>
  <p className="text-xs text-muted-foreground line-clamp-1 mb-2">
    {lastMessagePreview}
  </p>
  <div className="flex items-center justify-between">
    <span className="text-xs text-muted-foreground">{timestamp}</span>
    {status && <Badge variant="secondary" className="text-xs">{status}</Badge>}
  </div>
</button>
```

### Title Truncation Strategy
- **CSS**: `line-clamp-1` (Tailwind utility)
- **Max lines**: 1 line
- **Overflow**: Ellipsis (`...`)
- **Tooltip**: Consider adding on hover for full title visibility
  ```tsx
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <h3 className="font-medium text-sm line-clamp-1">{title}</h3>
      </TooltipTrigger>
      <TooltipContent>{title}</TooltipContent>
    </Tooltip>
  </TooltipProvider>
  ```

### Preview Text Length
- **Characters**: 60-80 characters max
- **Truncation**: Server-side truncation preferred (consistent across devices)
- **CSS**: `line-clamp-1` (single line)
- **Logic**:
  ```ts
  const getPreviewText = (lastMessage: string, maxLength = 70) => {
    const stripped = lastMessage.replace(/\s+/g, ' ').trim();
    return stripped.length > maxLength
      ? stripped.slice(0, maxLength).trim() + '...'
      : stripped;
  };
  ```

### Timestamp Format
**Library**: Use `date-fns` (already popular in React ecosystem)

**Install**: `yarn add date-fns`

**Format Strategy**:
```ts
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns';

const formatTimestamp = (date: Date): string => {
  if (isToday(date)) {
    return format(date, 'h:mm a'); // "2:30 PM"
  }
  if (isYesterday(date)) {
    return 'Yesterday';
  }
  // Within last 7 days
  if (Date.now() - date.getTime() < 7 * 24 * 60 * 60 * 1000) {
    return format(date, 'EEEE'); // "Monday"
  }
  // Older
  return format(date, 'MMM d'); // "Jan 15"
};
```

**Alternative (Relative)**:
```ts
// "2 hours ago", "3 days ago"
formatDistanceToNow(date, { addSuffix: true })
```

**Recommendation**: Use the first approach (absolute time) for clarity. Users prefer knowing exact time for recent chats.

### Status Indicator
**Visual Approach**: Badge component

**Options**:
1. **Text Badge** (recommended)
   - Active: No badge (default state)
   - Archived: `<Badge variant="secondary">Archived</Badge>`

2. **Dot Indicator** (alternative)
   - Small colored dot next to title
   - Active: Blue dot (`bg-blue-500`)
   - Archived: Gray dot (`bg-muted-foreground`)

**Recommendation**: Use text badge only for Archived state. Active conversations don't need visual clutter.

### Hover States
```css
/* Applied via className */
hover:bg-accent hover:text-accent-foreground
/* Smooth transition */
transition-all duration-150
```

### Active State Styling
```tsx
className={cn(
  "bg-secondary text-secondary-foreground", // Active background
  "border-l-2 border-primary" // Left accent border (optional, adds visual weight)
)}
```

**Design Tokens** (from `globals.css`):
- `--secondary`: `240 3.7% 15.9%` (dark mode - subtle highlight)
- `--primary`: `0 0% 98%` (dark mode - white/light accent)

### Delete Button Visibility
**Recommendation**: **Show on hover** (cleaner default state)

**Implementation**:
```tsx
<div className="group relative"> {/* Add group to parent */}
  <Button
    variant="ghost"
    size="icon"
    className="opacity-0 group-hover:opacity-100 transition-opacity duration-150"
  >
    <Trash2 className="h-4 w-4" />
  </Button>
</div>
```

**Mobile Consideration**: On touch devices, show delete button on long-press or swipe gesture (future enhancement)

---

## 4. Interactions

### Toggle Animation
**shadcn Sidebar built-in animation**: Smooth slide-in/out with backdrop

**CSS Transitions**:
```css
/* Handled by Sidebar component */
transition: width 300ms cubic-bezier(0.4, 0, 0.2, 1);
```

**Mobile Overlay**:
- Background dim: `backdrop-blur-sm bg-background/80`
- Click outside to close: Built into `SidebarProvider`

### Click Behavior - Load Conversation
**User Experience Decision**:

**Recommended**: **Immediate switch** (no confirmation)

**Reasoning**:
- Most chat apps (Slack, Discord, ChatGPT) switch immediately
- Fast, responsive feel
- If users have unsaved state, handle via:
  1. Auto-save on message input changes
  2. Show toast notification: "Message saved automatically"
  3. No user input = no data loss risk

**Implementation**:
```tsx
const handleConversationClick = (conversationId: string) => {
  // Update URL
  router.push(`/chat/${conversationId}`);

  // Load conversation (via useConversation hook)
  loadConversation(conversationId);

  // Close sidebar on mobile
  if (isMobile) {
    setOpen(false);
  }
};
```

**Edge Case**: If implementing "unsaved drafts", show alert-dialog:
```tsx
if (hasUnsavedDraft) {
  // Show AlertDialog: "You have unsaved changes. Switch anyway?"
}
```

### Loading States

#### **Fetching Conversation List**
```tsx
{isLoading ? (
  <div className="space-y-2 px-2">
    {Array.from({ length: 5 }).map((_, i) => (
      <div key={i} className="skeleton rounded-lg p-3">
        <div className="skeleton-div h-4 w-3/4 mb-2" />
        <div className="skeleton-div h-3 w-full mb-2" />
        <div className="skeleton-div h-3 w-1/4" />
      </div>
    ))}
  </div>
) : (
  <ConversationList conversations={conversations} />
)}
```

#### **Loading Individual Conversation**
- Show spinner or skeleton in main chat area
- Keep sidebar responsive (no blocking UI)

### Empty State Design
**Location**: Center of scrollable list area
**Components**:
- Icon: `MessageSquare` or `MessageCircle` from `lucide-react`
- Primary text: "No conversations yet"
- Secondary text: "Start a new chat to begin"
- Optional CTA: "New Chat" button (duplicate of header button)

**Styling**:
```tsx
<div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
  <MessageSquare className="h-12 w-12 text-muted-foreground mb-4" />
  <p className="text-sm font-medium text-foreground">No conversations yet</p>
  <p className="text-xs text-muted-foreground mt-1 mb-4">
    Start a new chat to begin
  </p>
  <Button onClick={handleNewChat}>
    <Plus className="mr-2 h-4 w-4" />
    New Chat
  </Button>
</div>
```

### Error State Design
**Scenario**: Failed to load conversations from API

```tsx
<div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
  <AlertCircle className="h-12 w-12 text-destructive mb-4" />
  <p className="text-sm font-medium text-foreground">Failed to load conversations</p>
  <p className="text-xs text-muted-foreground mt-1 mb-4">
    {error.message || 'Please try again'}
  </p>
  <Button onClick={refetch} variant="outline">
    <RefreshCw className="mr-2 h-4 w-4" />
    Retry
  </Button>
</div>
```

---

## 5. Performance Considerations

### Virtualization
**Decision**: **NOT needed for 50-100 items**

**Reasoning**:
- Each list item is lightweight (~300 bytes rendered HTML)
- Total: 100 items × 300 bytes = 30KB DOM
- Modern browsers handle this effortlessly
- Scroll performance is smooth without virtualization
- Avoid premature optimization

**When to implement**:
- List grows beyond 500 items
- Performance issues detected via profiling
- Library: `@tanstack/react-virtual` (well-maintained, React Query team)

### Lazy Loading / Pagination
**Recommendation**: **Pagination** over infinite scroll

**Implementation**:
```tsx
// Fetch 50 most recent conversations initially
// "Load more" button at bottom of list
// Or cursor-based pagination via API
```

**Infinite Scroll Alternative**:
- Use `IntersectionObserver` to detect scroll bottom
- Auto-fetch next page
- Better UX for browsing history

### Image/Avatar Optimization
**Not applicable**: No avatars in current design
**If added later**: Use Next.js `<Image>` component with lazy loading

### Scroll Position Persistence
**Problem**: User scrolls through list, clicks conversation, returns to sidebar → scroll resets to top

**Solution**:
```tsx
import { useEffect, useRef } from 'react';

const ConversationList = () => {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Save scroll position before unmount
  useEffect(() => {
    const savedPosition = sessionStorage.getItem('sidebar-scroll-position');
    if (savedPosition && scrollRef.current) {
      scrollRef.current.scrollTop = parseInt(savedPosition, 10);
    }

    return () => {
      if (scrollRef.current) {
        sessionStorage.setItem(
          'sidebar-scroll-position',
          scrollRef.current.scrollTop.toString()
        );
      }
    };
  }, []);

  return <ScrollArea ref={scrollRef}>...</ScrollArea>;
};
```

**Note**: shadcn `ScrollArea` may need viewport ref access. Test implementation.

---

## 6. Accessibility

### Keyboard Navigation

#### **Tab Navigation**
- Tab order: New Chat button → Filter buttons → Conversation items → Delete buttons
- `tabIndex={0}` on all interactive elements (automatic with `<button>`)

#### **Arrow Key Navigation**
**Recommendation**: Implement custom `onKeyDown` for up/down arrows

```tsx
const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
  if (e.key === 'ArrowDown') {
    e.preventDefault();
    // Focus next item
    focusItem(index + 1);
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault();
    // Focus previous item
    focusItem(index - 1);
  }
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleConversationClick(conversation.id);
  }
};
```

#### **Sidebar Toggle**
- Keyboard shortcut: `Cmd/Ctrl + B` (standard for sidebars)
- Implement via global `useEffect` listener

### Screen Reader Announcements

#### **ARIA Labels**
```tsx
<nav aria-label="Conversation history">
  <button aria-label="New conversation">
    <Plus /> New Chat
  </button>

  <div role="group" aria-label="Filter conversations">
    <button aria-pressed={filter === 'active'}>Active</button>
    <button aria-pressed={filter === 'archived'}>Archived</button>
  </div>

  <ul role="list" aria-label="Conversations">
    <li>
      <button
        aria-label={`Conversation: ${title}, last message: ${preview}, ${timestamp}`}
        aria-current={isActive ? 'page' : undefined}
      >
        {/* Item content */}
      </button>
    </li>
  </ul>
</nav>
```

#### **Live Regions**
```tsx
<div aria-live="polite" aria-atomic="true" className="sr-only">
  {announcements.map(msg => <span key={msg}>{msg}</span>)}
</div>

// Usage:
announce("Conversation deleted");
announce("Loading conversations");
announce("5 conversations loaded");
```

#### **Delete Button**
```tsx
<Button
  aria-label={`Delete conversation: ${title}`}
  onClick={handleDelete}
>
  <Trash2 aria-hidden="true" />
</Button>
```

### Focus Management

#### **When Opening Sidebar**
```tsx
const sidebarRef = useRef<HTMLElement>(null);

useEffect(() => {
  if (open && sidebarRef.current) {
    // Focus first interactive element (New Chat button)
    const firstButton = sidebarRef.current.querySelector('button');
    firstButton?.focus();
  }
}, [open]);
```

#### **When Closing Sidebar**
```tsx
// Return focus to sidebar trigger button
triggerButtonRef.current?.focus();
```

#### **After Deleting Conversation**
```tsx
// Focus next item in list, or previous if last item
const nextIndex = deletedIndex < items.length ? deletedIndex : deletedIndex - 1;
focusItem(nextIndex);
```

### Color Contrast
**WCAG 2.1 AA Compliance**: All text must meet 4.5:1 contrast ratio

**Dark Mode Colors** (from `globals.css`):
- `--foreground`: `0 0% 98%` (near white)
- `--background`: `240 10% 3.9%` (dark gray)
- Contrast ratio: ~19:1 ✓

**Muted Text**:
- `--muted-foreground`: `240 5% 64.9%`
- Check contrast with background: Should be ~7:1 ✓

**Active State**:
- Ensure `--secondary` background + `--secondary-foreground` text have sufficient contrast

---

## 7. Responsive Design Strategy

### Breakpoints (Tailwind defaults)
- **Mobile**: `< 768px` (md breakpoint)
- **Desktop**: `≥ 768px`

### Mobile Behavior (`< 768px`)

#### **Sidebar State**
- **Default**: Closed (overlay mode)
- **Trigger**: Hamburger icon in Navbar or floating button
- **Width**: `80vw` (allows peek at main content) or `100vw` (full screen)
- **Backdrop**: Dark overlay with blur (`backdrop-blur-sm bg-background/80`)
- **Animation**: Slide in from left

#### **Mobile-Specific Adjustments**
```tsx
const { isMobile } = useSidebar();

// Adjust padding
<div className={cn("p-4", isMobile && "p-3")}>

// Close sidebar after selecting conversation
if (isMobile) {
  setOpen(false);
}

// Show delete button always (no hover on touch)
<Button className={cn(isMobile && "opacity-100")}>
```

#### **Touch Gestures**
- Swipe from left edge → Open sidebar (built into shadcn Sidebar)
- Swipe right → Close sidebar
- Tap outside → Close sidebar (built-in)

### Desktop Behavior (`≥ 768px`)

#### **Sidebar State**
- **Default**: Expanded (persistent)
- **Collapsible**: Icon mode (`56px` width, icons only)
- **Toggle**: Button in header or `Cmd/Ctrl + B`

#### **Hover Interactions**
- Delete button: Show on hover
- Tooltip: Show full title on hover
- Background highlight: `hover:bg-accent`

---

## 8. Integration with Existing Layout

### Current Layout Analysis
```tsx
// app/layout.tsx
<body>
  <Toaster />
  <Navbar />
  {children} {/* ChatContainer */}
</body>
```

### Proposed Layout with Sidebar
```tsx
<body>
  <Toaster />
  <SidebarProvider>
    <ConversationSidebar /> {/* New */}
    <SidebarInset>
      <Navbar /> {/* May need to add SidebarTrigger */}
      {children} {/* ChatContainer */}
    </SidebarInset>
  </SidebarProvider>
</body>
```

**Alternative** (if Navbar should span full width):
```tsx
<body>
  <Toaster />
  <Navbar /> {/* Keep outside SidebarProvider */}
  <SidebarProvider>
    <ConversationSidebar />
    <SidebarInset>
      {children}
    </SidebarInset>
  </SidebarProvider>
</body>
```

### Navbar Modifications
**Add Sidebar Trigger**:
```tsx
// components/navbar.tsx
import { SidebarTrigger } from '@/components/ui/sidebar';

export function Navbar() {
  return (
    <nav className="flex items-center gap-2 p-4 border-b">
      <SidebarTrigger /> {/* Hamburger icon */}
      <Separator orientation="vertical" className="h-4" />
      {/* Existing navbar content */}
    </nav>
  );
}
```

---

## 9. Design Token Reference

### Colors (from `globals.css`)
```css
.dark {
  --background: 240 10% 3.9%;        /* Main background */
  --foreground: 0 0% 98%;             /* Primary text */
  --primary: 0 0% 98%;                /* Accent color */
  --secondary: 240 3.7% 15.9%;        /* Active item background */
  --muted: 240 3.7% 15.9%;            /* Disabled elements */
  --muted-foreground: 240 5% 64.9%;   /* Secondary text */
  --accent: 240 3.7% 15.9%;           /* Hover state */
  --destructive: 0 62.8% 30.6%;       /* Delete/error color */
  --border: 240 3.7% 15.9%;           /* Borders */
}
```

### Spacing Scale (Tailwind)
- `p-2`: `8px`
- `p-3`: `12px`
- `p-4`: `16px`
- `gap-2`: `8px`
- `gap-4`: `16px`

### Typography
- Title: `text-sm font-medium` (14px, 500 weight)
- Preview: `text-xs text-muted-foreground` (12px, muted)
- Timestamp: `text-xs text-muted-foreground` (12px, muted)

---

## 10. Component Hierarchy (Final Structure)

```
ConversationSidebar (Sidebar wrapper)
├─ SidebarHeader
│  ├─ Button "New Chat" (variant="default")
│  ├─ FilterButtons (variant="ghost" | "secondary")
│  └─ Separator
├─ SidebarContent
│  └─ ScrollArea
│     ├─ ConversationList
│     │  └─ ConversationItem (button)
│     │     ├─ Title (h3, truncated)
│     │     ├─ Delete Button (ghost, hover-visible)
│     │     ├─ Preview (p, truncated)
│     │     └─ Footer (flex)
│     │        ├─ Timestamp (span)
│     │        └─ Badge (optional, status)
│     ├─ EmptyState (conditional)
│     └─ ErrorState (conditional)
├─ SidebarFooter (optional)
│  └─ User profile or settings
└─ SidebarRail
```

---

## 11. Implementation Checklist

### Phase 1: Basic Structure
- [ ] Install shadcn `sidebar` component
- [ ] Create `ConversationSidebar` component
- [ ] Wrap app in `SidebarProvider`
- [ ] Add `SidebarTrigger` to Navbar
- [ ] Test collapse/expand on desktop & mobile

### Phase 2: Header Section
- [ ] Add "New Chat" button
- [ ] Implement filter buttons (Active/Archived/All)
- [ ] Add separator

### Phase 3: Conversation List
- [ ] Create `ConversationItem` component
- [ ] Implement title truncation with tooltip
- [ ] Add preview text (truncated)
- [ ] Format timestamps with `date-fns`
- [ ] Add status badge (conditional)
- [ ] Implement active state styling
- [ ] Add hover states

### Phase 4: Actions
- [ ] Add delete button (hover-visible)
- [ ] Implement delete confirmation dialog
- [ ] Handle conversation click (load conversation)
- [ ] Close sidebar on mobile after selection

### Phase 5: States
- [ ] Add loading skeleton
- [ ] Add empty state
- [ ] Add error state with retry

### Phase 6: Performance & Accessibility
- [ ] Wrap list in ScrollArea
- [ ] Implement scroll position persistence
- [ ] Add ARIA labels
- [ ] Implement keyboard navigation
- [ ] Test screen reader announcements
- [ ] Test focus management

### Phase 7: Polish
- [ ] Test all animations
- [ ] Verify color contrast
- [ ] Test on mobile devices
- [ ] Test keyboard-only navigation
- [ ] Performance audit (100 items)

---

## 12. Key Design Decisions Summary

| **Decision Point** | **Recommendation** | **Rationale** |
|-------------------|-------------------|---------------|
| **Primary Component** | shadcn Sidebar v4 | Built-in responsive behavior, state management, accessibility |
| **Sidebar Width** | 280px (desktop) | Industry standard, comfortable reading width |
| **Collapsed Width** | 56px (icon mode) | Enough for icons, consistent with common apps |
| **Mobile Behavior** | Full overlay (80-100vw) | Clear focus, no split attention |
| **Virtualization** | Not needed | 100 items perform well without it |
| **Delete Visibility** | Show on hover | Cleaner UI, reduces visual noise |
| **Click Behavior** | Immediate switch | Faster UX, matches user expectations |
| **Timestamp Format** | Absolute (date-fns) | Clearer for recent conversations |
| **Status Badge** | Show for Archived only | Active is default state, no badge needed |
| **Empty State** | Icon + text + CTA | Friendly, actionable guidance |
| **Scroll Persistence** | sessionStorage | Preserves position across navigation |

---

## 13. Potential Future Enhancements

### Phase 2 Features (Not in MVP)
1. **Search**: Add search input in header (filter by title/content)
2. **Sorting**: Dropdown to sort by date, title, or last modified
3. **Conversation Groups**: Organize by date (Today, Yesterday, Last 7 Days)
4. **Drag-to-Reorder**: Manual conversation ordering (advanced)
5. **Multi-Select**: Bulk actions (delete, archive)
6. **Pin Conversations**: Keep important chats at top
7. **Unread Indicators**: Badge showing new messages
8. **Conversation Context Menu**: Right-click for more actions (rename, share, export)

### Performance Enhancements (If Needed)
1. **Infinite Scroll**: Replace "Load More" button
2. **Virtualization**: Implement `@tanstack/react-virtual` for 500+ items
3. **Optimistic Updates**: Immediate UI feedback on actions (delete, archive)
4. **Caching**: Use React Query cache for instant sidebar loads

---

## 14. Design Inspiration References

### Similar Patterns in Popular Apps
- **ChatGPT**: Left sidebar, collapsible, new chat button at top
- **Slack**: Channel list, hover delete, active channel highlight
- **Discord**: Server/channel sidebar, icon mode collapse
- **Notion**: Page sidebar, hover actions, tree structure

### shadcn Examples to Reference
- **sidebar-01**: Basic structure with search
- **sidebar-07**: Collapsible icon mode, footer with user
- **sidebar-12**: Calendar sidebar with sections

---

## 15. Critical Implementation Notes

### 1. **SidebarProvider Placement**
Must wrap the entire app or at least the sidebar + content area. Place in `app/layout.tsx`.

### 2. **SidebarInset Usage**
Main content (ChatContainer) must be wrapped in `<SidebarInset>` to adjust layout when sidebar opens/closes.

### 3. **Mobile Detection**
Use `useSidebar()` hook's `isMobile` property (based on viewport width), not `navigator.userAgent`.

### 4. **Focus Trap**
Sidebar should trap focus when open on mobile. shadcn Sidebar handles this automatically.

### 5. **z-index Management**
Sidebar overlay should be above main content but below modals. Check `globals.css` for z-index scale.

### 6. **Smooth Scrolling**
Apply `scroll-smooth` to ScrollArea for better UX when programmatically scrolling to items.

### 7. **Loading State Duration**
Show skeleton for minimum 300ms to avoid flash of content. Use `Promise.all([fetch(), delay(300)])`.

### 8. **Error Retry Strategy**
Implement exponential backoff for failed API calls. Use React Query's built-in retry logic.

---

## 16. Testing Checklist

### Visual Testing
- [ ] Sidebar opens/closes smoothly
- [ ] Active conversation is highlighted
- [ ] Hover states work correctly
- [ ] Delete button appears on hover
- [ ] Timestamps format correctly
- [ ] Badges display for archived conversations
- [ ] Empty state displays when no conversations
- [ ] Error state displays on API failure
- [ ] Loading skeletons match final layout

### Interaction Testing
- [ ] New Chat button creates conversation
- [ ] Filter buttons toggle correctly
- [ ] Clicking conversation loads it
- [ ] Delete confirmation dialog appears
- [ ] Delete action removes conversation
- [ ] Sidebar closes on mobile after selection
- [ ] Scroll position persists on navigation
- [ ] Scrolling works with 100 items

### Responsive Testing
- [ ] Mobile: Sidebar overlays content
- [ ] Mobile: Backdrop appears behind sidebar
- [ ] Mobile: Tap outside closes sidebar
- [ ] Desktop: Sidebar is persistent
- [ ] Desktop: Icon mode works correctly
- [ ] Transitions smooth on all screen sizes

### Accessibility Testing
- [ ] Tab key navigates all interactive elements
- [ ] Arrow keys navigate conversation list
- [ ] Enter/Space activates buttons
- [ ] Screen reader announces conversation count
- [ ] Screen reader reads conversation details
- [ ] Focus visible on all elements
- [ ] Color contrast meets WCAG AA
- [ ] Works with keyboard only (no mouse)

---

## Conclusion

This design leverages shadcn/ui's Sidebar component to create a robust, accessible, and performant conversation history sidebar. The design prioritizes:

1. **User Experience**: Fast interactions, clear visual hierarchy, intuitive navigation
2. **Accessibility**: Full keyboard support, screen reader compatibility, WCAG compliance
3. **Performance**: Efficient rendering without virtualization for 100 items
4. **Maintainability**: Standard shadcn components, minimal custom code
5. **Responsiveness**: Mobile-first overlay, desktop persistent sidebar

The implementation should feel familiar to users of modern chat applications while maintaining the clean aesthetic of the shadcn/ui new-york style guide.

---

**Next Steps**: Review this design document, clarify any questions, then proceed with implementation following the phased checklist above.
