# minicanvas spec

Version 1 of the format (`minicanvas/1`). This document tracks what the thing is
meant to do; `minicanvas.html` is the implementation and the demo page around it.

## Goal

A canvas primitive you can paste into any HTML page. It should still open and work
in a hundred years. Small enough to inline in a `<script>` tag, with a serialised
form short enough to read and edit by hand.

## Using it

One script tag per file, then one call. There is no build step and nothing to
configure.

```html
<script src="minicanvas/minicanvas.js"></script>          <!-- always first -->
<script src="minicanvas/minicanvas-item-stroke.js"></script>
<script src="minicanvas/minicanvas-tool-draw.js"></script>
<script src="minicanvas/minicanvas-history.js"></script>

<canvas id="board" style="width:100%;height:400px"></canvas>

<script>
  const board = MiniCanvas.mount('#board');
</script>
```

`mount(target, options)` takes an element or a selector. Every option is optional:

```js
MiniCanvas.mount('#board', {
  scene: '#scene',              // selector, JSON text, or the object itself
  features: ['draw', 'select', 'history'],
  tool: 'draw',                 // what to start on
  fit: true                     // frame the scene on load
});
```

### Starting data

Three forms, whichever suits where your data lives:

```js
MiniCanvas.mount('#board', { scene: '#scene' });                 // a <script type="application/json"> on the page
MiniCanvas.mount('#board', { scene: savedJsonString });          // text from a database
MiniCanvas.mount('#board', { scene: { items: [...] } });         // an object you built
board.load(anyOfTheAbove);                                       // or later, any time
```

Keeping the scene in the page means the data survives even if the script does not:

```html
<script type="application/json" id="scene">
  { "format": "minicanvas/1", "items": [ ... ] }
</script>
```

### Turning features on and off

```js
features: 'all'                              // default: everything the page loaded
features: 'viewer'                           // every renderer, no tools: read-only
features: ['draw', 'select', 'history']      // just these, plus whatever they need
features: { without: ['text', 'clipboard'] } // everything else
```

Names are forgiving. `'text'` matches both `item-text` and `tool-text`; `'draw'`
matches `tool-draw`. **Asking for a feature brings what it needs**, so `['transform']`
quietly loads `select` too, and dropping one drops whatever leans on it: `without:
['select']` also removes transform, groups, arrange, and clipboard. A name nothing
matches throws at mount rather than half-working.

`MiniCanvas.features` lists what the page has loaded.

### Reading and saving

```js
board.on('change', () => localStorage.setItem('doc', board.toText()));
board.on('selectionchange', (e) => bar.hidden = e.detail.units < 2);
board.on('toolchange', (e) => paint(e.detail));
board.on('penchange', (e) => swatch(e.detail));   // { color, width, opacity, fill }

board.toText();      // the file format, pretty-printed
board.toSVG();       // static SVG, no JavaScript needed to view it
board.toPNG();       // an offscreen canvas, ready for toBlob()
board.destroy();     // unhooks everything; for single-page apps
```

`change` fires when an edit is **recorded**, which is the moment it begins, not the
moment it finishes. For a drag that is the first frame of it, when the item is still
where it started. Typing records nothing at all after the empty item is created.

So the example page saves on `change` *and* on every `pointerup` and `keyup`,
comparing the serialised scene before writing so the extra calls cost nothing when
nothing moved. The `pointerup` listener is on the window rather than the canvas,
because undo and redo deliberately record no edit and their buttons are not on the
canvas. Anything persisting a scene needs the same treatment: `change` alone will
save you the position an item was dragged *from*.

Panning and zooming are not edits.

The page keeps the toolbar under a **separate key**: which tool, the pen's colour,
width, opacity and fill, whether the bar is showing, and whether the scene panel is
open. How the page was left is not what was drawn on it, and being able to clear one
without the other is worth a second key. Resetting the drawing leaves the pen alone.
A corrupt or foreign value in either key is ignored rather than thrown.

### Several canvases on one page

Each mount is independent, and they can have different features:

```js
const editor = MiniCanvas.mount('#editor', { features: ['draw', 'select', 'history'] });
const preview = MiniCanvas.mount('#preview', { scene: editor.toText(), features: 'viewer' });
```

**Whichever canvas you last pointed at owns the keyboard.** Undo on one never
reaches the other. With a single canvas on the page the question never arises, and
it keeps working before you have clicked anything. `minicanvas-two-canvases.html`
is a working example.

## Shape of the code

The library is a small core plus plugins. Every file is plain top-level code with no
module system, so a build is a list of files in order.

The core gives you a scene that renders and a view you can pan and zoom. It knows
the file format and nothing about tools. Everything else registers itself by name:

