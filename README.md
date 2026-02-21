## Visualizations for the parameter space of the self-reflecting triangular billiard

View the interactive version here:
https://culter.github.io/TriangleParameters/

This WebGL2 shader iterates the following piecewise-linear map over the triangle _a_>0, _b_>0, _a_+_b_<1:
<img width="872" height="184" alt="image" src="https://github.com/user-attachments/assets/867a2c42-9b3e-4e38-91b6-0b661a8a6267" />

This map models the action of the self-reflecting billiard on a triangle,
where _a_(π/2) is the (internal) opposite angle, which is acute,
and (_b_+1)⁠(π/2) is the (internal) incident angle, which is obtuse.

The recommended "first-return" color mode adds pigment for each run of shears, where the darkness of the pigment depends on the number of shears,
and the hue depends on the number of area-doublings we're done so far.

Example:
<img width="2138" height="2398" alt="FirstReturn14" src="https://github.com/user-attachments/assets/baebb6a3-56f2-471b-be56-e4fe272ee2c0" />
<!-- <img width="1121" height="1186" alt="image" src="https://github.com/user-attachments/assets/104199b0-188e-4872-a17e-28418d383fe9" /> -->
