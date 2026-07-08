# Color Area Shift — Component Model Discussion

## Initial prompt

I am building a color tool system. I'm trying to make it precise, accurate, composable, flexible, powerful, fast, performant, efficient, and a great DX for creating the best UX. The model I'm experimenting with is:

```
<Color>      // color context, owns selected color, handles conversions
<ColorArea>  // renders children. Handles interactions, color model settings, and area/coordinate mapping. Uses legend state for performance.
  <Background>  // renders content behind any Area elements. Defaults to a checkerboard pattern. Multiple allowed.
  <Area />       // Renders one by default. Renders content within the ColorArea via canvas or SVG. Used to render gamut regions (P3, sRGB, P3 minus sRGB, and sRGB only) and overlays (contrast ratio safe-zones, simulated P3 regions rendered in sRGB, and out-of-gamut pattern overlays). Multiple allowed.
  <Line />       // Renders a style-able SVG path. Used to render P3 boundary, sRGB boundary, 3:1 contrast ratio line, 4.5:1 contrast ratio line, and 7:1 contrast ratio line. Multiple allowed.
  <Point />      // Renders a container anchored to a coordinate in the color area. Used to render P3 and sRGB fallback indicators. Multiple allowed.
  <Thumb />      // Renders by default. Renders a user-draggable, focusable, keyboard-accessible point that can be placed anywhere in the color area to request a color at that point. One allowed.
</ColorArea>
</Color>
```

I'm trying my hand at shadcn-style composability through markup elements. What feedback comes to mind as you read this?

## GPT-5.2 Response

This is a really solid direction. The shape of it reads like "Radix composability + data-viz overlays + serious color science," which is exactly the combo you want for a color tool system.

Here's what jumps out immediately—mostly the "watch-outs" and "make-it-even-better" ideas.

### 1. The hierarchy is good… but your contracts need to be sharper than your components

With shadcn-style markup composability, people succeed or fail based on whether the primitives have crisp, predictable contracts.

I'd make these contracts explicit (even if only in TS types + docs):

- **Color (root):** source of truth + conversion graph + gamut policy + scheduling
- **ColorArea:** coordinate system + interaction model + sampling pipeline
- **Area/Line/Point/Thumb/Background:** pure render + subscribe (no color math unless explicitly opted in)

In practice: keep color math centralized, and make children "dumb" by default.

### 2. Avoid "ColorArea renders children" becoming an accidental performance trap

Rendering children inside a canvas/SVG composition layer can easily cause:

- rerenders when you don't want them
- expensive reconciliation with many overlays
- awkward z-index / pointer-event bugs

**Suggestion:** treat ColorArea as a scene graph host:

- children register themselves (kind, zIndex, needs, shader/canvas/screen)
- ColorArea renders the scene in one or two passes (canvas + DOM overlay), rather than literally nesting everything into one DOM tree.

You can still keep the markup API, but the runtime behaves like a renderer.

### 3. Clarify "multiple allowed" vs "one allowed" with enforcement patterns

If you're going shadcn/Radix-ish, enforce these constraints cleanly:

- **\<Thumb /> one allowed:** use something like a Slot/Collection + runtime guard that throws in dev (and logs in prod).
- **\<Area /> multiple allowed:** good, but they probably need explicit ordering (zIndex or layer prop), otherwise users will fight "why is my overlay behind the gamut mask?"

A tiny layer system goes a long way:

- `layer="background" | "gamut" | "overlay" | "annotation" | "ui"`
- and/or `zIndex={number}` for escape hatches

### 4. Your "Area" is doing a lot—consider splitting what it draws from how it draws

Right now Area is "canvas or SVG" and also "gamut regions, contrast zones, simulated P3, out-of-gamut patterns…"

That's multiple orthogonal axes:

- **renderer:** canvas vs svg vs webgl vs dom
- **content:** gamut mask vs heatmap vs isolines vs pattern
- **data source:** derived from current color, or from configuration, or from precomputed LUT

A pattern I've seen work:

```
<Area renderer="canvas">
  <GamutMask />
  <ContrastZones ratios={[3,4.5,7]} />
  <OutOfGamutPattern />
</Area>
```

and the renderer just "hosts" these draw nodes. You still get markup composability, but you don't end up with a mega-component with a hundred props.

### 5. Decide early: is the ColorArea's coordinate space "model space" or "display space"?

This is the core precision question.

If ColorArea maps to OKLCH (or OKLab) you'll have:

- non-rectangular gamuts
- curved boundaries
- multiple "valid" mappings for hue wrap / chroma clipping
- tricky "cursor-to-color" sampling