| Feature | Gzipped | Needs | What it adds |
|---|---:|---|---|
| `minicanvas.js` (core) | 5.1K | — | format, view, render dispatch, pointer and key plumbing, pan and zoom, `mount` |
| **item renderers** | | | *how a type draws, measures, hits, and exports* |
| `item-stroke` | 0.6K | — | freehand strokes |
| `item-shapes` | 0.9K | — | rectangles and ovals |
| `item-text` | 1.0K | — | text |
| `item-image` | 0.4K | — | images |
| **tools** | | | *making those things* |
| `tool-draw` | 0.4K | item-stroke | the pen |
| `tool-shapes` | 0.5K | item-shapes | dragging out a rect or oval |
| `tool-text` | 2.1K | item-text | the editor: caret, runs, blink |
| `tool-image` | 0.3K | item-image | `addImage` |
| **editing** | | | |
| `pens` | 0.9K | — | `setStroke`, restyling a selection |
| `select` | 2.1K | — | selection, marquee, drag, delete, the frame |
| `transform` | 1.8K | select | resize and rotation handles |
| `groups` | 0.6K | select | ctrl/cmd + `g` |
| `arrange` | 1.1K | select | alignment and layer order |
| `erase` | 0.3K | — | the erase tool |
| `history` | 0.5K | — | undo and redo |
| `clipboard` | 1.0K | select | copy, paste, option-drag |
| `export` | 0.8K | — | `toSVG` and `toPNG` |

**Renderers and tools are separate files on purpose.** A published scene needs to
draw every type and create none of them, so the type that says how a rect looks is
not the tool that drags one out. The text split is the clearest case: the renderer
is 0.7K and the editor is 1.8K.

| Build | Gzipped |
|---|---:|
| core alone: no item types, so nothing draws | 5.1K |
| **read-only viewer: core and the four renderers** | **7.3K** |
| sketchpad: core, stroke, draw, erase, history | 6.1K |
| everything | 15.6K |

`minicanvas-viewer.html` is the viewer as a working page. It cannot edit, not
because editing is switched off but because no tool was loaded to do it: with an
empty `core.toolKeys` the shortcuts have nothing to select and the tool stays `pan`.

### How a plugin attaches

A plugin is a function handed the core. It registers item types, tools, and hooks:

- `core.types.<name> = { draw, box, bounds, hit, within, move, scale, svg }` — an
  item type. Anything the core cannot draw is still kept and written back out, so a
  file made with more plugins than you loaded survives the round trip.
- `createMiniCanvas.plugin(name, needs, setup)` registers it. `needs` is what mount
  should pull in alongside it.
- `core.on(name, handler, order)` — handlers run in `order`, low first, and the
  first to return true ends the round. The numbers are the whole contract between
  plugins and live in one comment in the core: 10 text caret, 20 text commit,
  30 pan, 40 erase, 50 select, 90 tools that create things.
- `core.remember()` and `core.forget()` do nothing until history replaces them, so
  every other plugin records undo steps without knowing whether undo exists.
- `core.membersOf(item)` returns just that item until groups replaces it, which is
  how selection becomes group-aware without select knowing what a group is.

Degrading is the normal case, not an error case. Clipboard pastes prose as text only
if the text plugin is loaded. Export writes only the types that are. Alignment
without groups treats every item as its own unit, which is the same code path.

**A build only draws the item types it loaded a plugin for.** Items of other types
are kept in the scene and written back out untouched, so nothing is lost, but they
do not appear. That is the same forward-compatibility rule that lets a v1 renderer
open a v2 file, seen from the other side. Because a scene full of invisible items
looks exactly like a broken page, `load()` warns once naming the types it cannot
draw and the plugin files that would fix it.

## Requirements

These come from the brief and hold for every change:

1. **No dependencies, no build step.** One function, plain DOM APIs, nothing newer
   than roughly 2019. Paste it into a page and it runs.
2. **Small enough to inline.** The core is 5.1KB gzipped and everything together is
   15.6KB. Weigh every addition against the build it lands in, not the total: a new
   plugin costs nobody who does not load it.
3. **The data is the artifact.** JSON that a person can read, diff, and hand-edit.
   The renderer is replaceable; the format is what has to last.
4. **Portable output.** `toSVG()` turns any scene into static SVG, so the work
   opens in any browser, viewer, or printer with no JavaScript at all.
5. **Forward compatible.** A renderer ignores item types it does not know and
   writes them back unchanged, so a v2 file still opens in a v1 renderer.
6. **Works with a mouse, a trackpad, a finger, and a pen.** Pointer events only.

## Data format

```json
{
  "format": "minicanvas/1",
  "view":   { "x": 0, "y": 0, "scale": 1 },
  "items": [
    { "type": "stroke", "color": "#17171a", "width": 3, "points": [20,60, 60,20, 100,60] },
    { "type": "rect",   "color": "#17171a", "width": 3, "x": 0, "y": 0, "w": 120, "h": 80 },
    { "type": "oval",   "color": "#17171a", "width": 3, "x": 0, "y": 0, "w": 120, "h": 80,
      "fill": "#17171a", "opacity": 0.3 },
    { "type": "text",   "color": "#17171a", "size": 24, "x": 0, "y": 0, "text": "two\nlines" },
    { "type": "rect",   "color": "#17171a", "width": 3, "x": 0, "y": 0, "w": 40, "h": 40, "group": "g1" },
    { "type": "image",  "x": 0, "y": 0, "w": 400, "h": 300, "src": "cat.jpg" }
  ]
}
```

