// helpers/slideVariants.ts
import { Variants, Transition } from 'framer-motion';
import type { GalleryAnimationStyle } from '../GalleryCarousel';
export const buildSlideVariants = (
  style: GalleryAnimationStyle,
  radius= 400,
  radiusZ = 500,
  radiusX = 400,
  angle  = 30,
): Variants => {
  switch (style) {
    /** EXISTING CYLINDRICAL “FILM STRIP” ************************************/
    case 'cylinder':
      const springtype: Transition = { type: 'spring', stiffness: 440, damping: 50, mass: .9 };

      return {
        enter: (dir: number) => ({
          rotateY: dir > 0 ?  angle/2 : -angle/2,
          x:       dir > 0 ?  radiusX*1 : -radiusX*1,
          z:      -radiusZ*.8,
          opacity: 0,
          
          scaleY:   0.9,
          scaleX: .3,

        //   transition: {
        //     type: spring,
        //     stiffness: 100,
        //     damping: 10,
        //     mass: 1,
        // },   
        transition: springtype  }),

        center: ({
          rotateY: 0,
          x: 0,
          z: 0,
          opacity: 1,
          scaleY:  1,
          scaleX: 1,
          transition: springtype  })
          ,

        exit: (dir: number) => ({
          rotateY: dir > 0 ? -angle : angle,
          x:       dir > 0 ? -radiusX*1.2 : radiusX*1.2,
          z:      -radiusZ,
          opacity: 0,
          scaleY:   0.9,
          scaleX: .3,
          transition: springtype  }),
      };
      
      // return {
      //   enter: (dir: number) => ({
      //     rotateY: dir > 0 ?  angle : -angle,
          
      //     x:       dir > 0 ?  radiusX : -radiusX,
      //     z:       -radiusZ,
      //     opacity: 0,
      //     scale:   1,
      //     transition: {translateZ:{duration:.25}, rotateY: {duration:.25}, opacity: { duration: 0.25 } },

      //   }),
      //   center: { rotateY: 0, x: 0, z: 0, opacity: 1, scale: 1 },
      //   exit:   (dir: number) => ({
      //     rotateY: dir > 0 ? -angle : angle,
      //     x:       dir > 0 ? -radiusX : radiusX,
      //     z:        -radiusZ,
      //     opacity: 0,
      //     scale:   1,

      //     transition: { translateZ:{duration:.25},translateX:{duration:.25}, rotateY: {duration:.25},opacity: { duration: 0.55 }},

      //   }),
      // };
        /** FLINGS TOWARDS SCREEN ************************************/
    case 'towardscreen':
      return {
        enter: (dir: number) => ({
          rotateY: dir > 0 ?  angle : -angle,
          x:       dir > 0 ?  radius : -radius,
          z:       -radius,
          opacity: 0.5,
          scale:   0.9,

        }),
        center: { rotateY: 0, x: 0, z: 0, opacity: 1, scale: 1 },
        exit:   (dir: number) => ({
          rotateY: dir > 0 ? -angle : angle,
          x:       dir > 0 ? -radius : radius,
          z:        radius,
          opacity: 0,
          scale:   0.5,
        }),
      };

    /** NEW  ➜  ROTATING CUBE ************************************************/
    /* A real cube needs every face mounted at once; to keep your
       memory‑efficient single‑image render we *fake* it: the outgoing face
       pivots 90 ° away while the incoming one pivots in. */
    case 'cube': {
      const depth = 400; // half the cube edge in px
      return {
        enter: (dir: number) => ({
          rotateY: dir > 0 ?  40 : 0,
          x:       dir > 0 ?  -depth : depth,
          scale: .75,
          opacity: 0.5,
          transition: { opacity: { duration: 0.5 } },
        }),
        center: { rotateY: 0, x: 0, opacity: 1, scale:1 },         

        exit: (dir: number) => ({
          rotateY: dir > 0 ? -40:  40,
          x:       dir > 0 ? depth :  -depth,
          opacity: 0.0,
          scale:.5,
          transition: { opacity: { duration: 0.25 } },
        }),
      };
    }

    /** NEW  ➜  PORTAL / HOLE (“falling” effect) *****************************/
    /* We scale down and fade while translating along Y & Z to simulate depth. */
    case 'portal': {
      const travel = 190;   // downward (positive) or upward (negative) px
      const zoom   = 0.2;   // end‑scale when fully “inside the hole”
      return {
        enter: (dir: number) => ({
          y: dir > 0 ? -travel :  travel,
          z: -travel,
          opacity: 0,
          scale: zoom,
        }),
        center: { y: 0, z: 0, opacity: 1, scale: 1 },
        exit: (dir: number) => ({
          y: dir > 0 ?  travel : -travel,
          z: travel,
          opacity: 0,
          scale: zoom,
        }),
      };
    }

    default:
      return {
        enter: (dir: number) => ({ x: dir > 0 ? 120 : -120, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir: number) => ({ x: dir > 0 ? -120 : 120, opacity: 0 }),
      };
    }
  }