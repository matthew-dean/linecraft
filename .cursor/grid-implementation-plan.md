# Grid Implementation Plan

## Overview

Replace the current flex/col system with a simplified CSS Grid-based layout system that:
- Eliminates circular measurement complexity
- Uses explicit column templates (parent defines widths upfront)
- Simplifies component pattern to pure functions returning strings
- Reduces overall API surface area

## Questions & Architectural Decisions

### 1. Grid Scope - What subset of CSS Grid do we need?

**Proposed minimal subset:**
- **Column templates only** - `template: [20, '1*', '2*']` (fixed width, flex units)
- **No row templates** - Terminal is single-line per grid (no vertical grid)
- **No grid areas** - Just sequential column assignment
- **No auto-placement** - Children assigned to columns in order

**Questions:**
- Do we need `minmax()` equivalent? (e.g., `{ min: 40, width: '2*' }`)
- Do we need `repeat()`? (e.g., `template: { repeat: '1fr' }` for equal columns)
- Do we need `auto` keyword? (content-based sizing)
- Should we support `gap` or just `spaceBetween`?

**Recommendation:** Start with:
- Fixed widths: `20`, `30`
- Flex units: `'1*'`, `'2*'` (like `1fr`, `2fr`)
- Minmax: `{ min: 40, width: '2*' }`
- Gap: `columnGap: 2` (spaces between columns)
- Skip `repeat()` and `auto` initially - can add if needed

### 2. Component Pattern - Function-based vs Classes

**Proposed pattern:**
```ts
type Component = (options: Record<string, any>, ...rest: any[]) =>
  (ctx: RenderContext) =>
    string | string[] | null
```

**Questions:**
- Does `RenderContext` need `parent`? Or just `availableWidth`?
- Should components have access to `region`? Or is that implicit?
- How do we handle components that need state (like progress bar updates)?
- Can we eliminate classes entirely, or do we need them for some cases?

**Recommendation:**
- `RenderContext` should include:
  - `availableWidth: number` - Width available for this component
  - `region: TerminalRegion` - For setLine access
  - `columnIndex?: number` - Which grid column this is (for debugging)
- Components that need state (progress bar, spinner) can still be classes, but they return render functions
- Most components can be pure functions

### 3. Multi-line Content

**Question:** How do we handle components that return `string[]`?

**Proposed solution:**
- Grid is single-line by default
- If a component returns `string[]`, it renders on multiple lines
- Grid expands vertically to accommodate (like current flex system)
- Each grid row is independent - no vertical alignment needed

**Example:**
```ts
grid({ template: [20, '1*'] },
  'Label:',  // Single line
  wrap({ width: 50 }, 'Long text that wraps to multiple lines')  // Multi-line
)
// Grid height = max(1, wrap height)
```

### 4. Nested Grids

**Question:** How do nested grids work?

**Proposed solution:**
- Nested grid is just another component
- It receives its allocated width from parent grid
- It then distributes that width to its own columns
- No special handling needed - just recursive rendering

**Example:**
```ts
grid({ template: ['2*', '1*'] },
  grid({ template: ['1*', '1*'] }, 'A', 'B'),  // Nested grid
  'C'
)
```

### 5. Overflow & Ellipsis

**Question:** How do we handle text overflow in the new system?

**Proposed solution:**
- Each component receives `availableWidth` in context
- Component is responsible for truncating/ellipsis
- Can provide helper: `style({ overflow: 'ellipsis-end' }, text)`
- Or simpler: `ellipsis(text, availableWidth, 'end')`

**Recommendation:** Keep overflow as a style option, but make it simpler:
```ts
style({ overflow: 'ellipsis-end' }, 'Long text')
// vs
ellipsis('Long text', ctx.availableWidth, 'end')
```

### 6. Responsive/Query System

**Question:** Do we need a `query()` component, or can we simplify?

**Proposed solution:**
- `query({ gt: 50 }, component)` - only render if width > 50
- Returns `null` if condition fails (grid skips that column)
- Grid recalculates widths when column is null

**Alternative:** Make it a style option?
```ts
style({ showIf: (ctx) => ctx.availableWidth > 50 }, 'Text')
```

**Recommendation:** Keep `query()` as a separate component for clarity

### 7. Borders

**Question:** Do we need borders, or can we simplify?

**Proposed solution:**
- Start without borders - can add later if needed
- If we add borders, make it simple: `border: 'rounded' | 'box' | 'single' | 'double'`
- Border draws around entire grid, not individual cells

**Recommendation:** Skip borders initially - focus on core layout

### 8. Progress Bar & Other Components