- Coordinates are abstract units, never pixels. `view.x` and `view.y` give the world
  point at the top-left of the viewport; `view.scale` is the zoom.
- `points` is a flat list, x then y, rounded to one decimal. Half the bytes of
  `[{x,y}, ...]` and still readable.
- Rectangles and ovals store a corner and a positive size. An oval fills its box.
  Neither is filled; they draw as outlines.
- Rectangle corners round by 6 units, easing down to `w / 4` or `h / 4` on small
  ones. That radius is a renderer constant, not a stored field, so nothing in a
  file needs to change if it does. The SVG export matches it with `rx`.
- Text anchors at its top-left corner and carries its own `size`. Newlines in
  `text` are real line breaks; the box is as wide as its widest line and as tall as
  its line count. The font family and the 1.25 line spacing are renderer constants,
  not stored fields, for the same reason the corner radius is: nothing in a file
  should break if the renderer's taste changes.
- Rectangles and ovals may carry `fill`, which is **a colour, not a flag**. Absent
  means unfilled, so a plain outline writes nothing extra. A filled shape catches
  clicks anywhere inside it; an outline only on its edge.
- **Filled or outlined, never both.** A filled shape draws no stroke, and exports
  with `stroke="none"`. Drawing an outline over a fill of the same colour doubles
  up along the edge, which reads as a darker rim the moment the item is anything
  less than opaque. `width` is still stored, so unfilling gives the outline back.
- Any item may carry `opacity` between 0 and 1. Absent means fully opaque, and an
  item returned to full opacity drops the field rather than storing 1. It is a core
  concern rather than a per-type one because one `globalAlpha` covers a stroke's
  ink, a shape's fill, and a photograph alike.
- Any boxed item may carry `angle`, in degrees, turning about its own centre.
  Absent means zero, and an item rotated back to zero drops the field rather than
  storing 360. Strokes never carry one: they rotate by moving their points, which
  keeps a stroke pure geometry.
- Any item may carry `group`, a short shared name like `g1`. Items with the same
  name select and move together. There is no container object, no nesting, and no
  ordering of its own: a group is a label, which is why it costs one short field
  and survives a renderer that has never heard of groups.
- Items paint in array order, so the last item wins.
- **`width` is pen weight and never scales with geometry.** Resizing a drawing
  changes coordinates only. This is a hard rule, not an implementation detail.
- `src` accepts a relative path, an https URL, or a `data:` URI. Data URIs make a
  document self-contained and heavy; paths keep it light and breakable. Choose per
  document.
- The demo page keeps its scene in a `<script type="application/json">` block, so
  the data survives even if the script is lost.

## Tools

| Tool | Key | What it does |
|---|---|---|
| select | `v` | Click, box-select, move, resize, rotate, reorder, group, delete |
| draw | `d` | Freehand strokes in the current color and width |
| rect | `r` | Drag out a rectangle outline |
| oval | `o` | Drag out an oval outline |
| text | `t` | Click to place a caret, then type. Enter or Escape commits. |
| erase | `e` | Click or drag over the visible part of an item to remove it |
| pan | `h` | Drag to move the view. Also available by holding space from any tool. |

Letter keys ignore ctrl, cmd, and alt, so browser shortcuts like ⌘R still work.
`h` is registered in the core rather than by a plugin, since pan is a core
concern and always works whether or not any tool plugin is loaded.

## Keyboard

| Key | Behaviour |
|---|---|
| `space` (hold) | Pan from any tool, with the grab cursor. Works even when a toolbar button has focus, which means buttons answer to Enter rather than space. Releasing, or the window losing focus, ends it. |
| `v` `d` `r` `o` `e` `t` `h` | Pick a tool. Switching clears the selection and commits any text being typed. |
| `w` | Cycle thickness: thin, medium, thick. Follows the selected item's weight when there is one. |
| `f` | Toggle fill. With shapes selected it fills or unfills them; with nothing selected it arms the pen for what you draw next. |
| `g` | Cycle opacity: 70%, 50%, 30%, 10%, and back to opaque. Applies to every selected item, whatever its type. |
| `c` | Step to the next of the six pens. With something selected it follows that item's colour, so the cycle picks up where what you are looking at already sits. |
| `shift` (hold) | While drawing a rect or oval, constrain to a square. While dragging a resize handle, keep the aspect ratio. While dragging the rotation handle, snap to 15°. While clicking with select, add or remove one item. While nudging, move 10 units instead of 1. With `[` or `]`, move one layer instead of all the way. |
| arrows | Nudge the selection 1 unit, or 10 with shift. One undo step per key press, not per repeat. |
| arrows, while typing | Move the caret. Shift extends a selected run, Home and End jump to the ends, and a plain arrow with a run selected collapses to its edge. |
| `[` / `]` | Send the selection to the back or bring it to the front. Shift moves one layer instead. Multiple items move as a block and keep their order among themselves. A move that changes nothing records no undo step. Shifted brackets arrive as `{` and `}` on most layouts, and both spellings are accepted. |
| ctrl/cmd + `g` | Group the selection, or take an existing group apart. Ungrouping leaves every former member selected, each with its own outline. |
| ctrl/cmd + `c` | Copy the selection to the system clipboard as a scene fragment. While typing, copy the selected run of text. |
| ctrl/cmd + `v` | Paste. While typing, insert the clipboard text into the string. |
| ctrl/cmd + `a` | While typing, select the whole string. |
| delete / backspace | Remove the selection. |
| alt/option + `w` `a` `s` `d` | Line the selection up on whichever edge already reaches furthest that way: top, left, bottom, right. |
| alt/option + `v` / `h` | Centre the selection on one axis. `v` puts everything on one horizontal line, `h` stacks it in one column. |
| ctrl/cmd + `z` | Undo, up to 60 steps. |
| ctrl/cmd + shift + `z` | Redo. Matches on `event.code` as well as the key, since shift turns `z` into `Z`. |

