# minicanvas spec

Version 1 of the format (`minicanvas/1`). This document tracks what the thing is
meant to do; `index.html` in this folder is the implementation and the demo page
around it. The DOM build lives in `minicanvas/index.html`; both read and write the
same scene JSON.

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

Panning and zooming are not edits. While the camera is moving, the canvas repaints
every frame but **selection overlay repositioning waits until the gesture ends**,
since handles are the expensive part of a view tick, not the bitmap itself. Wheel
and pinch end is debounced briefly so a scroll does not flicker the overlay on
every tick.

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
| `transform` | 1.8K | select | resize corners and edges, rotation handle, cursors |
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
    { "type": "text",   "color": "#17171a", "size": 24, "x": 0, "y": 0, "w": 200, "text": "wraps in a column" },
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
  `text` are real line breaks; the box is as tall as its row count. The font family
  and the 1.25 line spacing are renderer constants, not stored fields, for the same
  reason the corner radius is: nothing in a file should break if the renderer's
  taste changes.
- **Text may carry a `w`, and that `w` is a column rather than a box.** Absent, the
  item is as wide as its widest line and never wraps, which is what every file
  written before this field says. Present, the words wrap inside it: `w` is the
  width, the height is still whatever the rows come to, and there is no `h` to
  contradict. Wrapping is measured at render time, so the same string is one line
  in a wide column and four in a narrow one without the file changing a character.
  Only spaces break, and a word wider than the whole column breaks where it runs
  out of room.
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
| `p` | Pin the current view. Names itself after the highest selected text item, or after the highest text on screen when nothing is selected. |
| `n` | Start a new document: the switcher opens with the name field where the row will be. |
| `shift` (hold) | While drawing a rect or oval, constrain to a square. While dragging a corner handle, keep the aspect ratio; an edge drag is one axis by definition, so shift has nothing to hold. While dragging the rotation handle, snap to 15°. While clicking with select, add or remove one item. While nudging, move 10 units instead of 1. With `[` or `]`, move one layer instead of all the way. |
| arrows | Nudge the selection 1 unit, or 10 with shift. One undo step per key press, not per repeat. |
| arrows, while typing | Move the caret. Shift extends a selected run, Home and End jump to the ends, and a plain arrow with a run selected collapses to its edge. |
| alt/option + left or right, while typing | Move a whole word: over the gap in the direction you are going, then over the word itself. Shift extends the run a word at a time. A line break counts as gap, so option and left from the start of a line reaches the last word of the one above. |
| alt/option + backspace or delete, while typing | Take the whole word behind or ahead of the caret. A run already selected is deleted as it stands, since it says how much to take on its own. |
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
| click an item, select tool | Select it, or its whole group. Shift-click adds or removes. Right-click and ctrl/cmd-click do nothing to the selection. |
| drag from empty canvas, select tool | Box-select everything the rectangle touches |
| drag from an item, select tool | Move the whole selection |
| drag inside a selected item | Move the whole selection, even where the item itself is hollow and catches nothing |
| alt/option drag from an item | Leave the original in place and drag a copy of the selection |
| drag a corner handle | Resize the whole selection, anchored to the opposite corner |
| drag an edge of the frame | Stretch the selection along that one axis, anchored to the opposite edge. Anywhere along the edge works; it has no handle of its own. |
| drag the round handle above the box | Rotate the whole selection about its centre |
| wheel or two-finger scroll | Pan |
| ctrl/cmd + wheel, or pinch | Zoom toward the pointer, clamped between 0.05x and 40x |
| | Sensitivity is `core.zoomRate`, default 4. Zoom is multiplicative, so the rate is an exponent: 4 means a gesture covers four times the zoom range 1 did. Set it live to retune. |
| middle-drag | Pan |
| drag on the canvas | Does not sweep toolbar labels or other page chrome into a browser selection: `body.mc-dragging`, `selectstart`, and `preventDefault` on pointerdown block that for the duration of the press |
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
  The outline is 1.5 screen pixels and the handles 9, at every zoom. The edges
  carry no squares of their own, though they are draggable: four more handles would
  crowd a small selection out of existence, and the frame is already a line in
  exactly the right place.
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
- **A marquee in progress draws as a solid grey filled box**, in its own colour
  rather than the selection's: it is a region being swept, not a thing that has
  been chosen, so it leaves the blue to the outlines inside it.