**Question:** How do existing components (progress bar, spinner) work in the new system?

**Proposed solution:**
- Progress bar becomes a component function that returns a render function
- It can still use internal state for updates
- Returns string (or string[] for multi-line)

**Example:**
```ts
const progressBar = (options) => (ctx) => {
  const percent = (options.current / options.total) * 100;
  const barWidth = ctx.availableWidth - 10; // Account for brackets, percent
  // ... render logic
  return `☾ ${bar} ☽ ${percent}%`;
}
```

### 9. Region.set() API

**Question:** Does `region.set()` API change?

**Proposed solution:**
- Keep `region.set()` but it accepts grid components
- Grid components are just functions, so API stays similar
- Example: `region.set(grid({ template: [...] }, ...children))`

### 10. Migration Path

**Question:** How do we migrate existing code?

**Proposed solution:**
1. Implement grid system alongside flex/col
2. Update examples to use grid
3. Add tests for grid
4. Remove flex/col once grid is proven
5. Update documentation

## Proposed API

### Core Grid Function

```ts
function grid(
  options: GridOptions,
  ...children: Component[]
): GridComponent

interface GridOptions {
  template: (number | string | { min: number; width: string })[];
  columnGap?: number;  // Spaces between columns
  spaceBetween?: string | string[];  // Characters to draw between columns
  border?: 'rounded' | 'box' | 'single' | 'double';
  borderColor?: Color;
}

// Template examples:
// [20, '1*'] - fixed 20, flex 1
// ['1*', '2*', '1*'] - flex ratios
// [{ min: 40, width: '2*' }, '1*'] - minmax equivalent
```

### Component Pattern

```ts
type Component = (
  options: Record<string, any>,
  ...children: any[]
) => (ctx: RenderContext) => string | string[] | null;

interface RenderContext {
  availableWidth: number;
  region: TerminalRegion;
  columnIndex: number;
  rowIndex: number;  // For multi-line grids
}
```

### Style Component

```ts
function style(
  options: StyleOptions,
  content: string
): Component

interface StyleOptions {
  color?: Color;
  backgroundColor?: Color;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  overflow?: 'none' | 'ellipsis-end' | 'ellipsis-start' | 'ellipsis-middle' | 'wrap';
}
```

### Query Component (Responsive)

```ts
function query(
  condition: QueryCondition,
  component: Component
): Component

interface QueryCondition {
  gt?: number;  // Greater than width
  lt?: number;  // Less than width
  eq?: number;  // Equal to width
}
```

### Helper Functions

```ts
function fill(options: StyleOptions, char: string): Component
// Creates a component that fills available width with a character

function ellipsis(text: string, width: number, type: 'end' | 'start' | 'middle'): string
// Helper for truncating text
```

## Implementation Steps

1. **Create Grid Core** (`src/ts/layout/grid.ts`)
   - Parse template (numbers, flex units, minmax)
   - Calculate column widths from template
   - Distribute available width to columns
   - Render children in columns

2. **Create Component Helpers** (`src/ts/components/`)
   - `style()` - Text styling component
   - `query()` - Responsive component
   - `fill()` - Fill component for spaceBetween

3. **Update Progress Bar** (`src/ts/components/progress-bar.ts`)
   - Convert to new component pattern
   - Return render function

4. **Update Examples**
   - Convert all examples to use grid
   - Remove flex/col usage

5. **Add Tests**
   - Grid template parsing
   - Column width calculation
   - Flex unit distribution
   - Minmax handling
   - Null component handling
   - Nested grids
   - Multi-line content

6. **Remove Flex/Col**
   - Delete flex/col code
   - Update imports
   - Update documentation

## Grid Algorithm Reference

Reference CSS Grid spec:
- https://www.w3.org/TR/css-grid-1/#grid-template-columns
- https://www.w3.org/TR/css-grid-1/#track-sizing

Key algorithm:
1. Parse template into track sizes (fixed, flex, minmax)
2. Calculate fixed track sizes
3. Distribute remaining space to flex tracks proportionally
4. Apply minmax constraints
5. Assign children to tracks in order

## Open Questions for User

1. **Do we need `repeat()`?** - For equal columns: `template: { repeat: 3, value: '1*' }`
2. **Do we need `auto`?** - Content-based sizing: `template: ['auto', '1*']`
3. **Do we need borders?** - Or skip for now?
4. **How should `spaceBetween` work?** - Array of characters, or single character repeated?
5. **Should `query()` be a component or a style option?**
6. **Do we need row support?** - Or is single-line grid enough?
7. **How do we handle components that need state?** - Classes or closures?