Typing in a text field suppresses all of these. So does the text tool: while a
caret is live the canvas is a text field, every key goes into the item, and the
tool shortcuts are just letters again.

## Pointer

| Gesture | Behaviour |
|---|---|
| drag, draw tool | Freehand stroke, sampled every 1.5 screen pixels so detail stays even at any zoom |
| drag, rect or oval tool | Drag out the shape from the corner where you started. A click with no drag leaves nothing behind and costs no undo step. |
| click, text tool | Place a caret and start typing. The item stays centred on that point as it grows, and the select tool comes back immediately so the next click can go anywhere. |
| double click a text item, select tool | Reopen it with the caret at the letter you clicked |
| click an item, select tool | Select it, or its whole group. Shift-click adds or removes. |
| drag from empty canvas, select tool | Box-select everything the rectangle touches |
| drag from an item, select tool | Move the whole selection |
| alt/option drag from an item | Leave the original in place and drag a copy of the selection |
| drag a corner handle | Resize the whole selection, anchored to the opposite corner |
| drag the round handle above the box | Rotate the whole selection about its centre |
| wheel or two-finger scroll | Pan |
| ctrl/cmd + wheel, or pinch | Zoom toward the pointer, clamped between 0.05x and 40x |
| | Sensitivity is `core.zoomRate`, default 4. Zoom is multiplicative, so the rate is an exponent: 4 means a gesture covers four times the zoom range 1 did. Set it live to retune. |
| middle-drag | Pan |
| paste or drop an image | Insert it at the viewport center, scaled to fit 600 units, as a data URI |

## Hit testing

Two different tolerances, on purpose:

- **Selecting and clicking** allow 8 screen pixels of forgiveness on top of the
  item's own painted width, so a 1-unit line is still easy to grab.
- **Erasing allows none.** It only removes an item when the cursor is over ink that
  is actually visible. A line's target area is exactly its own width, so thinning a
  line thins its eraser target with it, and the white space where a thick line used
  to be no longer erases anything.

What counts as visible, by type:

| Type | Hit region |
|---|---|
| stroke | Within `width / 2` of the centreline |
| rect | Within `width / 2` of the outline. The hollow middle is not clickable. |
| oval | Within `width / 2` of the ellipse, approximated. Hollow middle likewise. |
| text | Anywhere in its box, measured from the rendered string |
| image | Anywhere in its box |

A rotated item is tested by turning the cursor back into the item's own upright
frame first, so the hit region turns with what you see.

## Selection

- Selected items get a solid blue outline (`#1a73ff`) with white corner squares.
  Handles stay 9 screen pixels at every zoom.
- **The outline sits flush against the ink, with no padding.** A stroke's centreline
  is not its edge: half the pen width spills outside on every side, so a box drawn
  on the raw coordinates cuts through the middle of a thick line. `visualBounds()`
  grows each item by its own `ink` before merging, since they do not all spill
  alike: an outlined shape clears half its pen, a filled one clears nothing because
  it draws no stroke, and text and images sit exactly on their box.
- A frame therefore carries two boxes. `box` is what you see, flush with the ink.
  `content` is where the coordinates are, and is what a resize anchors to. Keeping
  them separate is what lets the outline hug the ink without the anchored corner
  drifting when you drag a handle.
- A marquee in progress draws dashed, so it reads differently from a settled
  selection.
- With more than one loose item selected, each gets its own outline plus one outer
  box carrying the handles. A group gets one outline only, because a group is one
  thing until you take it apart.
- One rotated item gets a frame that turns with it: the outline, the four handles,
  and the rotation stalk are all drawn in the item's own space, so they sit on the
  item rather than around a box it happens to fit inside. Any other selection gets
  an upright frame, since several angles have no single frame to share.
- Strokes are box-selected by their points, not their bounding box, so a marquee
  beside a long diagonal misses it. Images, rects, and ovals use their box.