- **What the marquee is over is outlined in selection blue while the drag is live,
  and only actually selected when the button comes up.** The preview promises exactly
  what letting go will take, group members included. Handles are left off it: they
  belong to a selection you can already act on, and this one does not exist yet.
- The preview is recomputed against the whole scene on every move rather than
  accumulated, so dragging back over something takes it out again the same way it
  went in.
- Nothing enters the selection until the release, which is what keeps every plugin
  listening for a selection change from hearing one on every frame of a drag.
- **A marquee touches a filled shape anywhere in its box, and an unfilled one only
  where the drag crosses the stroke band or wraps around the whole ring.** Landing
  entirely in an unfilled shape's hollow middle is not a touch — the same rule
  `nearEdge` already applied to a single click, extended to a dragged box. Without
  it, a marquee drawn to catch something small sitting inside a big empty
  rectangle dragged the rectangle in too, since the marquee's box sat inside the
  rectangle's box and a plain overlap test could not tell the difference between
  that and actually touching it. `rect` and `oval` carry this as their own
  `within`; text, images, and strokes are unaffected — text and images were
  already full-box hits with nothing hollow about them, and a stroke already had
  its own point-based `within`.
- With more than one loose item selected, each gets its own outline plus one outer
  box carrying the handles. A group gets one outline only, because a group is one
  thing until you take it apart.
- One rotated item gets a frame that turns with it: the outline, the four handles,
  and the rotation stalk are all drawn in the item's own space, so they sit on the
  item rather than around a box it happens to fit inside. Any other selection gets
  an upright frame, since several angles have no single frame to share. The
  per-item outlines in a multiple selection are frames in their own right, so each
  one turns with its own item even though the box around the lot stays upright.
- Strokes are box-selected by their points, not their bounding box, so a marquee
  beside a long diagonal misses it. Images, rects, and ovals use their box.
- **Hovering an item outlines it**, at 60% opacity and with no handles: handles
  would invite a drag that hovering has not earned. It follows a group, skips
  anything already selected, and only happens with the select tool.
- **The hover outline is the same frame the selection would draw**, built the same
  way and turned the same way. A box that hugged a tilted item loosely, upright,
  would promise a different thing from the one the click is about to take.
- A marquee needs real area before it selects. A plain click on empty canvas clears
  the selection instead. Empty canvas means outside every selected item: pressing
  inside one is a move.
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
- **Every part of the editor works on rows the wrap made, not just on newlines.**
  Once an item has a column, a row is what the reader sees on one line, whether a
  newline ended it or the wrap did. Up and down move between those rows, a click
  puts the caret on the one it landed on, and a selected run is painted a row at a
  time. Every row records where it starts in the string, which is the whole of it:
  a row the wrap made runs straight into the next one, while a row a newline made
  has that character sitting between them.
- A caret exactly on a wrap belongs to the row below, where the next character it
  types will appear. End is the one place that reads it the other way, stopping
  after the last word of the row rather than after the space that ended it, since
  that space is where the row below begins.
- Left and right move the caret, up and down move between rows keeping the column
  where the row is long enough, Home and End reach the ends of the current row,
  and ctrl/cmd + `a` takes the whole string. A plain arrow with a run selected
  collapses to that run's edge rather than moving one character.
- **Option and an arrow move by word, and option and backspace take one.** Both
  step over whatever is not a word first and then over the word, which puts the
  caret at the near edge of the word behind you and the far edge of the one
  ahead. Spaces, punctuation and line breaks are the same kind of gap, so option
  and left from the start of a line reaches the last word of the line above
  rather than stopping on the break. It is the same reading of what a word is
  that a double click already used, from the same two functions, so selecting a
  word by pointer and stepping over it by keyboard can never disagree.
