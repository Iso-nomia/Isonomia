/* app/(auth)/MetaBg.tsx */
import "./meta-bg.css";

export default function MetaBg() {
  return (
    <svg
      className="meta-bg justify-start "
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      focusable="false"
    >
      {/* --- gooey filter --- */}
      <defs>
        <filter id="goo" colorInterpolationFilters="sRGB">
          <feGaussianBlur
            stdDeviation="30"
            result="blur"
            {...{ in: "SourceGraphic" }}
          />
          <feColorMatrix
            type="matrix"
            in="blur"
            values="
              1 0 0 0 0
              0 1 0 0 0
              0 0 1 0 0
              0 0 0 22 -12"
            result="goo"
          />
          <feBlend in="SourceGraphic" in2="goo" />
        </filter>
      </defs>
      <defs>
        <filter id="gootwo" colorInterpolationFilters="sRGB">
          <feGaussianBlur
            stdDeviation="30"
            result="blurtwo"
            {...{ in: "SourceGraphictwo" }}
          />
          <feColorMatrix
            type="matrix"
            in="blurtwo"
            values="
            1 0 0 0 0
            0 1 0 0 0
            0 0 1 0 0
            0 0 0 22 -12"
            result="gootwo"
          />
          <feBlend in="SourceGraphictwo" in2="gootwo" />
        </filter>
      </defs>
            {/* --- layer 1 : accent blobs --- */}
            {/* <g filter="url(#goo)">
        <circle className="blob core" cx="37%" cy="60%"r="16%" />
        
        <circle className="blob n1 " cx="20%" cy="50%" r="15%"/>
        <circle className="blob n2" cx="60%" cy="46%" r="14%" />
        <circle className="blob n3" cx="40%" cy="40%" r="12%" />
      </g> */}
       
  {/* --- layer 1 : accent blobs --- */}
         <g filter="url(#gootwo)">
         <circle className="blobtwo core" cx="37%" cy="60%"r="16%" />
        
        <circle className="blobtwo n1 " cx="20%" cy="50%" r="15%"/>
        <circle className="blobtwo n2" cx="60%" cy="46%" r="14%" />
        <circle className="blobtwo n3" cx="40%" cy="40%" r="12%" />

         {/* NEW orbiters (3) */}
  <circle className="blob s1 hide-sm" cx="12%" cy="28%" r="3%"  />
  <circle className="blob s2"         cx="78%" cy="22%" r="4%"  />
  <circle className="blob s3 hide-sm" cx="84%" cy="10%" r="5%"  />
      </g>


      {/* <g filter="url(#gootwo)">
        <ellipse className="blob core" cx="57%" cy="60%"rx="7%" ry="8%" />
        
        <ellipse className="blob n1 " cx="50%" cy="70%" rx="7%" ry="7%" />
        <ellipse className="blob n2" cx="40%" cy="56%" rx="9%" ry="9% " />
        <circle className="blob n3" cx="50%" cy="50%" r="6%" />
      </g> */}

      {/* --- layer 2 : tinted halo (lighter colour, slower) --- */}
      
    </svg>
  );
}