- **Hovering an item outlines it**, at 60% opacity and with no handles: handles
  would invite a drag that hovering has not earned. It follows a group, skips
  anything already selected, and only happens with the select tool.
- A marquee needs real area before it selects. A plain click on empty canvas clears
  the selection instead.
- Catching one member of a group with a marquee catches the group.
- Selection lives outside the scene and is never serialised.
- Picking a color or width with something selected restyles every selected item
  that carries ink: strokes, rectangles, ovals, and the color of text. Images have
  nothing to restyle and are skipped. With nothing selected it sets the pen and
  hands back the draw tool.

## Text editing

- The text tool places a caret and takes every keystroke, so tool shortcuts are
  just letters while you type. Enter or Escape commits, and so does any click
  elsewhere or any tool change.
- **Placing text hands the select tool straight back**, while the caret stays live in
  what was just placed. Typing still works, because the keyboard belongs to the
  caret whenever one exists, and the next click can go straight to another item
  instead of needing Escape first. `setTool(name, keepTyping)` is the one path that
  changes tools without committing.
- The caret blinks on a 530ms timer that exists only while typing does. It holds
  solid on every keystroke, the way any text field does, and stops on every route
  out of editing: commit, tool change, undo, load, or export. A caret sitting
  perfectly still on a drawing canvas reads as a stray mark rather than a cursor.
- **Enter makes a new line.** Escape commits, and so does a click elsewhere or a tool
  change. That is the trade multiline asks for: the key that used to finish now
  continues.
- Left and right move the caret, up and down move between lines keeping the column
  where the line is long enough, Home and End reach the ends of the current line,
  and ctrl/cmd + `a` takes the whole string. A plain arrow with a run selected
  collapses to that run's edge rather than moving one character.
- A selected run that crosses lines draws one rectangle per line, since text is not
  one long ribbon: each line has its own left edge to start from.
- A selected run draws behind the glyphs in the selection blue and is replaced by
  the next thing typed.
- Double-clicking a text item with the select tool reopens it with the **whole
  string selected**, the way double-clicking a field does anywhere else: type to
  replace it, or press an arrow to drop the caret at that end and keep what is
  there. A second click more than 400ms later, or more than 10 pixels away, is just
  another click.
- Once an item is open, a click inside it moves the caret to the nearest letter gap
  rather than finishing. That is the way back from the select-everything opening.
- A **new** item stays centred on the point you clicked as it grows, rather than
  hanging below and to the right of the cursor. A reopened item keeps its position
  and grows rightward, since it already has one.
- An empty text item leaves nothing behind and gives back the undo step it took.

## Resizing and rotation

- Handles scale the whole selection from the opposite corner. **The anchored corner
  does not move, at all.** The handles sit on a box padded a few pixels out from the
  content, but they anchor to the real content corner. Anchoring to the padded
  corner drifts everything by the padding times the scale factor, which is the bug
  this rule exists to prevent.
- The scale factor is measured from where the pointer went down, not from the handle
  position, so it starts at exactly 1 and nothing jumps on the first frame.
- Every frame scales the geometry captured when the drag started, not the previous
  frame's, so a long drag cannot accumulate rounding error.
- Scale is clamped to a small positive minimum, so items never flip inside out.
- Coordinates round to one decimal when the drag ends, not during it. At 40x zoom a
  one-pixel move is 0.025 units and per-frame rounding would swallow it.
- Text scales its `size` by the average of the two axes. Because its width is
  measured from the glyphs rather than stored, the arithmetic alone would let the
  anchored edge drift, so after every frame the result is measured and slid back
  until the anchored edges sit exactly where they started. Dragging a left handle
  never moves the right edge, and vice versa.
- Stroke and outline weights never change. See the format rule above.
- The rotation handle sits on a short stalk above the selection box, so it never
  covers the work. Rotating turns the whole selection about the selection's centre:
  boxed items swing their position and add to their `angle`, strokes have the turn
  baked into their points.
- **Shift snaps the angle the item lands on, not the amount it turned by.** Something
  sitting at 7° goes to 0° or 15°, never to 22°. That is what straightening means,
  and snapping the delta instead would leave a crooked thing permanently crooked.
  One boxed item knows its own angle to measure from. A stroke or a mixed selection
  does not, so for those the snap counts from where the drag started.
- Resizing a rotated item works in the item's own space, so a corner drag scales
  along the axes you see. Handles are hit-tested there too, and a rotated item's
  centre is the pivot, so after scaling the item is shifted back to keep the
  anchored corner still on screen.
- Both drags scale or turn the geometry captured when the drag started. Restoring
  that snapshot also removes fields the snapshot did not have, or an `angle` added
  on one frame would accumulate on the next.

## Alignment

- Alt/option with `w` `a` `s` `d` lines things up: top, left, bottom, right.
  Everything moves to whichever edge already reaches furthest that way, so the item
  defining the edge does not move.
