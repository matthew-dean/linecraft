# Pivot Plan: Flex/Col → Grid Migration

## Context

Right now, we have a simplified version of a "CSS flexbox" component with a partner "col" component. This is leading to complexity:
- Circular measurement algorithm (children measure, parent distributes, children re-measure)
- Nested flex complexity (flex children of flex)
- Hard to reason about width allocation

## Goal

Replace flex/col with a simplified CSS Grid-based layout system that:
1. Uses explicit column templates (parent defines widths upfront)
2. Eliminates circular measurement complexity
3. Simplifies component pattern to pure functions returning strings
4. Reduces overall API surface area

## Migration Steps

1. Add a simplified version of "CSS Grid"
2. Replace all use cases of flex/col components with grid
3. Remove flex/col components entirely

## Reasoning

Right now, flexbox has to inspect each child and what they would like to be "granted" in terms of width. The Flexbox algorithm sort of tallies it all up, and then makes a determination of what it can grant, and then uses that to size each child. So it's a circular algorithm, in some respects.

CSS Grid is different. The parent specifies up front what the grid template will be, and children are assigned those available widths. At least, that's the approach we will use, to simplify it down, and only expose what makes sense for a terminal.

## Component Pattern

**Simplified function-based pattern (no classes needed for most cases):**

```ts
/**
 * Component type: function that takes options and children, returns a render function
 * Render function takes context and returns string(s) or null
 * 
 * A component that returns null removes itself from the grid template slot.
 * The grid recalculates widths, assigning 0 width to the null component.
 * On resize, the process starts from the beginning.
*/
type Component = (
  options: Record<string, any>,
  ...children: any[]
) => (ctx: RenderContext) => string | string[] | null;

/**
 * RenderContext provides information needed for rendering
 */
interface RenderContext {
  availableWidth: number;  // Width allocated to this component
  region: TerminalRegion;  // For setLine access (needed for multi-line)
  columnIndex: number;     // Which grid column (0-based)
  rowIndex: number;         // Which grid row (0-based, for multi-line)
}

// Example component
const myComponent: Component = function myComponent(options: MyComponentOptions, ...children) {
  return (ctx: RenderContext) => {
    // Simple: return string
    return 'string';
    
    // Or: compose children
    return children.map(c => c(ctx)).join('');
    
    // Or: multi-line
    return ['Line 1', 'Line 2'];
    
    // Or: conditional (returns null to remove from grid)
    if (ctx.availableWidth < 10) return null;
    return 'text';
  };
};
```

**Components return ANSI strings or arrays of strings** - simple and direct.

**State Management:**
Components don't need internal state - they capture options in closures. When you need to update:
```ts
// Initial render
region.set(grid({ template: ['1*'] }, progressBar({ current: 0, total: 100 })));

// Update - just call set() again with new options
region.set(grid({ template: ['1*'] }, progressBar({ current: 50, total: 100 })));
```

The grid re-renders automatically. No need for components to "notify" - the user controls updates by calling `region.set()`.

**Multi-Line Content (`string[]`):**

When a component returns `string[]`, it means multiple lines. Here's how different components handle it:

**Grid Component:**
- If any column returns `string[]`, the grid expands vertically to accommodate
- Grid height = max height of all columns
- Each column renders its lines independently (top-aligned)
- Example:
  ```ts
  grid({ template: [20, '1*'] },
    'Single line',           // Column 1: 1 line
    ['Line 1', 'Line 2']     // Column 2: 2 lines
  )
  // Grid height = 2 lines
  // Column 1 renders on line 1 only
  // Column 2 renders on lines 1-2
  ```

**Style Component:**
- Applies styling to each line in the array
- Returns styled `string[]`
- Example:
  ```ts
  style({ color: 'red' }, ['Line 1', 'Line 2'])
  // Returns: [red('Line 1'), red('Line 2')]
  ```

**Query Component:**
- Checks condition, then returns the array or `null`
- Example:
  ```ts
  query({ gt: 50 }, ['Line 1', 'Line 2'])
  // Returns: ['Line 1', 'Line 2'] if width > 50, else null
  ```

