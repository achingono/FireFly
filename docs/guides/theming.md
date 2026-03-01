# Theming Guide

FireFly adapts its visual presentation to three age-appropriate modes: **Fun** (ages 8–10), **Balanced** (ages 11–13), and **Pro** (ages 14+). Each mode adjusts colors, font sizes, border radii, spacing, and component behavior through CSS custom properties.

## Theme Modes

### Fun Mode (Ages 8–10)
- Bright purple, pink, and teal palette
- Large fonts (base: 1.125rem)
- Generous border radius (1rem)
- Playful language in UI labels
- Emoji-rich AI responses

### Balanced Mode (Ages 11–13)
- Clean indigo palette
- Standard fonts (base: 1rem)
- Medium border radius (0.625rem)
- Clear, educational tone
- Default mode for new users

### Pro Mode (Ages 14+)
- Dark IDE-style violet palette
- Compact fonts (base: 0.875rem)
- Tight border radius (0.375rem)
- Technical CS terminology
- Also applies `.dark` class on `<html>` for dark background

## How Theming Works

### ThemeContext (`lib/ThemeContext.tsx`)

The React context manages mode state with this priority:

1. **localStorage** override (user manually changed mode)
2. **`user.ageProfile`** from the authenticated user profile
3. **`"balanced"`** as the default fallback

When the mode changes, the context:
- Adds `.theme-{mode}` class to `<html>` element
- For Pro mode: also adds `.dark` class
- Persists the choice to `localStorage`

```typescript
// Usage in components
import { useTheme } from "@/lib/ThemeContext";

function MyComponent() {
  const { mode, setMode, isDark } = useTheme();
  // mode: "fun" | "balanced" | "pro"
  // setMode: (mode) => void
  // isDark: boolean (true for pro mode)
}
```

### CSS Custom Properties (`index.css`)

Each theme mode sets CSS custom properties on the `<html>` element via class selectors:

```css
/* Fun Mode */
.theme-fun {
  --ff-font-size-base: 1.125rem;
  --ff-font-size-sm: 0.9375rem;
  --ff-font-size-lg: 1.25rem;
  --ff-font-size-xl: 1.5rem;
  --ff-font-size-2xl: 2rem;
  --ff-radius: 1rem;
  --radius: 1rem;

  /* Color palette: bright purple, pink, teal */
  --primary: 280 80% 55%;
  --primary-foreground: 0 0% 100%;
  --secondary: 330 80% 60%;
  --accent: 175 70% 45%;
  /* ... more colors */
}

/* Balanced Mode */
.theme-balanced {
  --ff-font-size-base: 1rem;
  --ff-font-size-sm: 0.875rem;
  --ff-font-size-lg: 1.125rem;
  --ff-font-size-xl: 1.375rem;
  --ff-font-size-2xl: 1.75rem;
  --ff-radius: 0.625rem;
  --radius: 0.625rem;

  /* Color palette: clean indigo */
  --primary: 230 70% 50%;
  --primary-foreground: 0 0% 100%;
  /* ... more colors */
}

/* Pro Mode */
.theme-pro {
  --ff-font-size-base: 0.875rem;
  --ff-font-size-sm: 0.8125rem;
  --ff-font-size-lg: 1rem;
  --ff-font-size-xl: 1.25rem;
  --ff-font-size-2xl: 1.5rem;
  --ff-radius: 0.375rem;
  --radius: 0.375rem;

  /* Color palette: dark IDE violet */
  --primary: 260 60% 55%;
  --primary-foreground: 0 0% 100%;
  --background: 240 15% 10%;
  --foreground: 0 0% 90%;
  /* ... more colors */
}
```

### Custom Tokens

Beyond standard shadcn/ui tokens, FireFly defines additional custom properties:

| Token | Purpose | Fun | Balanced | Pro |
|-------|---------|-----|----------|-----|
| `--ff-font-size-base` | Body text | 1.125rem | 1rem | 0.875rem |
| `--ff-font-size-sm` | Small text | 0.9375rem | 0.875rem | 0.8125rem |
| `--ff-font-size-lg` | Large text | 1.25rem | 1.125rem | 1rem |
| `--ff-font-size-xl` | Extra large | 1.5rem | 1.375rem | 1.25rem |
| `--ff-font-size-2xl` | Headings | 2rem | 1.75rem | 1.5rem |
| `--ff-radius` | Border radius | 1rem | 0.625rem | 0.375rem |
| `--ff-nav-height` | Nav bar height | 4rem | 3.5rem | 3rem |
| `--ff-code-bg` | Code background | varies | varies | varies |
| `--ff-success` | Success color | green | green | green |
| `--ff-warning` | Warning color | amber | amber | amber |