- Alt/option with `v` or `h` centres instead: `v` puts everything on one horizontal
  line, `h` stacks it in one column.
- All six match on `event.code`, the physical key, because alt turns a letter into
  some other glyph on most layouts: option-w arrives as `∑`, not `w`. The plain
  letter and the macOS glyph are both listed as fallbacks, so a browser or layout
  that fills in only one of the two fields still lands on the same command.
- **Nothing happens with fewer than two units selected.** Aligning one thing against
  itself has no meaning, so a single item, or a single group, is a no-op.
- **A group moves as one unit.** Lining up its members individually would tear it
  apart, so alignment works on units, where a unit is either a group or a single
  loose item. Fewer than two units means there is nothing to align against.
- Alignment only moves along the axis it works on. Aligning left never shifts
  anything vertically.
- An alignment that changes nothing records no undo step.

## History

- Undo and redo are one operation in two directions: hand the current scene to the
  other stack, take the top of this one. Both stacks hold whole-scene JSON.
- Any new edit ends the redo trail. You cannot redo your way into a future that no
  longer follows from where you are.
- **A key that changes nothing keeps the trail.** Several actions record a step
  before finding out whether they did anything: aligning things already aligned,
  bracketing something already at the end of the stack, abandoning an empty text
  item. Those put the step back and restore the redo trail the step had cleared,
  so a stray keypress after an undo does not strand the work you were about to
  redo.
- Undo and redo both clear the selection, because the items that come back are
  freshly parsed objects rather than the ones that were selected.
- Loading a scene starts with no history in either direction.

## Clipboard

- Copy writes a scene fragment in the same shape as a file:
  `{"format":"minicanvas/1","items":[...]}`. That means a selection can be pasted
  into another canvas, another page, a chat window, or a text editor, and pasted
  back later. The clipboard is the format, same as everything else here.
- Copy and paste ride the browser's own `copy` and `paste` events rather than a key
  handler, so the real clipboard is attached and no permission prompt appears.
  Events arriving from a text field are left alone.
- Paste centres the incoming items on the pointer, so pasting twice in two places
  puts them in two places. With no pointer position yet, it uses the viewport
  centre.
- Clipboard text that is not a scene fragment becomes a text item, collapsed to one
  line. A stray brace or a copied sentence pastes as what it is rather than
  vanishing.
- An internal buffer holds the last copy, and is used only when the system
  clipboard hands over nothing at all. Falling back to it whenever the clipboard
  text was merely unrecognised would paste the wrong thing.
- Duplicating anything, by option-drag or by paste, gives copied groups fresh names.
  Sharing a name with the original would make the two select together forever.
- Option-drag is one undo step, not two: the copy and the move it came with go back
  together.

## Export

- The toolbar exports the scene as JSON with `toText()`: pretty-printed, number
  arrays kept on one line, and byte-for-byte what the scene panel shows. It is the
  file format, so it loads straight back in.
- `toSVG()` returns static SVG for the whole scene, rotation included via
  `transform="rotate(...)"`. Text is emitted with a baseline offset of 0.8 of its
  size, which is the usual gap between canvas's top-anchored text and SVG's
  baseline-anchored text.
- `toPNG(items, pixelRatio)` renders to an offscreen canvas by pointing the same
  drawing code at a different context, and returns that canvas for the caller to
  turn into a blob. Pass the selection to export just that, or nothing for the whole
  scene. It fits the content with 8 units of padding and defaults to 2x.
- A scene holding an image from another origin taints the canvas, and the browser
  refuses to read it back. Pasted and dropped images are data URIs and export fine;
  linked ones may not.

## Colour and dark mode

Every colour in the stylesheet is oklch, and every one declares a hex or rgba first:

```css
--pen-red: #c0392b;  --pen-red: oklch(0.53 0.17 27);
```

A browser too old for oklch drops the second declaration and keeps the first, which
holds the no-recent-APIs requirement without giving up the colour space. Order
matters, and a test enforces it.

Dark mode is one `prefers-color-scheme` media query. It holds each hue and chroma
and moves only the lightness, which is the whole reason for oklch here: the six pens
read as the same six pens in either theme rather than as six new colours. Neutrals
all sit on hue 285 so they drift together.

**The canvas goes dark too, and the pens go light with it.** CSS cannot reach pixels
drawn on a canvas, so the renderer reaches back out to CSS instead: it looks each
stored colour up in `PENS`, asks the page what that variable currently resolves to,
and draws with the answer. The theme lives in the stylesheet, where it was asked to
live.

- **Files never change.** A red stroke is `#c0392b` on disk in both themes. The
  theme decides what that looks like, not what it is.
- A colour outside the six pens is drawn exactly as written. Hand-edit a scene to
  `#123456` and you get `#123456`, dark mode or not.
- Switching the system theme repaints without touching the scene, through a
  `matchMedia` listener that clears the resolved-colour cache.
- **Exports carry the document's colours, not the theme's.** A PNG made in dark mode
  is the same PNG made in light mode, and it paints its own white paper so it is
  never light ink on transparent nothing. The SVG export does the same.
