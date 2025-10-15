# Theme Architecture Integration Plan

## Executive Summary

This document outlines the architectural integration strategy for dark/light mode theme switching in the Next.js application. The solution balances simplicity, architectural consistency, and maintainability while respecting the established hexagonal architecture and feature-based frontend patterns.

## Architectural Decision: Theme as Infrastructure Concern

**Decision:** Theme management should **NOT** be a separate feature but rather an **infrastructure-level concern** integrated at the root layout level.

### Rationale

1. **Cross-Cutting Concern**: Theme affects the entire application, not a specific business domain
2. **No Business Logic**: Theme switching is purely presentational with no domain rules
3. **No Complex State**: Uses simple localStorage persistence via next-themes
4. **No React Query Integration**: Theme state doesn't require server synchronization
5. **Architectural Simplicity**: Avoids over-engineering a straightforward UI concern

### What This Means

- Theme provider lives at root layout (`app/layout.tsx`)
- Theme toggle component lives at infrastructure level (`components/theme-toggle.tsx`)
- No `app/features/theme/` directory needed
- Use `next-themes` directly without custom wrapper hooks (unless specific business logic is needed)

## Integration Points

### 1. Root Layout Integration

**File:** `app/layout.tsx`

**Changes Required:**
- Wrap children with `ThemeProvider` from next-themes
- Remove hardcoded `dark` class from body
- Provide `suppressHydrationWarning` to html element (required by next-themes)

**Key Considerations:**
- ThemeProvider must be client component, but layout can remain server component
- Use `"use client"` directive only where necessary (create wrapper if needed)
- Maintain existing structure (Toaster, Navbar, children order)

