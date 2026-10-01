# Stick Rider and helmets

`BikeLoader` creates a `StickRider` for the existing selected bike and parents its
group to `bodyGroup`. The rider solves its configured two-bone arm/leg pose in
that local space. Moving/rotating the parent preserves all contact points,
including during a wheelie or crash, without per-frame IK work or physics changes.
The rider has no head geometry: `HelmetAnchor` contains the chosen helmet GLB.

## Fit a rider to a bike

Edit `RIDER_CONFIGS` in `RiderConfig.ts`, using the GLB filename without `.glb`.
Coordinates are in the **game bike's `bodyGroup`**, after the GLB's import transform:
`x` is left/right (+X rider's left), `y` is up, `z` is forward. Units are meters.
They are not world coordinates or the GLB's quantized vertex coordinates.

- `seat` positions the pelvis.
- `leftHandlebar` / `rightHandlebar` position the hands.
- `leftFootPeg` / `rightFootPeg` position the feet.
- `torsoOffset` sets the spine's direction from the seat; `torsoLength` sets its length.
- `helmetAnchorOffset` positions the helmet relative to the neck, in torso-oriented axes.
- Bone lengths, `shoulderWidth`, `hipWidth` and `riderScale` override `RIDER_DEFAULTS`.
  `riderScale` scales the body dimensions, **not** the bike contact coordinates.

Initial anchors are manually estimated starting values. Fine-tune them with debug markers;
they are not claimed to be automatically extracted, exact attachment points.
An unreachable configured limb stretches/compresses visually to keep contact;
its debug contact marker turns orange. Adjust the target or bone lengths.

## Debug

During `npm run dev`, set `RIDER_DEBUG_ENABLED = true` in `RiderConfig.ts`
to enable markers in the game. The game HUD has no debug toggle.
Production builds do not construct debug markers.

Marker colors: yellow seat, green left grip, cyan right grip, pink left peg,
purple right peg, white helmet center. Debug markers render through the model.

For a stationary side/front inspection, open `/scripts/rider-visual-check.html`
on the development server. It supports bike/helmet selection, both sides, debug
markers and a wheelie pose. The original wheel-effect check page remains separate.

## Add or fit a helmet

Put `.glb` files in `src/assets/glbmodel/helmet/`. Vite discovers them automatically;
restart the development server after adding files if the option is not updated.
The helmet ID is the filename without `.glb` (`adv`, `gao_do`, `spartan`, `star_war`).
No bike GLB edits are needed.

In `HelmetConfig.ts`, add a `HELMET_TRANSFORMS[id]` entry with:

```ts
my_helmet: {
  position: [0, 0, 0],
  rotation: [0, 0, 0], // radians; +Z faces forward
  scale: 1,
  targetHeight: 0.28,
}
```

`HelmetLoader` centers the clone and fits its height to `targetHeight` (meters),
then applies `scale`, `rotation` and `position` relative to `HelmetAnchor`.
Adjust the per-helmet rotation if its exported forward axis differs.

Choose a helmet in the HUD's **HELMET** menu. `selectedHelmetId` is independent
React state in `GameCanvas.tsx`; call `setSelectedHelmetId('spartan')` to change it
in code. `DEFAULT_HELMET_ID` in `HelmetConfig.ts` chooses the initial helmet.
Switching bikes preserves this state and reattaches the selected helmet to the new
rider. Helmet loads are cached and request tokens discard stale load results.
While loading, the current helmet remains visible. A load failure is shown in the
HUD; choose another helmet to retry. If the folder is empty, the rider stays headless
until a helmet is supplied.

Run the numerical contact/IK checks with `node scripts/verify-rider.mjs`.