- Embedding the primitive without the stylesheet is fine: unresolvable variables
  fall back to the stored colour.

Buttons draw from `--surface` rather than `--paper`: the paper variable belongs to
the canvas, and reusing it for chrome would tie the toolbar to the drawing surface.

## Toolbar

The demo toolbar is not part of the primitive; delete it when embedding. It floats
bottom-centre over the canvas rather than pushing it down, so the drawing surface is
the whole window and the chrome is a thing on top of it. ctrl/cmd + `.` takes it
away and brings it back; a small pill appears in its place, because a shortcut is
the only way back and a shortcut nobody knows is no way back at all.

Buttons carry Material Symbols icons with the name and shortcut in a hover tooltip,
so the icons stay learnable without a legend taking up room. Fill and opacity keep
text labels: one is a state and the other is a number, and neither reads as a glyph.
The opacity readout is a fixed width in tabular figures, so stepping 100% to 70%
does not shove the rest of the bar sideways.

A pressed tool draws its glyph filled, using the font's FILL axis, which reads at a
glance in a way a background tint alone does not. That means asking Google Fonts for
the axis as a range rather than a fixed 0, which is easy to get wrong and shows up
as a button that never fills.

**The bar never wraps.** Too much content scrolls it sideways instead, so the
toolbar is always one line however narrow the window. That has one consequence worth
knowing: a scrolling box clips anything drawn inside it, so the tooltip and the
download menu are single fixed-position elements placed by hand against whatever
they belong to, rather than pseudo-elements on each button. The bar is also centred
with `margin: auto` rather than a transform, since a transform would make it a
containing block and clip them anyway.

**The icon font is the only network dependency on any of these pages**, and it
belongs to the demo rather than to minicanvas. Every icon button also carries an
`aria-label`, so a screen reader and a page whose font never arrived both still say
what each button is.

It follows two rules worth keeping in any replacement:

- Tool buttons carry their key as a small keycap, so the shortcut is learnable
  without a legend. Keycaps take their color from the button, so they invert along
  with the pressed state.
- The canvas fires `toolchange`, and the toolbar listens rather than tracking tool
  state of its own. A tool picked by keyboard and a tool picked by click land in the
  same place.
- It fires `selectionchange` the same way, carrying `{ items, units }`, and the whole
  toolbar follows it. The event is raised when the *set* of selected items changes,
  not when the count does: swapping a stroke for a rectangle leaves every number
  identical, and a listener that cares what kind of thing is picked has to hear
  about that. **Selecting something puts the making tools away** along with
  undo, redo, and the scene-data button, and brings out what you can do to what you
  picked: layer order at one item, alignment and grouping at two units. Deselecting
  brings them back, so clicking empty canvas is the way out.
- Layer order needs one item; alignment needs two *units*, which is exactly when it
  does anything, since three items in one group are one unit and have nothing to
  line up against.
- Grouping keeps its own group, because the two halves of it need different things:
  joining needs two units, taking apart needs one group. A single loose item can do
  neither, so the button stays hidden; a single group shows it, pressed, offering to
  ungroup. Fit and download step aside during a selection along with the rest.
- Every path that changes the selection ends in a redraw, so the announcement is
  made there once rather than at each of the dozen places that mutate it.
- Alignment buttons name their shortcut in the tooltip, so the toolbar teaches the
  keys rather than replacing them.

## Embedding

```html
<canvas id="board" style="width:100%;height:400px;touch-action:none"></canvas>
<script>/* paste createMiniCanvas here */</script>
<script>
  const board = createMiniCanvas(document.getElementById('board'));
  board.load(document.getElementById('scene').textContent);
  board.setTool('pan');   // read-only viewer: pan and zoom, nothing editable
  board.fit();
</script>
```

`touch-action:none` on the canvas is load-bearing. Without it mobile browsers
consume the pointer events.

### API

`load(data)`, `scene()`, `toText()`, `toSVG()`, `toPNG(items, pixelRatio)`,
`addImage(src, world, maxSize)`, `undo()`, `fit(padding)`, `viewCenter()`,
`selection()`, `selectAll()`, `deleteSelection()`, `reorder(direction, oneStep)`,
`toggleGroup()`, `duplicate(dx, dy)`, `copy()`, `paste(text)`,
`align([dx, dy])`, `center(axis)`, `redo()`, `tool()`, `setTool(name)`,
`setStroke(color, width)`, `toggleFill()`, `cycleOpacity()`, `cycleColor()`,
`pen()`, `on(type, handler)`, `off(type, handler)`, `destroy()`.

Methods only exist when their feature is mounted, which is the point: a viewer has
no `undo` to call by accident.

## Known simplifications

Each one is marked with a `ponytail:` comment in the source.

- Oval hit-testing approximates distance to the ellipse by scaling the normalised
  radius. Fine for a 9px grab zone, wrong for a very eccentric oval.