**Code Pattern:**
```typescript
import { ThemeProvider } from '@/components/theme-provider'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={cn(GeistSans.className, "antialiased")}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <Toaster position="top-center" richColors />
          <Navbar />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

### 2. Theme Provider Component

**File:** `components/theme-provider.tsx`

**Purpose:** Thin wrapper around next-themes provider for type safety and configuration

**Key Points:**
- "use client" directive required
- Re-exports ThemeProvider from next-themes
- Provides TypeScript types for provider props
- No additional business logic

**Dependencies:**
- next-themes (already in package.json)

### 3. Theme Toggle Component

**File:** `components/theme-toggle.tsx`

**Purpose:** UI component for switching themes

**Placement Options:**
1. **Navbar Integration** (Recommended): Add to `components/navbar.tsx`
2. **Standalone Component**: Create separate component called from Navbar

**Design Requirements:**
- Use shadcn/ui Button component
- Use lucide-react icons (Sun, Moon, Computer/Monitor)
- Support three modes: light, dark, system
- Use dropdown menu for better UX (DropdownMenu from shadcn/ui)

**User Experience:**
- Show current theme state
- Provide visual feedback on selection
- Persist selection automatically (handled by next-themes)

### 4. Navbar Integration

**File:** `components/navbar.tsx`

**Current State:** Nearly empty component with flex layout

**Changes Required:**
- Add ThemeToggle component to navbar
- Position appropriately (typically right side)
- Ensure proper spacing and alignment

**Layout Considerations:**
- Navbar is currently empty (`p-2 flex flex-row gap-2 justify-between`)
- ThemeToggle should be placed in the right side of justify-between
- Maintain existing padding and gap patterns

## Theme Configuration

### Tailwind Configuration

**File:** `tailwind.config.js`

**Current State:** Already configured correctly
- `darkMode: ['class']` ✅
- CSS variables for colors ✅

**No Changes Required:** Tailwind is already set up for class-based dark mode

### CSS Variables

**File:** `app/globals.css`

**Current State:** Already configured with:
- `:root` for light theme variables
- `.dark` for dark theme variables
- Complete color system (background, foreground, primary, secondary, etc.)

**No Changes Required:** CSS variables are production-ready

## State Management Strategy

### No Feature-Level State Management Needed

**Why?**
1. **No Business Logic**: Theme is purely presentational
2. **Simple State**: Only 3 values (light, dark, system)
3. **Library Handles Everything**: next-themes manages state, persistence, and system detection
4. **No API Calls**: No server synchronization needed
5. **No Complex Workflows**: No multi-step processes

### No React Query Integration

**Why?**
1. **No Server State**: Theme preference is client-side only
2. **No Mutations**: No API endpoints to call
3. **No Cache Invalidation**: No server data to sync
4. **localStorage Sufficient**: next-themes uses localStorage by default

### No Custom Context Hook Needed

**Why?**
1. **next-themes Provides Hook**: `useTheme()` hook already available
2. **No Additional Operations**: No business logic to encapsulate
3. **No Derived State**: Theme state is simple and direct
4. **No Orchestration**: No multiple queries/mutations to coordinate

### When to Use Custom Hook

**Only if you need:**
- Theme-specific business logic (e.g., "only allow dark mode for premium users")
- Analytics tracking on theme changes
- Complex derived state (e.g., "compute contrast ratio")
- Integration with other features (e.g., "sync theme with user profile API")

**For basic theme switching: Use `useTheme()` from next-themes directly**

## Integration with Existing Architecture

### Conversation Feature

**File:** `app/features/conversation/components/chat-container.tsx`

**No Changes Required:**
- Components already use CSS variables (`bg-background`, `text-foreground`)
- Tailwind's dark mode classes will work automatically
- No business logic changes needed

**Verification Required:**
- Test all conversation components in both themes
- Ensure proper contrast and readability
- Check skeleton loading states in dark mode

### Storage Service

**File:** `app/features/conversation/data/services/storage.service.ts`

**No Changes Required:**
- Theme uses localStorage (via next-themes)
- Conversation uses sessionStorage
- No conflicts or interference

### React Query Usage

**Files:**
- `app/features/conversation/hooks/queries/useConversationQuery.ts`
- `app/features/conversation/hooks/mutations/useConversationMutation.ts`

**No Changes Required:**
- Theme state is independent of server state
- React Query continues to handle conversation data
- No cache invalidation needed for theme changes

## Component Architecture

### Component Hierarchy

```
app/layout.tsx (Server Component)
├── ThemeProvider (Client Component Boundary)
│   ├── Toaster
│   ├── Navbar (Client Component)
│   │   └── ThemeToggle (Client Component)
│   └── children (Page Components)
```

### Client Component Boundaries

**Minimal Client Components:**
1. `ThemeProvider` - Required by next-themes
2. `Navbar` - Already client component (empty but needs "use client")
3. `ThemeToggle` - Interactive component

**Server Components:**
- Layout remains server component (wrap children only)
- Page components remain server unless interactive

## Implementation Files Checklist

### New Files to Create

1. **`components/theme-provider.tsx`**
   - Thin wrapper around next-themes ThemeProvider
   - Type definitions
   - Default configuration

2. **`components/theme-toggle.tsx`**
   - Theme switch UI component
   - Uses DropdownMenu from shadcn/ui
   - Three options: Light, Dark, System

### Existing Files to Modify

1. **`app/layout.tsx`**
   - Add ThemeProvider wrapper
   - Remove hardcoded "dark" class
   - Add suppressHydrationWarning to html

2. **`components/navbar.tsx`**
   - Add "use client" directive if not present
   - Import and render ThemeToggle
   - Position in navbar layout

### Files to Review (No Changes Expected)

1. **`app/globals.css`** - Already configured
2. **`tailwind.config.js`** - Already configured
3. **Conversation components** - Should work automatically

## Installation Requirements

### Dependencies

**Already Installed:**
- `next-themes@^0.2.1` ✅ (in package.json)

**shadcn/ui Components Needed:**
```bash
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add button
```

Note: Button likely already exists, verify first

## Testing Strategy

### Manual Testing Checklist

1. **Theme Switching:**
   - [ ] Switch between light, dark, and system modes
   - [ ] Verify persistence across page refreshes
   - [ ] Test system preference detection
   - [ ] Verify no flash of wrong theme on page load

2. **Component Rendering:**
   - [ ] All conversation components render correctly in both themes
   - [ ] Navbar displays properly in both themes
   - [ ] Buttons and interactive elements have proper contrast
   - [ ] Loading states (skeleton) work in both themes

3. **Edge Cases:**
   - [ ] Theme works with no localStorage available
   - [ ] System theme changes are detected
   - [ ] No hydration errors in console
   - [ ] Works in SSR/SSG pages

### Unit Testing

**Files to Test:**
- `components/theme-provider.tsx` - Verify provider configuration
- `components/theme-toggle.tsx` - Test theme switching logic

**Test Coverage:**
- Theme toggle renders correctly
- Clicking options updates theme
- Current theme is visually indicated
- Accessibility (keyboard navigation, ARIA labels)

## Accessibility Considerations

### Requirements

1. **Keyboard Navigation:**
   - Theme toggle accessible via keyboard
   - DropdownMenu supports arrow keys
   - Proper focus management

2. **Screen Readers:**
   - Proper ARIA labels for theme options
   - Announce current theme state
   - Use semantic HTML

3. **Visual:**
   - Sufficient contrast in both themes
   - Clear visual indication of current theme
   - Icons + text labels for clarity

### Implementation Notes

- lucide-react icons have proper accessibility
- shadcn/ui DropdownMenu has built-in ARIA support
- Add descriptive labels to all options

## Migration Strategy

### Current State

- Hardcoded dark mode in `app/layout.tsx` (line 36: `className="dark"`)
- All components use CSS variables
- Tailwind configured for class-based dark mode

### Migration Steps

1. **Install Dependencies:**
   ```bash
   npx shadcn-ui@latest add dropdown-menu
   ```

2. **Create ThemeProvider Component:**
   - Create `components/theme-provider.tsx`
   - Configure next-themes with proper options

3. **Create ThemeToggle Component:**
   - Create `components/theme-toggle.tsx`
   - Implement dropdown with three options

4. **Update Layout:**
   - Wrap children with ThemeProvider
   - Remove hardcoded "dark" class
   - Add suppressHydrationWarning

5. **Update Navbar:**
   - Add "use client" if not present
   - Add ThemeToggle component

6. **Test & Verify:**
   - Test all theme modes
   - Verify persistence
   - Check all pages/components

## Performance Considerations

### Optimization Points

1. **No Hydration Mismatch:**
   - Use suppressHydrationWarning on html element
   - next-themes handles hydration correctly
   - No flash of unstyled content

2. **Minimal JavaScript:**
   - next-themes is lightweight (~3KB)
   - No additional state management overhead
   - localStorage access is synchronous (fast)

3. **CSS Variables:**
   - Already using CSS variables (optimal for theme switching)
   - No runtime style calculations
   - Browser handles theme application efficiently

### Anti-Patterns to Avoid

- ❌ Don't create custom localStorage hooks (next-themes handles it)
- ❌ Don't use React Query for theme state (overkill)
- ❌ Don't create feature directory for theme (over-engineering)
- ❌ Don't add theme to conversation context (separation of concerns)
- ❌ Don't trigger re-renders of entire app (next-themes optimizes this)

## Documentation Requirements

### Code Comments

All new files must include ABOUTME comments:

**Example:**
```typescript
// ABOUTME: Theme provider wrapper for next-themes with application configuration
// ABOUTME: Enables dark/light mode switching with system preference detection
```

### Session Context Updates

**File:** `.claude/sessions/context_session_dark_light_mode.md`

**Must Include:**
- Architecture decision (infrastructure-level concern)
- Files created/modified
- Integration points
- Testing results
- Known issues or limitations

## Future Enhancements

### Potential Extensions (Not in MVP)

1. **Per-Feature Themes:**
   - If needed, create feature-specific theme variants
   - Use CSS variables scoping

2. **Theme Customization:**
   - User-selectable color schemes
   - Custom accent colors
   - Would require feature-level implementation

3. **Analytics Integration:**
   - Track theme preference
   - A/B testing different themes
   - Would justify custom useTheme wrapper

4. **API Synchronization:**
   - Save theme preference to user profile
   - Would require React Query integration
   - Would justify feature-based architecture

**For MVP: Keep it simple - just light/dark/system toggle**

## Key Architectural Principles Applied

### 1. Separation of Concerns
- Theme (presentation) separate from business logic (conversation)
- Infrastructure concern, not domain concern

### 2. Minimal Abstraction
- Use next-themes directly (don't wrap unnecessarily)
- No custom state management for simple use case

### 3. Feature-Based Organization
- Theme is NOT a feature (no business logic)
- Conversation feature remains independent

### 4. React Query Pattern
- Only for server state (API calls)
- Theme is client-only, uses localStorage

### 5. Component Purity
- ThemeToggle is pure presentational component
- Business logic in hooks (if needed in future)

## Risk Assessment

### Low Risk
- ✅ CSS variables already defined
- ✅ Tailwind already configured
- ✅ next-themes is mature and stable
- ✅ No breaking changes to existing code

### Medium Risk
- ⚠️ Hydration warnings if not configured correctly (mitigated by suppressHydrationWarning)
- ⚠️ Theme flash on initial load (mitigated by next-themes script injection)

### Mitigation Strategies
- Follow next-themes documentation exactly
- Use suppressHydrationWarning on html element
- Test SSR/SSG pages thoroughly
- Add unit tests for theme components

## Success Criteria

### Functional
- [x] User can switch between light, dark, and system themes
- [x] Theme preference persists across sessions
- [x] System theme preference is detected and applied
- [x] No flash of wrong theme on page load
- [x] All existing components work in both themes

### Technical
- [x] No hydration errors
- [x] Proper TypeScript typing
- [x] Minimal performance impact
- [x] Accessible to keyboard and screen reader users
- [x] Unit tests for theme components

### Architectural
- [x] No violation of hexagonal architecture principles
- [x] Theme concern properly separated from business logic
- [x] Minimal abstraction for simple use case
- [x] No unnecessary state management complexity
- [x] Follows established component patterns

## Conclusion

The theme integration should be implemented as a **simple, infrastructure-level concern** using next-themes directly, without creating a feature directory or custom state management. This approach:

1. **Maintains architectural integrity** - Respects hexagonal architecture by keeping presentation separate from domain
2. **Avoids over-engineering** - Uses library directly for straightforward use case
3. **Preserves feature independence** - Conversation feature remains unaffected
4. **Follows best practices** - Leverages CSS variables and Tailwind's dark mode
5. **Ensures maintainability** - Simple code, clear boundaries, minimal abstraction

The implementation should be straightforward, touching only 4 files (2 new, 2 modified), with no changes to business logic or existing features.
