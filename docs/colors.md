# Colour

Every button, active tab, focus ring and avatar used to be `slate-900`. One
black for "primary action", "you are here", "this field has focus" and "this is
a person" — so nothing stood out, because everything stood out equally.

There is now one brand colour, defined once in `tailwind.config.js` as the
`brand` scale (indigo, `brand-600` = `#4f46e5`). Change those ten values and the
whole app follows; nothing hardcodes a hex.

## What each colour means

| Colour | Means | Examples |
| --- | --- | --- |
| `brand-600` | the thing to click, or the thing you are on | primary buttons, active nav pill, selected tab, checked boxes, progress |
| `brand-500` | focus | input borders and rings, `.app-select:focus` |
| `brand-50` / `brand-700` | hover on quiet controls, text links | nav hover, "Manage", "Group page" |
| `slate-900` | dark *surfaces* and body text | the install banner, the marketing hero, modal scrims, the "supervisor" chip |
| `green` | settled, paid, active | balance cleared, group ACTIVE, meal-plan toggle on |
| `red` | owed, destructive | outstanding dues, Remove, Leave, Deactivate |
| `amber` | waiting on someone | pending invitations, approvals, the group limit warning |

The rule that keeps it readable: **brand means interactive, slate means
furniture.** Green, red and amber were already carrying meaning about money and
state before this change, which is exactly why the brand colour is indigo — a
blue-violet primary can never be mistaken for "you owe money" or "this is
settled".

Secondary buttons stay a neutral outline on purpose. One coloured primary per
view is what makes it read as *the* action.

## Contrast

White on `brand-600` is 6.5:1, past the 4.5:1 AA floor for normal text, so
button labels stay legible for low-vision users and on a phone in daylight.
Keep any new pairing at or above that — `brand-500` is for borders and rings,
not for text on white.