- Option with a run already selected deletes the run rather than a word: the
  selection has said how much to take, and the modifier only decides that
  question when nothing has answered it.
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
- **An edge stretches one axis and leaves the other exactly alone**, anchored to the
  opposite edge. It is the same drag as a corner with one of the two scales pinned
  at 1, so everything below holds for it too. An edge is grabbed anywhere along its
  length rather than at a handle.
- **An edge reaches outwards and barely inwards at all**: the full handle distance
  outside the line, three pixels inside it. A band reaching in as far as it reaches
  out means a press near the top of a shape resizes something that plainly meant to
  pick it up, and the room inside a frame belongs to what the frame is drawn around.
  The direction is read off the edge's own outward `push`, so the sign of the
  offset says which side of the line the pointer is on.
- **A handle under the pointer wins over whatever shape is stacked beneath it.**
  Rotate, corner, and edge grabs on the current selection take precedence, so a
  press on the rotation knob does not select an unrelated item underneath. Elsewhere
  on the frame, something not in the selection under the pointer is still asking to
  be picked up, and picking it up beats resizing through a frame edge that happens
  to run past. The body of a selected item is always a move, even where the item
  itself is hollow and catches nothing on its outline alone.
- The scale factor is measured from where the pointer went down, not from the handle
  position, so it starts at exactly 1 and nothing jumps on the first frame.
- Every frame scales the geometry captured when the drag started, not the previous
  frame's, so a long drag cannot accumulate rounding error.
- Scale is clamped to a small positive minimum, so items never flip inside out.
- Coordinates round to one decimal when the drag ends, not during it. At 40x zoom a
  one-pixel move is 0.025 units and per-frame rounding would swallow it.
- **A left or right edge dragged on text sets its column and never its size.** The
  words reflow into more or fewer rows and every glyph stays exactly the size it
  was, which is the resize a paragraph actually wants — text made bigger by being
  made wider is a heading, not a paragraph. An item that never had a column gets
  one measured off its own widest line the moment it is dragged, so nothing has to
  be prepared in advance. The top edge is the anchor on that drag, so the rows grow
  downwards.
- Any other drag scales `size` by the average of the two axes, and scales the
  column with it when there is one, so a corner makes the same text bigger rather
  than re-wrapping it as it goes.
- Because a text box is measured rather than stored — glyph widths without a
  column, reflowed rows with one — the arithmetic alone would let the anchored edge
  drift, so after every frame the result is measured and slid back until the
  anchored edges sit exactly where they started. Dragging a left handle never moves
  the right edge, and vice versa.
- Stroke and outline weights never change. See the format rule above.
- The rotation handle sits on a short stalk above the selection box, so it never
  covers the work. The stalk is centred on the knob, and both turn about the same
  top-centre anchor. Rotating turns the whole selection about the selection's centre:
  boxed items swing their position and add to their `angle`, strokes have the turn
  baked into their points.
- **While a group or mixed selection is turning, the outer frame spins with the
  drag** rather than re-fitting an upright box every frame. The bounds at press time
  are frozen and the cumulative angle is applied until the pointer comes up, when the
  frame settles back to an upright fit. A lone rotated item already behaved this way
  through its own `angle`; this extends the same feedback to multi-item selections.
- **Shift snaps the angle the item lands on, not the amount it turned by.** Something
  sitting at 7° goes to 0° or 15°, never to 22°. That is what straightening means,
  and snapping the delta instead would leave a crooked thing permanently crooked.
  One boxed item knows its own angle to measure from. A stroke or a mixed selection
  does not, so for those the snap counts from where the drag started.
- Resizing a rotated item works in the item's own space, so a drag scales along the
  axes you see rather than the ones the screen has. Handles and edges are hit-tested
  there too.
- **A rotated item is pinned by where its anchor was on screen when the press
  landed.** An item spins about its own centre, and scaling moves that centre, so
  holding the anchor still in the item's own space is not enough to hold it still
  where you are looking. The screen position is captured once, at the press, and
  every frame ends by sliding the item back onto it. Measuring against the frame
  before instead aims at a target that has itself just moved: the item then crawls
  away from the pointer a little per frame, which reads as a side drag growing both
  dimensions and a corner drifting off the cursor.
