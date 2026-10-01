# Visual direction: Conecta Infusion

Status: visual direction approved by the user on October 1, 2026, including the working palette, functional companion colors, and customer/management presentation direction. Exact logo color matching, contrast verification, typography, and final screens remain design follow-ups.

## Brand source

Use the Conecta Infusión Yoga logo supplied in the conversation as the visual reference for both customer-web and management-web. Preserve its peach, lilac, green, and pale pink character. The studio offers multiple disciplines despite the word Yoga in the logo.

The following hexadecimal values are visual approximations from the displayed image, not pixel samples from the original artwork. The original logo file is not currently in the repository. Confirm exact values against that asset before finalizing design tokens; do not recreate or recolor the logo as part of this decision.

## Working palette

| Token | Approximate value | Source and intended use |
| --- | --- | --- |
| brand-peach | `#FFB6A3` | Steam and lettering; highlights, welcoming sections, decorative accents |
| brand-lilac | `#D8ACD0` | Central figure; brand surfaces and selected-state backgrounds |
| brand-mauve | `#CBA7CE` | Cup; secondary accents |
| brand-green | `#AED8A0` | Leaf and base; supporting surfaces and accents |
| brand-blush | `#FBEFF7` | Pale lettering; subtle page sections |
| surface | `#FFFFFF` | Logo background; cards and clean content surfaces |

## Approved functional companion colors

These are derived UI choices, not colors claimed to come from the logo:

| Token | Value | Intended use |
| --- | --- | --- |
| text-primary | `#332B36` | Main text on white or pale brand surfaces |
| text-secondary | `#65566A` | Supporting text on white; check other surface pairings |
| action-primary | `#704678` | Primary buttons with white labels; interactive emphasis |
| action-hover | `#59365F` | Primary-button hover state |

Keep the original pastels visible in backgrounds and accents. Do not assume pastel text on white, or white text on pastel buttons, is readable. Verify actual text, control-boundary, focus, and state contrast combinations during component design. Status meaning must also use text or icons, not color alone. Error/warning/success colors still need semantic definitions and review.

## Application across the two frontends

- Approved UI tooling: Tailwind CSS + shadcn/ui, with reusable components and shared brand styling in `packages/ui`. Customize components to this visual direction; final layouts and accessibility still require verification. Tooling approval does not finalize typography, exact colors, or screen designs.
- Customer-web: welcoming brand surfaces, photography, generous spacing, and clear purchase/booking actions. Public page layouts remain in the public-home specification.
- Management-web: mostly white or subtle surfaces, restrained accents, clear tables, legible amounts, and strong action hierarchy. Avoid large decorative areas competing with operational information.
- Both apps consume the same eventual packages/ui design tokens and shared components. Feature layouts and navigation remain app-specific.
- The old starter dashboard's green/earth-tone styling is not the approved brand palette and should be replaced during UI implementation.
- Both Spanish and English layouts must accommodate translated labels. Fonts, final typography scale, icon style, imagery, and page mockups remain for design review.

This document records direction only. It does not change application styles or approve final screens.
