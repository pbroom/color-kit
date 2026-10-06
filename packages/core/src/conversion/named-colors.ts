/**
 * CSS Color 4 named colors (148 keywords plus `transparent`), packed to keep
 * the bundle small. https://www.w3.org/TR/css-color-4/#named-colors
 *
 * `NAMES` lists the 141 distinct keywords in alphabetical order, each written
 * as one digit (how many leading letters it shares with the previous name)
 * followed by the rest of the name: `0aliceblue1ntiquewhite` decodes to
 * `aliceblue`, `antiquewhite`. `VALUES` holds each keyword's `rrggbb` hex in
 * the same order, six digits apiece. The seven `*grey` spellings are folded
 * onto their `*gray` twins at lookup time, and `transparent` is added on its
 * own because it is the only keyword with an alpha channel.
 *
 * The table is decoded into a `Map` on first use, so importing this module
 * costs nothing until a keyword is looked up.
 */
const NAMES =
  '0aliceblue1ntiquewhite1qua4marine1zure0beige1isque1lack3nchedalm' +
  'ond2ue4violet1rown1urlywood0cadetblue1hartreuse2ocolate1oral3nfl' +
  'owerblue4silk1rimson1yan0darkblue4cyan4goldenrod5ray6een4khaki4m' +
  'agenta4olivegreen5range6chid4red4salmon5eagreen5lateblue9gray4tu' +
  'rquoise4violet1eeppink4skyblue1imgray1odgerblue0firebrick1loralw' +
  'hite1orestgreen1uchsia0gainsboro1hostwhite1old4enrod1ray2een5yel' +
  'low0honeydew2tpink0indianred4go1vory0khaki0lavender8blush2wngree' +
  'n1emonchiffon1ightblue5coral6yan5goldenrodyellow6ray7een5pink5sa' +
  'lmon6eagreen6kyblue6lategray6teelblue5yellow2me4green2nen0magent' +
  'a2roon1ediumaquamarine6blue6orchid6purple6seagreen7lateblue7prin' +
  'ggreen6turquoise6violetred1idnightblue2ntcream2styrose1occasin0n' +
  'avajowhite3y0oldlace2ive5drab1range6red2chid0palegoldenrod5reen4' +
  'turquoise4violetred2payawhip1eachpuff2ru1ink1lum1owderblue1urple' +
  '0rebeccapurple2d1osybrown2yalblue0saddlebrown2lmon2ndybrown1eagr' +
  'een3shell1ienna2lver1kyblue1lateblue5gray1now1pringgreen1teelblu' +
  'e0tan1eal1histle1omato1urquoise0violet0wheat2ite5smoke0yellow6gr' +
  'een';

const VALUES =
  'f0f8fffaebd700ffff7fffd4f0fffff5f5dcffe4c4000000ffebcd0000ff8a2b' +
  'e2a52a2adeb8875f9ea07fff00d2691eff7f506495edfff8dcdc143c00ffff00' +
  '008b008b8bb8860ba9a9a9006400bdb76b8b008b556b2fff8c009932cc8b0000' +
  'e9967a8fbc8f483d8b2f4f4f00ced19400d3ff149300bfff6969691e90ffb222' +
  '22fffaf0228b22ff00ffdcdcdcf8f8ffffd700daa520808080008000adff2ff0' +
  'fff0ff69b4cd5c5c4b0082fffff0f0e68ce6e6fafff0f57cfc00fffacdadd8e6' +
  'f08080e0fffffafad2d3d3d390ee90ffb6c1ffa07a20b2aa87cefa778899b0c4' +
  'deffffe000ff0032cd32faf0e6ff00ff80000066cdaa0000cdba55d39370db3c' +
  'b3717b68ee00fa9a48d1ccc71585191970f5fffaffe4e1ffe4b5ffdead000080' +
  'fdf5e68080006b8e23ffa500ff4500da70d6eee8aa98fb98afeeeedb7093ffef' +
  'd5ffdab9cd853fffc0cbdda0ddb0e0e6800080663399ff0000bc8f8f4169e18b' +
  '4513fa8072f4a4602e8b57fff5eea0522dc0c0c087ceeb6a5acd708090fffafa' +
  '00ff7f4682b4d2b48c008080d8bfd8ff634740e0d0ee82eef5deb3fffffff5f5' +
  'f5ffff009acd32';

let table: Map<string, string> | undefined;

/**
 * The decoded keyword table: lowercase `*gray` names (plus `transparent`)
 * to hex digits without `#`. Built once, on first call.
 *
 * @internal Exported for tests; use {@link namedColorHex} for lookups.
 */
export function namedColorTable(): ReadonlyMap<string, string> {
  if (!table) {
    table = new Map([['transparent', '0000']]);
    let name = '';
    let at = 0;
    for (const [, shared, rest] of NAMES.matchAll(/(\d)([a-z]+)/g)) {
      name = name.slice(0, +shared) + rest;
      table.set(name, VALUES.slice(at, (at += 6)));
    }
  }
  return table;
}

/**
 * Hex digits (no `#`) for a lowercase CSS named color, or `undefined` when
 * `name` is not one.
 */
export function namedColorHex(name: string): string | undefined {
  return namedColorTable().get(name.replace('grey', 'gray'));
}
