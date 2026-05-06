# Ball Play QA

Use this checklist when validating the overlay Ball play MVP.

## Coverage

- Play opens inside the pet overlay and does not open the management panel.
- Ball is selectable from a compact Play picker.
- Ball can be dragged and released inside the bounded play area.
- Released ball falls under simple gravity and bounces against the play bounds.
- Pet moves toward the released ball and catches it.
- Catching the ball applies the normal Play care reward.
- X exits play mode and Escape also leaves transient play UI.

## Runtime Check

1. Run `npm.cmd run check`.
2. Start Electron with `npm.cmd run dev`.
3. Click the pet, choose Play, then choose Ball.
4. Drag the ball to the top or side of the play area and release it.
5. Confirm the ball falls, bounces, and stays within the bordered play area.
6. Confirm the pet chases the ball and catch count increments after contact.
7. Confirm happiness/affection improve after a catch.
8. Exit with X and confirm the pet returns to the normal overlay.