- The cursor says which of these a press would be, since an edge draws nothing to
  advertise itself. It is the handle's outward direction turned by the frame's own
  angle and rounded to the nearest 45°, so a tilted frame gets the arrow that
  matches the way its edge will really move: on a frame turned 45°, the right edge
  reads `nwse-resize` and the bottom-right corner reads `ns-resize`. It comes from
  the same hit test the press uses, so the two cannot promise different things.
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
- **HTML downloads the whole page with the current document baked into it**: the
  scene block is rewritten with `toText()` and stamped with the document's id,
  name, and pinned views, and the file is named after the document. One file, no server, no storage
  and nothing to send alongside it. The scene block was always what let the data
  outlive the script; this writes one on purpose.
- The export is a copy of the live page, so everything the chrome was doing when
  the button was pressed is put back first: panels closed, lists emptied, the
  toolbar returned, and the tooltip and download menu stripped of coordinates that
  belong to a window this file will not open in. The icon font has to arrive again
  wherever the copy lands, so it starts out waiting for it rather than claiming it
  is already there.
- **A note that spells out a closing script tag would end the scene block early**,
  so every `</` is written `<\/`. JSON reads that as a plain slash, which costs
  whoever opens the file nothing.
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
- **Images are dimmed to 0.4 brightness on dark paper.** A photograph is the one
  thing on the canvas the theme cannot re-colour, and a lit window at full
  brightness on a dark page is the brightest thing in the room. The dim is a
  `--image-brightness` variable — not a colour, but read out of the stylesheet at
  draw time by exactly the same road the pens take, so the number lives with the
  theme and the renderer holds no opinion about it. It reaches the canvas as
  `context.filter`, which a browser too old to know the property simply ignores,
  leaving an undimmed picture rather than a broken one.
- Switching the system theme repaints without touching the scene, through a
  `matchMedia` listener that clears the resolved-colour cache.
- **Exports carry the document's colours, not the theme's.** A PNG made in dark mode
  is the same PNG made in light mode, and it paints its own white paper so it is
  never light ink on transparent nothing. The SVG export does the same, and neither
  dims an image: the file is not dark, only the screen was.
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

Placing them by hand means deciding which side to place them on. **A tooltip goes
above its button, and below it when there is no room above.** The toolbar has the
whole window over it; the search button in the top corner has eight pixels, and a
tooltip anchored over that one lands off the top of the screen. Its own text is
the long form of what the button does: *Jump to documents, pinned views, or text
nodes · ⌘K*, since an icon in a corner explains itself to nobody.

**The page has no network dependency at all.** The icons are an SVG sprite in the
markup: 36 symbols defined once, pointed at from every button with `<use>`. They
are on screen in the first frame, they work on a machine that has never been
online, and an exported page carries its own — which is the case that decides it,
since a file somebody was sent is exactly the one that cannot go and fetch a font.
Every icon button keeps its `aria-label` all the same, because a picture is not a
name.

- **The glyphs are the official Material Symbols Outlined paths**, fetched from
  `google/material-design-icons` (Apache License 2.0) at
  `symbols/web/{name}/materialsymbolsoutlined/{name}_24px.svg` and inlined as one
  `<path>` per symbol. Google ships each as a single filled shape on its own
  `-960..960` viewBox rather than an actual stroked line — the outline look is
  baked into the path itself — which is why there is nothing to convert: a
  `<symbol>` carries its own viewBox independent of the sprite around it, so `<use>`
  scales each one correctly without touching the coordinates.
- Colour comes from the button through `fill: currentColor` on `.icon`, which is
  what lets a pressed one invert without the icon knowing anything about it. One
  fill, no stroke, since every glyph already is one.
- The sprite is a definition rather than a picture, so it is `display: none` and
  never drawn where it sits.
- `icons/icons_official.py` in the working tree is the record of what was fetched
  and from where, kept separate from the markup so a future re-fetch has something
  to diff against.

What it replaced, in order: the Material Symbols variable font over Google Fonts,
subset with `icon_names` to cut it from megabytes to kilobytes, and before that, 36
glyphs drawn by hand rather than fetched — the fetch tool available at the time
could only open a URL already surfaced by search, and Google serves each icon at
its own URL that search rarely happens to index, so getting the *exact* official
paths meant the person fetching them directly and handing them back. Hand-drawn was
the honest fallback until then, not a permanent choice: a close approximation of a
licensed set is worse than either the real thing or a page that admits it drew its
own.

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