**Nested Grid:**
- Nested grid receives its allocated width and renders its own multi-line content
- Parent grid handles the vertical expansion
- Example:
  ```ts
  grid({ template: ['1*', '1*'] },
    grid({ template: ['1*'] }, ['A1', 'A2']),  // Nested grid: 2 lines
    'B'                                        // Single line
  )
  // Parent grid height = 2 lines
  // Left column (nested grid) renders on lines 1-2
  // Right column renders on line 1 only
  ```

**General Rule:**
- Most wrapper components (style, query) just pass through `string[]`
- Only the grid component actually handles multi-line layout
- Grid expands vertically to fit the tallest column

## What It Solves

This solves many cases that are hard to reason about:
- **Nested flex complexity**: Instead of flex children of flex, use nested grids
- **Circular measurement**: Grid defines widths upfront, no circular dependencies
- **Multi-line layouts**: Grid naturally handles multi-line content
- **Responsive behavior**: Query components can return null to remove themselves

### Basic Progress Bar

```ts
r.set(
  grid({ template: [20, '1*'] },
    style({ color: 'cyan' }, 'Installing packages...'),
    progressBar({
      current: 0,
      total: 100,
      barColor: 'green',
      bracketColor: 'brightBlack',
      percentColor: 'yellow'
    })
  )
)
```

**Note:** Progress bar no longer needs `width` - it uses `ctx.availableWidth` from the grid.

### Flex Ratios

```ts
grid(
  {
    /** 1* is same as 1fr in CSS Grid spec */
    template: ['1*', '2*', '1*'],
    /** Characters to draw between columns */
    spaceBetween: '─'  // Single character, repeated
    // Or: spaceBetween: ['━', '═', '┄']  // Array, repeats last if not enough
  },
  style({ color: 'red' }, 'Flex 1'),
  style({ color: 'blue' }, 'Flex 2'),
  style({ color: 'magenta' }, 'Flex 1')
)
```

### Responsive (Using `when`)

```ts
grid(
  {
    template: [15, 20, '1*']
  },
  style({ color: 'cyan' }, 'Always visible'),
  style({ 
    color: 'green', 
    when: (ctx) => ctx.availableWidth > 50 
  }, 'Hidden < 50'),
  style({ color: 'yellow' }, 'Flexible')
)
```

**Note:** `when` returns `null` if condition fails, removing that column from the grid.

### Ellipsis & Overflow

```ts
grid(
  {
    template: ['1*', '3*', '2*', '1*'],
    /** Array of characters for gaps - repeats last if not enough */
    spaceBetween: ['━', '═', '┄']
  },
  style({ overflow: 'ellipsis-end', color: 'red' }, 'Flex 1'),
  style({ overflow: 'ellipsis-end', color: 'blue' }, 'Flex 3'),
  style({ overflow: 'ellipsis-end', color: 'green' }, 'Flex 2'),
  style({ color: 'yellow' }, 'Flex 1')
)
```

### Nested Grids with Minmax

```ts
grid(
  {
    columnGap: 2,
    /** Minmax equivalent: minimum 40, then flex 2* */
    template: [{ min: 40, width: '2*' }, '1*']
  },
  grid(
    {
      columnGap: 2,
      /** Equal columns - no repeat() needed, just use array */
      template: ['1*', '1*']
    },
    'Sub-grid 1',
    'Sub-grid 2'
  ),
  style({ color: 'red', backgroundColor: 'white' }, 'Flex remainder')
)
```

**Note:** No `repeat()` needed - just use `['1*', '1*', '1*']` for equal columns. If you have more children than template slots, the last template value is repeated automatically.

### Justify-Content (Space-Between)

For left/right items with a flexing middle (like OhMyZsh prompt):

```ts
grid(
  {
    template: ['auto', '1*', 'auto'],  // Left fixed, middle flexes, right fixed
    justify: 'space-between'  // Left item, flexing middle, right item
  },
  style({ color: 'blue' }, '~/git/oss/linecraft'),
  style({ color: 'brightBlack' }, '─'),  // This flexes in the middle
  style({ color: 'green' }, '✓')
)
```