That's fine—just make it explicit that the area is:

- **A)** A mathematical plane (e.g., a/b plane or C/H plane)
- **B)** A UI plane (normalized x/y in [0..1]) with a mapping function

I'd lean to: ColorArea owns a Space object:

- `space="oklch"` + `x="c"` `y="l"` or `x="a"` `y="b"` etc.
- plus a required mapping strategy: `gamut="clip|compress|preserve-lightness|preserve-chroma"`

Even better: make mapping strategy a first-class prop on Color (root), so every child can reference the same policy.

### 6. Legend-state for performance: great—just don't let it become a second source of truth

Your root \<Color\> should own the canonical color state. Legend-state is perfect for:

- pointer move sampling
- throttled preview color
- high-frequency drag state (x/y)
- derived memoized values (like converted channels)

But keep the "selected color" authoritative in one place, and treat everything else as:

- **preview** (ephemeral)
- **committed** (on pointerup / Enter / blur)
- **derived** (computed)

If you don't split preview vs committed, you'll either: spam conversions, get laggy UI from overwork, or create subtle sync bugs between components.

### 7. Make "interactions" pluggable, not baked into ColorArea

You'll eventually want:

- pan/zoom (for Lab planes or HDR-ish tools)
- different drag behavior (clamp, wrap hue, snap chroma)
- keyboard step modes (fine/coarse)
- accessibility rules (roving tabindex, ARIA patterns, screen reader text)

I'd treat interaction as a strategy object:

```
<ColorArea interaction="2d" />
<Thumb interaction="drag" keyboardStep={...} />
```

Or even:

```
<ColorArea>
  <Interaction2D />
  <Thumb />
</ColorArea>
```

It keeps the system from turning into one "god" component.

### 8. Your overlay lineup is awesome—consider precomputation and invalidation boundaries now

Things like:

- contrast safe-zones
- gamut region masks
- simulated P3-in-sRGB preview

…can be expensive if recomputed per frame.

Define invalidation boundaries:

- some layers recompute only when space, axis, gamut, or background changes
- others update only when "reference color" changes
- only the thumb + preview needs per-pointer updates

This aligns naturally with your scene graph idea.

### 9. Developer experience: add escape hatches on purpose

People will want to do weird stuff:

- custom overlays
- custom draw passes
- custom sampling
- plugging in their own conversion lib / LUTs

If you design these escape hatches intentionally, you'll avoid "fork the library" outcomes.

**Examples:**

```
<Area draw={(ctx, api)=>{...}} />
<Color conversions={myConversions} />
<ColorArea sampler={mySampler} />
```

### 10. Naming nit: "Area" vs "ColorArea" might get confusing fast

You already have \<ColorArea\> as the host. Calling the layer \<Area\> is semantically overloaded.

Consider renaming:

- \<Layer /> (generic)
- \<Overlay /> (if always on top)
- \<Field /> (if it's the main 2D color field)
- \<Mask /> (for gamut regions)

or split them like earlier (\<GamutMask/\>, \<Heatmap/\>, etc.).

Even a small rename improves readability in real codebases.

## Reply prompt

Most of this lines up with what I'm thinking. Going down the list...

1. Sharp contracts are good.
2. Hmm. Wasn't planning to have the ColorArea actually render anything other than children. It's mostly a wrapper that owns the physical space concerns that are unique to the color area. My reasoning is, all the elements that are part of the color area will need a shared definition of their positions and dimensions relative to the bounded plane defined by the ColorArea element.
3. I'm down with this.
4. I originally had an \<Overlay /> planned but then folded it into the \<Area /> element. The Area element would render the gamut with a canvas while the Overlay elements could be assigned to render SVG or pattern overlays. I'm fine adding it back in. It might help relegate the Area to a "one allowed" instance, which feels more appropriate if it's also a mandatory/default inclusion.
5. I've found it's a much better experience if it's a UI plane. This allows you to click/drag anywhere in the plane and drop the thumb, even if the thumb's drop point is out-of-gamut (like an OKLCH color at .1 lightness and .37 chroma, which doesn't exist in-gamut). We use our fallback indicators to show the closest real options. This makes the thumb feel more natural to use than if it were locked to a specific range or jumped to the "correct" selection on release.
6. Noted
7. Noted
8. I've been trying to think of ways to build in better performance to these frequent calculations. It would be interesting if the calculations could be run in zig or rust, but I'm not sure how/when to do that kind of trick.
9. I like this.
10. I'm down to name it better. It might be safe to name it Gamut or ChannelGradient, but I'm open to better options.

_[GPT-5.2 responded at this point with more feedback that included naming discussion. User responded.]_

## Prompt: ColorPlane and Layer naming

How about \<ColorPlane /> in place of \<Field />? I feel like field can mean a lot of things in the context of a color area/color picker. ColorPlane says, "I'm for rendering color, I'm 2D, and I potentially exist in the context of other planes or layers." Also, I see you nesting \<Point /> and \<Line /> within \<Overlay />. That feels smart, especially if it's optional and you could just drop the line and point elements in color area as their own layers. It kind of makes me want to redefine \<Overlay /> as \<Layer /> (one of your suggestions) and then have that be the primitive. That kind of makes me want to remove the \<Background /> element and replace it with a \<Layer /> element, or create the \<Background /> element out of a wrapped \<Layer /> element with some nice background-specific defaults.

_[GPT-5.2 responded in agreement, and summarized.]_

## Prompt: Compact component summary

Cool. Please create a highly-compact explanation of our color area component model, similar to how I did it with this structure:

```
<Color>        // definition, purpose
  <ColorArea>  // definition, purpose
    <Background>  // definition, purpose
    <ColorPlane>  // definition, purpose
    <Layer>       // definition, purpose
    <Line>        // definition, purpose
    <Point>       // definition, purpose
    <Thumb>       // definition, purpose
```

## GPT-5.2 Response: Component summary

```
<Color>
  // Canonical color context.
  // Owns the selected (realized) color, intent color, color-space conversions,
  // gamut targets and mapping policies, and exposes a single source of truth
  // for all derived color data.

  <ColorArea>
    // Defines a bounded, interactive 2D UI plane.
    // Owns geometry (size, DPR), coordinate systems (UV ↔ local ↔ color),
    // interaction models (pointer, keyboard), and intent generation.
    // Does NOT render color itself—only provides spatial and interaction context.

    <Background>
      // Convenience wrapper around a background layer.
      // Renders non-interactive visuals behind the color plane
      // (e.g. checkerboard, grids, images) using sensible defaults.

    <ColorPlane>
      // The primary 2D color-rendering surface.
      // Renders a rasterized representation of color for the active plane
      // (e.g. OKLCH C/L, OKLab a/b) using canvas/bitmap techniques.
      // Recomputes only when plane configuration or gamut policies change.

    <Layer>
      // Generic stacking and rendering primitive.
      // Defines ordering, renderer type (DOM/SVG/canvas), and pointer behavior.
      // Used to group overlays, annotations, guides, UI affordances, or
      // custom drawing logic without affecting the core plane.

    <Line>
      // A vector path anchored to the ColorArea coordinate system.
      // Used for boundaries and guides (gamut edges, contrast isolines, axes).
      // Typically rendered within a Layer but may auto-attach to a default overlay.

    <Point>
      // A positioned marker anchored to a specific coordinate in the ColorArea.
      // Used for indicators (intent, realized P3, realized sRGB, fallbacks).
      // Visualizes relationships between intent and realizable colors.

    <Thumb>
      // The primary interactive selector.
      // A draggable, focusable, keyboard-accessible control that updates intent
      // continuously and commits a realized color based on gamut policies.
      // Exactly one allowed per ColorArea.
```

## Prompt: Intent and goals writeup

I'd like a clear writeup of those aspects, led by an explanation of the intent and goals that are driving our approach.

## GPT-5.2 Response: Intent, Goals, and Architectural Contracts

### ColorArea System — Intent, Goals, and Architectural Contracts

#### Core Intent

The ColorArea system exists to provide a precise, perceptually-aware, composable, and high-performance 2D color interaction model that:

- Feels natural and fluid to use
- Supports wide-gamut and advanced color spaces (OKLCH, OKLab, HCT, etc.)
- Cleanly separates UI interaction from color computation
- Allows extensible overlays, annotations, and visualization layers
- Maintains strict single-source-of-truth color state
- Scales from "simple picker" to "pro color tooling"

This is not a monolithic picker component. It is a layered, scene-like system built from orthogonal primitives.

#### Design Goals

**1. Precision First**

- All color math flows through \<Color\>.
- UI interaction generates intent.
- Gamut mapping generates realized color(s).
- No hidden clamping inside rendering components.

**2. UI Plane > Mathematical Constraint**

- The 2D area is a UI plane, not a constrained mathematical slice.
- Users may drop the thumb anywhere.
- Out-of-gamut intent is allowed.
- Realized fallbacks are visualized, not silently corrected.

**3. Separation of Concerns**

Each component has one job:

- **Spatial logic** → ColorArea
- **Color logic** → Color
- **Raster rendering** → ColorPlane
- **Stacking and grouping** → Layer
- **Vector annotations** → Line
- **Markers** → Point
- **Interaction control** → Thumb

No component should "accidentally" take on another's responsibility.

**4. Composability Over Configuration**

- Behavior is expressed through structure.
- Layers are explicit.
- Overlays are optional.
- Consumers can build simple or complex scenes using markup composition.

**5. Performance by Design**

- Intent updates may occur at pointer-move frequency.
- Raster planes redraw only when invalidation keys change.
- Overlays subscribe selectively to derived state.
- Heavy calculations are cacheable and off-thread capable.

#### Architectural Contracts & Invariants

These are the rules that keep the system predictable and maintainable.

##### \<Color\> — Canonical Color State

**Owns:**

- Selected (realized) color
- Intent color
- Color-space conversions
- Gamut targets and mapping policy

**Must:**

- Be the only source of truth for color state.
- Provide both intent and selected values.
- Never depend on UI components for conversions.
- Expose derived values via subscription-friendly APIs.

**Must NOT:**

- Know anything about layout, geometry, or pointer interaction.
- Render visual UI related to the color plane.

##### \<ColorArea\> — Spatial + Interaction Context

**Owns:**

- Bounding rect and device pixel ratio
- UV normalization (0–1 plane)
- Mapping between UV and intent color
- Pointer + keyboard interaction logic

**Must:**

- Expose a "space API": `uvToColor`, `colorToUV`, `clientToUV`, `uvToLocal`
- Generate intent continuously during interaction.
- Allow intent outside gamut.

**Must NOT:**

- Perform color conversions.
- Clamp or mutate colors silently.
- Render the actual color plane pixels.

##### \<ColorPlane\> — Primary Raster Surface

**Owns:**

- 2D color visualization for the active plane
- Canvas/bitmap rendering
- Cached texture generation

**Must:**

- Redraw only when invalidation keys change (size, plane config, gamut policy).
- Not re-render during thumb drag unless absolutely necessary.
- Never handle pointer interaction.

**Must NOT:**

- Commit color changes.
- Know about selected vs intent semantics.
- Clamp values or alter state.

##### \<Layer\> — Stacking & Rendering Boundary

**Owns:**

- Z-ordering
- Renderer type (DOM/SVG/canvas)
- Pointer-event behavior

**Must:**

- Be purely structural.
- Allow grouping of related visual elements.
- Not alter color or geometry state.

**Must NOT:**

- Perform color math.
- Modify interaction logic.

##### \<Line\> — Vector Guide Primitive

**Owns:**

- Path generation within the ColorArea coordinate system.

**Used For:**

- Gamut boundaries
- Contrast isolines
- Axes or guide marks

**Must:**

- Derive geometry from the ColorArea space API.
- Subscribe selectively to only necessary color data.

**Must NOT:**

- Affect color state.
- Trigger raster redraws.

##### \<Point\> — Anchored Marker

**Owns:**

- A visual anchor at a UV-mapped coordinate.

**Used For:**

- Intent indicator
- Realized P3 marker
- sRGB fallback marker

**Must:**

- Derive position from either intent or selected color.
- Visually differentiate between intent and realized.

**Must NOT:**

- Perform gamut mapping.
- Mutate state.

##### \<Thumb\> — Interactive Control

**Owns:**

- Drag + keyboard accessibility
- Continuous intent updates
- Commit behavior

**Must:**

- Be the only component that mutates intent via user input.
- Separate preview (pointer move) from commit (pointer up / Enter).
- Be focusable and ARIA-aware.

**Must NOT:**

- Render raster layers.
- Compute gamut mapping.

#### Critical System Invariants

These are the rules that protect correctness and UX quality.

1. **Intent is never silently clamped.** Out-of-gamut intent is allowed and visible.
2. **Realized colors are always explicit.** If gamut mapping occurs, it is: controlled by policy, visualized via indicators, never hidden.
3. **Raster layers are deterministic.** Given the same plane definition, gamut policy, size, and DPR, the same bitmap must be produced.
4. **Interaction never forces re-render of heavy layers.** Thumb movement updates markers and preview values, not the entire plane.
5. **Geometry and color math are independent systems.** They communicate only through well-defined APIs.

#### What This Enables

Because of this separation:

- You can swap OKLCH for OKLab without touching interaction code.
- You can render in WebGL later without changing markup.
- You can move heavy computation to WASM without changing UI.

You can build:

- Accessibility inspectors
- Gamut visualizers
- Token generators
- Multi-plane editors
- HDR-aware tooling

All from the same primitives.