## Documents

Also the demo page, not the primitive: minicanvas holds one scene, and how many of
them a page keeps is the page's business. Switching is a save and a load, so none of
this reaches inside the canvas.

The current document's name sits top left. Clicking it opens a panel **over** the
name, so the list appears where the thing you clicked was: a filter field, the
documents, and `+ New document`. Arrows and Enter work from the field, which makes
it a switcher rather than a menu you have to aim at. A row renames from the pencil
and deletes from the ×, both of which hang over the end of the name rather than
taking a column of their own, so a row nobody is pointing at is all name.

It reads as a list of places to go rather than a stack of fields: no boxes, a
little air between the rows, and the only row drawn on is the one under the
pointer. The current document is the bold one.

**Nothing in a list shrinks; the list scrolls.** A flex column will squeeze its
children to fit before it will overflow, so a search with thirty results in it
crushed every row to a few pixels and slid the snippet and the document name
over each other. The rows and the two lines inside one are `flex: 0 0 auto`, and
the box scrolls, which is what the box was given a height for.

**The row that makes another one carries its own tint**, a gap above it, and its
key after a dot: `+ New document · N`. It is the one row in the list that is not
a place to go, and drawn faintly at the end of ten others it disappeared into
them. The dot is the same separator the toolbar tooltips use before a shortcut.

- **The list is ordered by when you were last in a document.** The one you want
  next is usually the one you were in before this one, so it sits on top. Opening a
  document stamps it, including the one the page opens with. Anything saved before
  there were stamps sorts to the bottom.
- **A document is named before it exists.** `+ New document` opens a field where the
  row will be, and Enter or the check mark creates it. Nothing is written until the
  name is, so backing out with Escape leaves no empty document to tidy up later.
  `n` does the same from anywhere, and the row carries that key beside it. A key
  printed on a row has to do what the row does, or it is a legend rather than a
  shortcut: both open the field, neither writes anything on its own.
- Renaming is the same editor, reached from the pencil, and ends the same way:
  Enter or the check mark. Both start with the name selected, so typing replaces it.
- **The editor is the same height as the row it replaces.** The field is built to
  the name's box rather than the 30 pixels the filter fields use, or pressing the
  pencil hops every row below it by two.
- **An empty name is not a way out of the editor**, since a name is the whole point
  of it: the check mark hands focus back rather than saving nothing. Clicking away
  keeps a name you had typed and abandons an empty one, which is the reading that
  loses nobody's work either way.
- The check mark takes no focus when pressed, or the field's own blur would decide
  the question before the click ever landed.
- **A document saved before names were asked for is called after its own first line
  of text.** A list of six things called Untitled is not a list.
- Scenes are kept one to a key, `minicanvas-demo-doc:<id>`, with a short index at
  `minicanvas-demo-docs` holding the ids, the names, and which one is open. Names
  live in the index and nowhere else, so drawing the list costs one small read
  rather than parsing every scene on the page.
- **A page exported as HTML carries a document's id**, so a copy opening on a
  machine that already has documents adds one rather than replacing them or being
  ignored, and opening the same file twice adopts it once: the second time the id
  is already known and whatever has been drawn on it since is what opens. A copy
  landing somewhere brand new gets no empty document invented alongside it.
- **Whatever a one-document page saved becomes document one.** The old
  `minicanvas-demo-scene` key is carried into a fresh document and removed, so
  nothing anyone drew before there were documents is stranded.
- The scene the page mounts with is written down immediately, even before anything
  is drawn on it. Without that first write it has no key of its own and would
  vanish the first time you switched away.
- There is always one document, so the last one cannot be deleted: the page would
  have no scene to show and would have to invent one. Deleting the open one lands
  you in whichever you were in most recently.
- Reset resets the document you are in. It is one document's undo of last resort,
  not the page's.

## Pinned views