**Alternative approach (simpler):**
```ts
grid(
  {
    template: ['auto', '1*', 'auto'],
    spaceBetween: '─'  // Draws between all columns, middle one flexes
  },
  style({ color: 'blue' }, '~/git/oss/linecraft'),
  '',  // Empty middle - spaceBetween fills it
  style({ color: 'green' }, '✓')
)
```

**Recommendation:** Use `justify: 'space-between'` - it's clearer and matches CSS Grid's `justify-content`.

## Grid API

### Core Grid Function

```ts
function grid(
  options: GridOptions,
  ...children: Component[]
): Component

interface GridOptions {
  /** Column template: fixed widths, flex units, or minmax */
  template: (number | string | { min: number; width: string })[];
  
  /** Spaces between columns (default: 0) */
  columnGap?: number;
  
  /** Characters to draw between columns (fills blank space until next column) */
  spaceBetween?: string | string[] | { char: string; color?: Color };
  // Single char: '─'
  // Array: ['━', '═', '┄'] (repeats last if not enough)
  // Object: { char: '─', color: 'brightBlack' }
  
  /** Justify content: 'space-between' for left/right items with flexing middle */
  justify?: 'start' | 'end' | 'center' | 'space-between';
  
  /** Border style (skip initially, add later if needed) */
  border?: 'rounded' | 'box' | 'single' | 'double';
  borderColor?: Color;
}
```

### Template Examples

```ts
// Fixed width
template: [20, 30]

// Flex units (like CSS fr)
template: ['1*', '2*', '1*']

// Minmax
template: [{ min: 40, width: '2*' }, '1*']

// Mixed
template: [20, '1*', { min: 10, width: '3*' }]
```

### Component Helpers

```ts
// Style component (with responsive visibility)
style({ 
  color: 'red', 
  overflow: 'ellipsis-end',
  when: (ctx) => ctx.availableWidth > 50  // Only show if width > 50
}, 'Text')
```

**Visibility:**
- `when?: (ctx: RenderContext) => boolean` - Component returns `null` if false

## Implementation Decisions

### What We're Including
- ✅ Fixed widths: `20`, `30`
- ✅ Flex units: `'1*'`, `'2*'` (like `1fr`, `2fr`)
- ✅ Minmax: `{ min: 40, width: '2*' }`
- ✅ Column gap: `columnGap: 2`
- ✅ Space between: `spaceBetween: '─'` or `['━', '═']` or `{ char: '─', color: 'brightBlack' }`
- ✅ Multi-line content: Components can return `string[]`
- ✅ Nested grids: Grids can be children of grids
- ✅ Null components: Return `null` to remove from grid
- ✅ Auto-columns: If more children than template slots, repeat last template value
- ✅ Justify-content: `justify: 'space-between'` for left/right items with flexing middle

### What We're Skipping (For Now)
- ❌ `repeat()` syntax - Auto-repeat handles it, or use `['1*', '1*', '1*']`
- ❌ `auto` keyword - Use fixed widths or minmax
- ❌ Borders - Add later if needed
- ❌ Row templates - Single-line grids only (multi-line via `string[]`)

### Auto-Columns Behavior

If you have more children than template slots, the grid automatically repeats the last template value:

```ts
grid({ template: [20, '1*'] },
  'A',  // Gets 20
  'B',  // Gets 1*
  'C',  // Gets 1* (repeated)
  'D'   // Gets 1* (repeated)
)
```

This handles the "unknown number of columns" case naturally.

**Edge Case:** If template is empty `[]`, all children get equal flex: `'1*'`

## Grid Algorithm Reference

Reference CSS Grid spec for track sizing:
- https://www.w3.org/TR/css-grid-1/#grid-template-columns
- https://www.w3.org/TR/css-grid-1/#track-sizing

**Algorithm:**
1. Parse template into track sizes (fixed, flex, minmax)
2. Calculate fixed track sizes
3. Distribute remaining space to flex tracks proportionally
4. Apply minmax constraints
5. Assign children to tracks in order

```