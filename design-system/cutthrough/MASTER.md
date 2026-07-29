# CutThrough Design System

This project-specific master overrides the generator's landing-page suggestions. CutThrough is a compact embedded utility—not a hero page or dashboard.

## Direction

- Native-feeling YouTube companion; compact, calm, information-dense.
- Neutral surfaces, one restrained violet accent, minimal glow/gradient.
- Hierarchy through spacing, weight, and contrast—not oversized type or many cards.
- Dark and light designed together.
- Motion only explains state; 120–180ms and disabled/reduced when requested.

## Tokens

### Spacing

`2, 4, 6, 8, 12, 16, 20, 24px`; panel padding 12px; row padding 8–10px.

### Type

Use a bundled/system stack: `"Segoe UI", Inter, ui-sans-serif, system-ui, sans-serif`. No remote font loading.

- 11px metadata, line-height 16px.
- 12px labels/buttons, line-height 16px.
- 13px transcript/body, line-height 19px.
- 14px section titles, line-height 20px, weight 600.
- 15px product title maximum, weight 650.
- Tabular figures for timestamps and counters.

### Radius

- 4px tiny indicators.
- 6px inputs/compact controls.
- 8px grouped controls/panel sections.
- 10px panel shell maximum.
- Pills only for statuses/presets; do not make every element a pill/card.

### Dark

- page/host transparent
- panel `#111216`
- raised surface `#181A20`
- hover `#20232B`
- input `#15171C`
- border `#2A2D36`
- strong text `#F2F3F5`
- normal text `#D1D3D9`
- muted text `#9297A3`
- accent `#8B7CF6`
- accent subtle `rgba(139,124,246,.14)`
- success `#57C58A`; warning `#E2A84A`; error `#EE6B72`

### Light

- panel `#FFFFFF`
- raised surface `#F7F7F9`
- hover `#F0F1F5`
- input `#FAFAFB`
- border `#DADCE3`
- strong text `#17181C`
- normal text `#353842`
- muted text `#69707D`
- accent `#6757D9`
- accent subtle `rgba(103,87,217,.11)`
- success `#237A4B`; warning `#9A6400`; error `#C53C47`

Every normal-text pair must meet WCAG AA. Color never carries state alone.

## Components

- **Panel:** normal document flow, 100% column width, 320px usable minimum, thin border, subtle one-level shadow.
- **Header:** 40–44px; identity left, small readiness status, icon actions right.
- **Tabs:** three equal text+icon targets; active state uses accent text and 2px underline, not a filled capsule.
- **Buttons:** minimum 32px compact height; icon-only hit area 36px minimum in constrained panel, with accessible label/tooltip. Primary actions limited to one per region.
- **Inputs:** visible labels when meaning is not obvious; 34–36px control height; clear focus ring.
- **Transcript rows:** flat list with separators, clickable timestamp, current-row accent edge/background, hover controls that are also keyboard-focusable.
- **Status:** dot/icon plus text. Never dot/color alone.
- **Advanced settings:** native disclosure pattern; no modal for routine controls.
- **Feedback:** inline status or polite live region; avoid toast stacking.

## Interaction

- Visible `2px` focus ring with `2px` offset where space permits.
- Do not rely on hover for selection or critical actions.
- Keep tab/arrow-key behavior conventional.
- Preserve transcript scroll position per video while mounted.
- Suspend follow when users navigate manually; provide explicit resume.
- All async operations expose loading/error/retry states.

## Motion

- Color/opacity/border transitions only, 120–180ms.
- No decorative entrance sequences, bounce, parallax, width/height animation, or layout-shifting hover transforms.
- Under `prefers-reduced-motion: reduce`, remove nonessential transitions and smooth scrolling.

## Responsive

- 480px+: use available space without oversized gaps.
- 360–479px: standard dense layout.
- 320–359px: collapse secondary labels into accessible icon controls; wrap toolbars; no horizontal scrolling.
- At 200% text zoom, controls wrap and transcript remains readable; do not truncate essential state/error text.

## Forbidden

Huge headings; pink/blue multi-accent palette; gradients as decoration; glass blur; deep shadows; excessive rounded cards; generic chatbot bubbles; emoji icons; remote fonts; host-page `rem`; fixed rigid width; low-contrast metadata; hidden focus; auto-sending data.

## Visual review matrix

Dark/light × 320/402/480px; default/loading/error/selection/long transcript; Ask composed/oversized; Skip enabled/unsupported; collapsed; neighbor-extension content; keyboard focus; reduced motion; 200% text zoom.