A pinned view is a place rather than a thing: where the camera was and how far in.
Also the demo page rather than the primitive, for the same reason documents are —
minicanvas holds one scene and one camera, and which corners of it are worth
coming back to is the page's business.

`p` pins where you are. The dashes down the left edge say how many places this
document holds, one dash each, and pointing at them opens the list: a filter
field, the views, and `+ Pin current view`. It is the switcher's panel with a
different list in it, down to the rename pencil, the delete ×, and arrows and
Enter from the field.

- **Nothing is drawn for it but the dashes.** A rail of them costs a few pixels of
  the left edge and answers the only question a resting state has to — how many
  did I keep — without a panel sitting open to do it.
- **A view names itself after the highest text in it.** With text selected, the
  highest selected item wins; with nothing selected, the same rule casts its net
  over whatever text is on screen. The top of what you were looking at is the
  heading of it, which is the rule an unnamed document already follows down to its
  own first line. Neither finds anything on a blank stretch of canvas, and then it
  is `View 3` until you rename it.
- **Going to one selects nothing.** Arriving somewhere is not the same as picking
  up what you find there, which is the whole difference between a pinned view and
  a search result: the result answers *where is that thing*, and hands it to you
  outlined. The view answers *take me back*, and leaves the place as you found it.
- **The centre of the window is stored, not the corner.** The format keeps
  `view.x` and `view.y` as the world point at the top left, which is the right
  thing for a file and the wrong thing for a bookmark: the same numbers on a
  wider window frame something else. A pinned view holds the middle and the zoom,
  and the corner is worked back out on arrival, so a view pinned on a laptop
  opens on the same thing on a monitor.
- Views live in the document index beside the names, `minicanvas-demo-docs`, and
  never in the scene. A bookmark is not a mark on the paper: the format stays
  `minicanvas/1` with nothing added, drawing the rail costs one small read, and a
  view survives every edit to what it points at.
- **Pinning is a keystroke with nothing on screen to show for it**, so the list
  opens for a couple of seconds on the view just made, tinted, long enough to read
  the name it chose and change it. Typing in the panel puts the fuse out; so does
  keeping the pointer there. With the chrome hidden `p` still pins, and there is
  simply nothing to show you.
- Deleting one asks nothing first. A document holds work and is confirmed before
  it goes; a view is a bookmark, and the key that made it makes another.
- Hovering opens the list, and the rail and the panel touch, so the pointer
  crossing from one to the other never falls through a gap and closes it. A press
  held down opens nothing: a stroke drawn from the left edge drags the pointer
  straight across the rail, and a panel that appeared mid-drag is a panel nobody
  asked for. A tap opens it too, and only opens it, since a finger raises the
  hover and the tap together and a toggle would close what it had just opened.
- The rail is chrome, so ⌘. takes it away with the toolbar and the document name.
- **An exported page carries the views of the document baked into it**, in
  `data-views` on the scene block beside the id and the name. The places the
  author kept travel with the page they were kept in.

## Search

⌘K or ⌘space, or the button top right. It matches document names and every text
item in **every** document, as you type, and picking a result switches document if
it has to, centres the item, and selects it: the answer to "where is that" is the
thing outlined in front of you.

A result is the matching line with the words marked, and **the document it came
from underneath it in small text**. The panel is wider than the switcher because a
snippet wants the whole width, and the document name below rather than beside it is
the rest of that same trade.

**Pinned views are in there too**, from every document, marked as such under the
name. They rank above a line of text and below a document name: somewhere you
kept on purpose is worth more than a line you happened to write, and less than a
whole document. Picking one does what picking it in the rail does — takes you
there, selects nothing.

**An empty box is not an empty answer.** With no query typed, the panel lists every
pinned view in every document and then every document itself, most recently opened
first in each group. A search box open on nothing is asking where you would like to
go, and those are the page's own answers to that. Views come first because they are
the more particular one — a place inside a document rather than the whole of it —
and because a document is one row away in the switcher regardless. Enter takes the
top one.

The index is a trie over each word and each of that word's suffixes, so `plan` and
`ann` both reach *planning* without walking the corpus. Two things keep it small:

- **It stores only the first ten characters of a word**, and
- **it is a filter rather than an answer.** Candidates come out of the trie and a
  plain `indexOf` confirms each one. That is what makes the depth cap safe: a query
  longer than the trie is deep is only ever narrowed further by the characters the
  trie never stored, and the confirming pass rejects the near misses.

A multi-word query narrows the candidate lists against each other before any text
is read, and both passes are per entry, so ranking never touches an entry that
cannot match. A word you started typing scores above one you landed in the middle
of, and a document's name scores above a line inside it.

The index is rebuilt lazily, when the panel opens after an edit rather than on
every keystroke, and it reads the open document live rather than from storage.

**No embedding model.** A local one means megabytes of weights over the network,
which requirement 1 settles; for a page of notes a trie is smaller and its failures
are predictable.

The name, the search button, and the rail of pinned views are all chrome, so ⌘.
takes them away with the toolbar and closes every panel. **The search panel itself is not chrome**: ⌘space
and ⌘K open it from a bare page, since hiding the toolbar is exactly when a
shortcut is the only way in. It is caught in the capture phase, because the canvas
reads Space as a pan and would take the cursor with it on the way past. ⌘space is
Spotlight on macOS and often never reaches the page at all, which is why there is a
second key rather than one.

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
- An edge is a grab zone with no handle drawn on it, so nothing but the cursor says
  it can be dragged.
- The selection outline around several items at different angles is an upright box,
  even though each item inside it gets an outline of its own that turns.
- Text has a caret, arrow and word movement, and selected runs, but no IME
  support and no paragraph jumps on option with up or down.
- Wrapping breaks on spaces only: no hyphenation, no dictionary, and nothing that
  knows a language which does not put spaces between words. A word wider than the
  column breaks where it runs out of room rather than where a typesetter would.
- A wrapped item re-wraps its whole string whenever the text, the size, or the
  column changes, and caches the answer until one of the three does. A paragraph
  engine would re-wrap from the edited row onwards; a note does not need one.
- A column sets the width and nothing sets the height: the rows fall where they
  fall. There is no vertical alignment inside a text box and no clipping, so
  dragging a top or bottom edge on text still scales the size like a corner.
- Grouping is one level deep and stores no order of its own.
- There is no cut. Copy then delete is two keys and no extra code.
- The search trie indexes suffixes only for the first 40 characters of a word,
  which is the wrong trade for a language that does not put spaces between words.
  A real corpus wants a suffix array, or an inverted index with positions.
- The search index is rebuilt whole rather than per document, and every document's
  scene is parsed to build it. Cheap for a page of notes, wrong for a hundred.
- Documents are a list in one key. No folders, no manual ordering, no sync.
- Pinned views ride in that same key, in the order they were made. No reordering,
  and no view that belongs to more than one document.
- The rail draws twelve dashes at most. Past a dozen the count stops being the
  answer and the list is, so the thirteenth pin adds a row and no dash.
- The HTML export serialises the live DOM rather than re-reading the source file,
  which no page can do from a `file:` URL. What comes out is what the browser
  thinks the markup is, tidied by hand, not the bytes that went in.
- One document travels per exported page, the one you are in. Sending three means
  sending three files.
- Nothing checks the sprite against the icons the page asks for. A `<use>` pointing
  at a symbol that is not there draws nothing at all, which is quieter than it
  should be.
- The sprite is fetched once by hand rather than kept in sync with upstream. A
  future Material Symbols revision that redraws a glyph, or a name added to the
  page, needs the same fetch-and-hand-back step repeated; nothing here notices
  either kind of drift on its own.
- Recency is a timestamp written when a document is opened, so two tabs on the same
  page write over each other's idea of what was most recent.

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
- Dragging an edge of the frame stretches one axis, with a resize cursor on every
  edge and corner that turns with the frame, a slightly heavier selection outline,
  and the body of a selected item as a place to grab it by.
- The example page holds several documents, with a switcher under the name top left
  and the old single-scene key carried into the first of them. Search on ⌘K or
  ⌘space reaches every name and every text item in every document, through a trie
  of word suffixes that narrows candidates for an `indexOf` to confirm. Both go away
  with the toolbar; the search panel opens either way.
