# TriangleParameters
## Visualizations for the parameter space of the self-reflecting triangular billiard

View the interactive version here:
https://culter.github.io/TriangleParameters/

This WebGL2 shader iterates the following piecewise-linear map over the triangle a>0, b>0, a+b<1:
<img width="872" height="184" alt="image" src="https://github.com/user-attachments/assets/867a2c42-9b3e-4e38-91b6-0b661a8a6267" />

The recommended "first-return" color mode adds pigment for each run of shears, where the darkness of the pigment depends on the number of shears,
and the hue depends on the number of area-doublings we're done so far.

The interactive explorer also supports exact symbolic cells:

- Hovering reports the finite `R`/`S` word at the selected cell depth.
- Clicking selects that cell, displays exact rational vertices, inequalities,
  area, and squared diameter, and zooms to it.
- Inside a selected cell, colors represent shortest positive first-return
  words. Clicking again selects the corresponding longer `wu` cell.
- The return search limit and relative/global return-word coloring are
  configurable. The Back button navigates through nested selections.

Cell geometry is computed in the browser with exact `BigInt` rational
arithmetic. WebGL receives floating-point half-planes only for rendering.

To run the browser tests, serve the repository and open `tests/` alongside
the main page. No package manager or build step is required.

Example:
<img width="2138" height="2398" alt="FirstReturn14" src="https://github.com/user-attachments/assets/baebb6a3-56f2-471b-be56-e4fe272ee2c0" />
<!-- <img width="1121" height="1186" alt="image" src="https://github.com/user-attachments/assets/104199b0-188e-4872-a17e-28418d383fe9" /> -->