### Utility Classes

Tailwind utility classes that respond to theme mode:

```css
/* Font sizes */
.ff-text-sm   { font-size: var(--ff-font-size-sm); }
.ff-text-base { font-size: var(--ff-font-size-base); }
.ff-text-lg   { font-size: var(--ff-font-size-lg); }
.ff-text-xl   { font-size: var(--ff-font-size-xl); }
.ff-text-2xl  { font-size: var(--ff-font-size-2xl); }

/* Heading shorthand */
.ff-text-heading {
  font-size: var(--ff-font-size-2xl);
  font-weight: 700;
  line-height: 1.2;
}

/* Border radius */
.ff-rounded { border-radius: var(--ff-radius); }
```

## Using Themes in Components

### Basic Usage

```tsx
// Use ff- utility classes for theme-responsive sizing
<h1 className="ff-text-heading">Page Title</h1>
<p className="ff-text-base text-muted-foreground">Description text</p>
<div className="ff-rounded bg-card p-4">
  <span className="ff-text-sm">Card content</span>
</div>
```

### Conditional Rendering by Mode

```tsx
import { useTheme } from "@/lib/ThemeContext";

function WelcomeMessage() {
  const { mode } = useTheme();

  switch (mode) {
    case "fun":
      return <h1>Hey there, coder! 🚀✨</h1>;
    case "balanced":
      return <h1>Welcome back!</h1>;
    case "pro":
      return <h1>Dashboard</h1>;
  }
}
```

### Theme-Aware AI Labels

The stepper controls use mode-aware labels:

```tsx
const { mode } = useTheme();

const labels = {
  fun: { explain: "What's happening? 🤔", hint: "Help me! 🆘" },
  balanced: { explain: "Explain this step", hint: "Get a hint" },
  pro: { explain: "Explain", hint: "Hint" },
};

<Button>{labels[mode].explain}</Button>
```

## Tailwind Integration

The `tailwind.config.js` references CSS custom properties for its color tokens:

```javascript
theme: {
  extend: {
    colors: {
      background: "hsl(var(--background))",
      foreground: "hsl(var(--foreground))",
      primary: {
        DEFAULT: "hsl(var(--primary))",
        foreground: "hsl(var(--primary-foreground))",
      },
      // ... all shadcn/ui tokens reference CSS variables
    },
    borderRadius: {
      lg: "var(--radius)",
      md: "calc(var(--radius) - 2px)",
      sm: "calc(var(--radius) - 4px)",
    },
  },
},
```

When the theme mode changes, the CSS custom properties update, and all Tailwind classes that reference them automatically reflect the new values. No JavaScript re-render needed for color/size changes.

## Adding a New Theme Property

1. **Define the custom property** in `code/client/src/index.css` for each theme:

```css
.theme-fun { --ff-my-property: value-for-fun; }
.theme-balanced { --ff-my-property: value-for-balanced; }
.theme-pro { --ff-my-property: value-for-pro; }
```

2. **(Optional) Add a utility class**:

```css
.ff-my-class { property: var(--ff-my-property); }
```

3. **(Optional) Add to Tailwind config** for use with Tailwind's `className`:

```javascript
// tailwind.config.js
theme: {
  extend: {
    // Add to appropriate section
  }
}
```

## Dark Mode

Pro mode is the only mode that activates dark backgrounds. It does this by:

1. Adding `.dark` class to `<html>` (in addition to `.theme-pro`)
2. The `.dark` class sets dark background/foreground colors
3. shadcn/ui components support dark mode via the `.dark` class

For components that need dark mode awareness:

```tsx
const { isDark } = useTheme();

<div className={isDark ? "bg-slate-900" : "bg-white"}>
  {/* content */}
</div>
```

However, prefer using Tailwind's CSS variable colors (`bg-background`, `text-foreground`) which automatically adjust.

## Related Documentation

- [Frontend Architecture](../architecture/frontend.md) — Component structure
- [Development Guide](./development.md) — Styling conventions
- [AI API](../api/ai.md) — Age-adapted AI responses