- The switcher lost its boxes: documents are ordered by when you were last in one,
  new ones are named before they are created, and renaming ends on Enter or a check
  mark. Results grew wider and carry the document they came from underneath.
- Download gained HTML: the whole page with the current document baked into the
  scene block, named after the document, which opens as that document wherever it
  lands.
- The icons are inlined as an SVG sprite and the font is gone, so the page has no
  network dependency left and a copy of it works offline. Double click while editing
  text takes the word under it and dragging pulls a run out, the way a text field
  does. A frame edge resizes from the line outwards; inside it belongs to the thing
  the frame is drawn around.
- The hand-drawn icons were replaced with the official Material Symbols paths, once
  the person fetched them from Google's repository directly and handed them back —
  same sprite, same `<use>` wiring, `fill: currentColor` in place of the stroke
  styling the hand-drawn set needed.
- Marquee selection stopped treating an unfilled shape's hollow middle as solid: a
  drag that never reaches the stroke no longer selects it.
- The marquee became a solid grey box with blue preview outlines while you drag,
  and commits only on release.
- Pan and zoom defer selection-overlay repositioning until the camera settles.
- Right-click and ctrl/cmd-click no longer change the selection. Shift-click still
  adds or removes.
- Dragging on the canvas no longer sweeps toolbar labels into a browser selection.
- Rotate, corner, and edge handles take precedence over shapes stacked underneath.
- While rotating a group, the selection frame spins with the drag rather than
  breathing to a new upright box each frame.
- Pinned views on `p`: a rail of dashes down the left edge, one per view, with the
  switcher's own panel on the end of it. A view keeps the middle of the window and
  the zoom, names itself after the highest text selected or on screen, renames and
  deletes the way a document does, and takes you back without selecting anything.
  Search lists them all when nothing is typed and ranks them between a document
  and a line of text. An exported page carries the views of the document in it.
  `n` starts a document, and both add-rows print their key.
- Fixed: a list long enough to scroll shrank its own rows instead, so thirty
  search results arrived a few pixels tall with each snippet lying across the
  document name under it. Rows no longer shrink and the panel scrolls. The
  add-rows gained a tint, a gap above, and a dot before the key.
- Fixed: the rename field was 30 pixels tall where the row it replaced was 32, so
  pressing the pencil nudged every row under it. Tooltips flip below their button
  when there is no room above, and the search button has one naming what it
  reaches rather than a browser title.
- Option with an arrow moves the caret a word at a time, shift extends the run by
  a word, and option with backspace or delete takes the word behind or ahead of
  it. Word boundaries come from the same pair of functions a double click uses.
- Text wraps. A left or right edge dragged on a text item sets a `w` on it and the
  words reflow into more or fewer rows at exactly the size they were; a corner
  still scales the size, and the column with it. Rows carry where they start in
  the string, so the caret, the arrows, a click, and a selected run all work on
  what the reader sees rather than on newlines. An item with no `w` is unchanged,
  which is every file written until now.
- Images draw at 0.4 brightness in dark mode, from a `--image-brightness` variable
  the renderer reads the way it reads the pens. Exports are untouched.
- Search with an empty box lists the documents under the pinned views, rather than
  the views alone.

Fixed along the way: the document rows took the scene panel's `.row` class with
them, and its top border drew a box around every one; and the toolbar showed the
pen pressed while the canvas was on the hand, because a fresh visit had no saved
tool to restore and nothing announced the one it had. The page mounts on the pen
now, and presses whichever button the canvas says is live.

Fixed along the way: dots were unerasable, a bare click box-selected anything whose
bounding box contained the point, space stopped panning once a toolbar button took
focus, the eraser reached 8 pixels past the edge of whatever it was erasing, resizing
dragged the anchored corner along with it, resizing text from a left or top handle
dragged the opposite edge because a measured width does not scale in step with a
scaled position, a rotation drag accumulated its angle frame over frame because
restoring a snapshot could not remove a field the snapshot never had, resizing a
rotated item measured back to the frame before rather than to where the anchor was
when the press landed, so the item crawled away from the pointer, and the hover
outline was an upright box while the click it stood for was tested in the item's own
turned space.