- A tapped dot is drawn as a 0.01-unit line rather than a special-cased point.
- Both zoom gestures read `core.zoomRate` at the moment of use, so scrolling and
  pinching reach a given zoom together rather than drifting apart.
- Undo and redo store whole-scene JSON snapshots, capped at 60. Fine at this scale;
  a real document would want a command log.
- Resize is corner-only. No edge handles.
- The selection outline around several items at different angles is an upright box.
- Text is a single line with no wrapping. There is a caret, arrow movement, and
  selected runs, but no word jumps and no IME support.
- Grouping is one level deep and stores no order of its own.
- There is no cut. Copy then delete is two keys and no extra code.

## Not built

Deliberately absent, with the trigger that would justify adding each:

- **Filled shapes.** Would need a `fill` field; the renderers already branch by type.
- **Nested groups.** One level is enough for a primitive, and nesting would need a
  real container in the format.
- **Multi-line text.** One line, no wrapping.
- **Multi-user editing.** Out of scope for a portable primitive.
- **Line and arrow tools.** A two-point stroke already covers a line.

## Changelog

- Strokes, images, pan, zoom, erase, undo, JSON round trip, SVG export.
- Select tool: click, shift-click, marquee, drag to move, arrow nudge, delete.
- Resize handles, `[` and `]` layer order, six-color palette.
- Space pans from anywhere, `v` for select, solid blue selection outline.
- Rectangle and oval tools with shift to square, `d` `r` `o` shortcuts.
- `[` and `]` send to back and front, shift for one layer. `e` picks the eraser.
  Erasing lost its slop and now only removes visible ink.
- Width and color reach shapes, rectangles gained rounded corners, and the toolbar
  gained keycaps and capitalised labels.
- Text tool on `t`, rotation handle, PNG export of the selection, and the resize
  anchor stopped drifting.
- Frames turn with a rotated item, a real caret with arrow keys and selected runs,
  double click to edit, new text centred on the cursor, dark mode, and ctrl/cmd + `g`
  to group.
- Option-drag duplicates, and copy and paste move scene fragments through the
  system clipboard.
- Every colour moved to oklch with hex fallbacks, the canvas and pens both flip in
  dark mode, and double click selects the whole string.
- Shift-rotate snaps to true angles rather than relative ones, and alt with `wasd`,
  `v`, or `h` aligns and centres.
- Redo on ctrl/cmd + shift + `z`, a JSON export button, and alignment buttons that
  appear when there are two units to line up.
- Placing text hands back the select tool with the caret still live, and the caret
  blinks.
- Split into a core and seventeen named features, so a build can be 5.0K or 14.2K
  depending on what it needs. Renderers separated from the tools that create them,
  so a read-only build can draw everything and edit nothing.
- `MiniCanvas.mount()` with scene, feature, tool, and fit options; dependencies
  resolved by name; several canvases per page, each with its own features and its
  own keyboard.
- Multiline text on Enter, `fill` for shapes on `f`, `opacity` for everything on
  `g`, and the pen cycle on `c`.
- Filled shapes lost their stroke, opacity steps became 70/50/30/10, and zoom
  sensitivity doubled twice, to `zoomRate` 4.
- The example page grew a floating icon toolbar with tooltips, hidden and restored
  with ctrl/cmd + `.`, downloads behind one button, a scene-data panel on a toggle,
  and edits saved to localStorage as they happen.
- `w` cycles thickness.
- Bounding boxes sit flush against the ink instead of on the raw coordinates, and
  hovering an item outlines it.
- The toolbar became contextual: selecting something swaps the making tools for
  bring-to-front, send-to-back, alignment, and grouping.
- Fixed: the download menu closed on pointerdown, which took the button away
  before the click could land on it, so no format ever downloaded.
- Fixed: the opacity readout was written through the button's `firstChild`, which
  stopped being the text the moment the button gained an icon.
- Fixed: `selectionchange` compared counts, so swapping one item for another of a
  different type went unannounced. It compares the set of items now.
- Fill only appears in the toolbar when a rectangle or oval is selected. The `f`
  key still arms the pen with nothing selected.
- Fixed: the example page saved on `change` alone, which recorded the position an
  item was dragged from rather than where it landed, and never saved typed text
  at all. It now saves on pointerup and keyup as well.
- The example page remembers the toolbar as well as the scene: tool, pen, and
  whether the bar and the scene panel were showing.
- Pan renamed Hand with its own `h` shortcut; the opacity button carries an icon;
  tooltips for thickness, colour, and opacity all read "_key_ to cycle"; add image
  moved into the tool group and gained ctrl/cmd + `u`.

Fixed along the way: dots were unerasable, a bare click box-selected anything whose
bounding box contained the point, space stopped panning once a toolbar button took
focus, the eraser reached 8 pixels past the edge of whatever it was erasing, resizing
dragged the anchored corner along with it, resizing text from a left or top handle
dragged the opposite edge because a measured width does not scale in step with a
scaled position, and a rotation drag accumulated its angle frame over frame because
restoring a snapshot could not remove a field the snapshot never had.
