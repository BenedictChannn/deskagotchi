# Ball Play QA

Use this checklist when validating the overlay Ball play MVP.

## Coverage

- Play expands the transparent pet overlay to the current monitor work area and does not open the management panel.
- Ball is selectable from a compact Play picker.
- Ball can be dragged and released anywhere in the monitor play area.
- Released ball falls under simple gravity and bounces against the monitor edges.
- Pet moves toward the released ball and catches it.
- Catching the ball applies the normal Play care reward.
- No bordered or tinted stage is drawn around the play area.
- X exits play mode and Escape restores the normal small pet overlay.

## Runtime Check

1. Run `npm.cmd run check`.
2. Start Electron with `npm.cmd run dev`.
3. Click the pet, choose Play, then choose Ball.
4. Confirm the transparent overlay expands across the current monitor work area.
5. Drag the ball toward the top or side of the monitor and release it.
6. Confirm the ball falls, bounces, and stays within the visible monitor area.
7. Confirm there is no border or tinted panel around the play area.
8. Confirm the pet chases the ball and catch count increments after contact.
9. Confirm happiness/affection improve after a catch.
10. Exit with X and confirm the pet returns to the normal small overlay.
