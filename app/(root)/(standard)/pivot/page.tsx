"use client";

import { useEffect, useState, useMemo } from "react";
import generatePuzzle, { RING_LENGTHS } from "./pivotGenerator";
import { loadWords4 } from "./words4";
import { Button } from "@/components/ui/button";

// Dictionary of solution words is set when a puzzle loads
const COLS = RING_LENGTHS[0]; 
const RADII = [140, 108, 78, 52] as const;
type OffsetTuple = [number, number, number, number];

function rotateSteps(arr: string[], steps: number) {
  const len = arr.length;
  if (!len) return [];
  const k = ((steps % len) + len) % len; // normalize steps
  return [...arr.slice(k), ...arr.slice(0, k)];
}
/** index (0…len‑1) that `letterAt` ends up using */
function idxAt(
  ringLen : number,
  outerLen: number,
  iOuter  : number,
  oOuter  : number,
  oRing   : number
){
  const ang  = (iOuter - oOuter) * (360 / outerLen);
  const raw  =  ang / (360 / ringLen);
  return ((Math.round(raw - oRing) % ringLen) + ringLen) % ringLen;
}

function spokePoints(
  iOuter : number,
  offs   : number[]
){
  const outerLen = RING_LENGTHS[0];
  return RADII.map((radius, ring) => {
    const len   = RING_LENGTHS[ring];
    const idx   = idxAt(len, outerLen, iOuter, offs[0], offs[ring]);
    const angle = (idx + offs[ring]) * (360 / len) * Math.PI / 180;
    return [radius * Math.sin(angle), -radius * Math.cos(angle)];
  });
}
// function spokePoints(idx: number, offsets: number[]) {
//   const outerStep = 360 / RING_LENGTHS[0];
//   return RADII.map((radius, ring) => {
//     const len = RING_LENGTHS[ring];
//     const step = 360 / len;

//     const globalDeg =
//       idx * step -
//       offsets[0] * outerStep +
//       offsets[ring] * step;

//     const rad = (globalDeg * Math.PI) / 180;
//     return [radius * Math.sin(rad), -radius * Math.cos(rad)];
//   });
// }

/**
 * Letter that really sits on the same radial when the outer column is iOuter.
 * Works for any ring length.
 */
function letterAt(
  letters: string[],
  ringLen : number,
  outerLen: number,   // length of ring‑0
  iOuter  : number,   // column being tested
  oOuter  : number,   // offset of ring‑0
  oRing   : number    // offset of this ring
){
  /* angle (°) of the spoke relative to this ring’s 0‑index */
  const ang   = (iOuter - oOuter) * (360 / outerLen);
  const raw   =  ang / (360 / ringLen);   // ideal fractional index
  const index = Math.round(raw - oRing)   // apply this ring’s offset
                % ringLen;

  return letters[(index + ringLen) % ringLen];
}

function computeSpokes(
  r1:string[], r2:string[], r3:string[], r4:string[],
  [o1,o2,o3,o4]:number[]
){
  const len1 = r1.length, len2 = r2.length, len3 = r3.length, len4 = r4.length;

  return [...Array(len1)].map((_, i) =>
    letterAt(r1,len1,len1,i,o1,0  ) +   // 0 because ring‑0 already rotated
    letterAt(r2,len2,len1,i,o1,o2) +
    letterAt(r3,len3,len1,i,o1,o3) +
    letterAt(r4,len4,len1,i,o1,o4)
  );
}
function Ring({
  letters,
  radius,
  offset,
  speed,
}: {
  letters: string[];
  radius: number;
  offset: number;
  speed: number;
}) {
  const step = 360 / letters.length;
  const angle = offset * step;
  return (
    <g

    style={
        {
          "--angle": `${angle}deg`,
          transformOrigin: "center",
          transformBox: "fill-box",
          transform: "rotate(var(--angle))",
          transition: `transform ${speed}ms`,
          willChange: "transform",
        } as React.CSSProperties
      }
      className="transition-transform"
    >
      {letters.map((l, i) => {
        const a = (i * step * Math.PI) / 180;
        // const x = radius*.5 * Math.sin(a);
        // const y = -radius*.5 * Math.cos(a);
         const x = radius * Math.sin(a);
        const y =  -radius * Math.cos(a);
        return (
            <g
            key={i}
            style={{ transform: `translate(${x}px, ${y}px) rotate(calc(-1 * var(--angle)))` }}
           >
                    <circle cx={0} cy={0} r={10} fill="#fff" stroke="#64748b" strokeWidth={.6} filter="url(#dshadow)" />
           <text
             x={0}
             y={0}
             textAnchor="middle"
             dominantBaseline="middle"
             className="text-[.9rem] text-gray-800"
           >
             {l}
           </text>
          </g>
        );
      })}
    </g>
  );
}


export default function PivotPage() {

  const [r1, setR1] = useState<string[]>(Array(RING_LENGTHS[0]).fill("?"));
  const [r2, setR2] = useState<string[]>(Array(RING_LENGTHS[1]).fill("?"));
  const [r3, setR3] = useState<string[]>(Array(RING_LENGTHS[2]).fill("?"));
  const [r4, setR4] = useState<string[]>(Array(RING_LENGTHS[3]).fill("?"));
  const [dictionary, setDictionary] = useState<Set<string>>(new Set());
  const [targetWords, setTargetWords] = useState<string[]>([]);
  const [locked, setLocked]       = useState<boolean[]>(Array(COLS).fill(false));
  const [lockedWords, setLockedWords]  = useState<string[]>(Array(COLS).fill(""));
  const [par, setPar] = useState(0);
  const [solutionSet, setSolutionSet] = useState<Set<string>>(new Set());

  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  useEffect(() => {
    loadWords4().then((list) => setDictionary(new Set(list)));
  }, []);


  // const [r1, setR1] = useState<string[]>([
  //   "L",
  //   "S",
  //   "M",
  //   "O",
  //   "P",
  //   "T",
  //   "H",
  //   "N",
  // ]);
  // const [r2, setR2] = useState<string[]>([
  //   "I",
  //   "A",
  //   "L",
  //   "R",
  //   "O",
  //   "E",
  //   "A",
  //   "O",
  // ]);
  // const [r3, setR3] = useState<string[]>([
  //   "A",
  //   "N",
  //   "K",
  //   "O",
  //   "E",
  //   "R",
  //   "S",
  //   "M",    
  // ]);
  // const [r4, setR4] = useState<string[]>(["S","T","E","N","T","P","R","T"]);

    // ► (optional) offsets if you want a “Give up / show solution” button
 


  const [offset1, setOffset1] = useState(0);
  const [offset2, setOffset2] = useState(0);
  const [offset3, setOffset3] = useState(0);
  const [offset4, setOffset4] = useState(0);
  const [spins, setSpins] = useState(0);
  const SPIN_LIMIT = par * 4;
  const [speed, setSpeed] = useState(350);


  const offsets = useMemo(
    () => [offset1, offset2, offset3, offset4],
    [offset1, offset2, offset3, offset4]
  );

  const attemptRotate = (ring: number, dir: number) => {
    if (spins >= SPIN_LIMIT || solved) return;
    const next = [...offsets];
    next[ring] = (next[ring] + dir + RING_LENGTHS[ring]) % RING_LENGTHS[ring];
    const newSpokes = computeSpokes(r1, r2, r3, r4, next);
    // for (let i = 0; i < locked.length; i++) {
    //   if (locked[i] && newSpokes[i] !== lockedWords[i]) {
    //     return;
    //   }
    // }
    setSpeed(Math.abs(dir) * 50);
    const newLocked = [...locked];
    const newWords = [...lockedWords];
    let changed = false;
    for (let i = 0; i < newSpokes.length; i++) {
      if (!newLocked[i] && solutionSet.has(newSpokes[i])) {
        newLocked[i] = true;
        newWords[i] = newSpokes[i];
        changed = true;
      }
    }
    if (changed) {
      setLocked(newLocked);
      setLockedWords(newWords);
      if (focusIdx !== null && newLocked[focusIdx]) setFocusIdx(null);
    }
    switch (ring) {
      case 0:
        setOffset1(next[0]);
        break;
      case 1:
        setOffset2(next[1]);
        break;
      case 2:
        setOffset3(next[2]);
        break;
      case 3:
        setOffset4(next[3]);
        break;
    }
    setSpins(spins + 1);
  };

  const spokes = useMemo(
      () => computeSpokes(r1,r2,r3,r4,offsets),
      [r1,r2,r3,r4,offsets]);
  const valid = useMemo(
    () => spokes.map(w => solutionSet.has(w)),
      [spokes, solutionSet]
    );    const solved = locked.every(Boolean);

  const [solutionOffsets, setSolutionOffsets] =
    useState<OffsetTuple>([0, 0, 0, 0] as OffsetTuple);

  const newPuzzle = async () => {
    const { rings: [R1, R2, R3, R4], solutionOffsets, words, par, puzzleId } =
      await generatePuzzle();
    setR1(R1); setR2(R2); setR3(R3); setR4(R4);
    setSolutionOffsets(solutionOffsets);
    // setTargetWords(words);
     const solSet = new Set(words);
 setTargetWords(words);
 setSolutionSet(solSet);         // new state hook you add
//  setSolutionSet(new Set(words));  // <‑‑‑ add this line

    setPar(par);
    setLocked(Array(COLS).fill(false));
    setLockedWords(Array(COLS).fill(""));
    // reset offsets and spin count
    setOffset1(0); setOffset2(0); setOffset3(0); setOffset4(0);
    setSpins(0);
  };

  useEffect(() => { if (dictionary.size) newPuzzle(); }, [dictionary.size]);

  return (
    <main className=" flex flex-col items-center">
      <h1 className="text-[2rem] mt-[-3rem] text-black font-bold">Pivot</h1>
    
      <p>Par: {par} spins</p>
      <p>Spins: {spins}/{SPIN_LIMIT}</p>
      {spins >= SPIN_LIMIT && !solved && (
        <p className="text-red-700">Spin limit reached</p>
      )}
      {/* <p className="fixed p-2 border-white border-2 rounded-lg justify-center -left-[-16rem] bottom-[18rem] flex text-wrap max-w-[12rem] text-[1.0rem]">Rotate the outer, middle, inner, and core rings one step at a time with the ↺ / ↻ buttons. <br></br><br></br>
        When every vertical stack of letters—read outer → middle → inner → core—forms a real 4-letter word, you win. <br></br> <br></br>
        Try to finish with as few spins as possible.</p> */}
        <p
  className="absolute p-3 max-w-[14rem] text-[0.95rem] leading-snug rounded-lg border border-white justify-center -left-[-16rem] bottom-[12rem] bg-white/40 backdrop-blur-sm"
>
  <strong className="font-semibold">How to play</strong><br /><br />
  • Each ring holds the first, second, third&nbsp;or fourth letter of&nbsp;9
  hidden 4‑letter words.<br />
  • Click ↻ / ↺ to rotate one ring by a single step
  (outer, middle, inner, core).<br />
  • A column turns <span className="text-green-700 font-semibold">green</span> when it exactly matches one of
  the 9 target words &nbsp;– those letters are “locked”.<br />
  • Win by turning <em>all&nbsp;nine</em> columns green before you exceed
  <code className="px-1 bg-slate-200 rounded">{'4 × par'}</code> spins.<br /><br />
  Tip:&nbsp;start with the ring that changes the <em>most</em> letters – it
  gives the biggest clues.
</p>
      <div className="flex items-center gap-2">
      
      </div>
      <Button className="absolute flex z-1000 -right-[-70%] top-8 justify-center items-center" onClick={newPuzzle}>
        New Puzzle
      </Button>
    
      <svg width={430} height={430} viewBox="-160 -160 320 320" className="mx-auto">
        <defs>
          <filter id="dshadow" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity=".35" />
          </filter>
        </defs>

        <circle r={RADII[0]} className="fill-none stroke-slate-200 stroke-2" />
        <circle r={RADII[1]} className="fill-none stroke-slate-200 stroke-2" />
        <circle r={RADII[2]} className="fill-none stroke-slate-200 stroke-2" />
        <circle r={RADII[3]} className="fill-none stroke-slate-200 stroke-2" />
        <Ring letters={r1} radius={RADII[0]} offset={offset1} speed={speed} />
        <Ring letters={r2} radius={RADII[1]} offset={offset2} speed={speed} />
        <Ring letters={r3} radius={RADII[2]} offset={offset3} speed={speed} />
        <Ring letters={r4} radius={RADII[3]} offset={offset4} speed={speed} />

        {focusIdx !== null && (
   <polyline
     pointerEvents="none"
     strokeLinecap="round"
     points={spokePoints(focusIdx!, offsets)
               .map(([x,y]) => `${x},${y}`)
               .join(" ")}
     fill="none"
     stroke="#059669"
     strokeWidth={1.5}
     strokeDasharray="4 3"
   />
 )}
      </svg>
     
      <div className=" mt-[-0rem] space-y-2">
      <div className="flex gap-6 ">
        <div className="flex flex-col items-center gap-3">
        <Button
              variant={"outline"}
              className="likebutton bg-white bg-opacity-50 border-none outline-blue"
              disabled={spins >= SPIN_LIMIT || solved}
            onClick={() => attemptRotate(0, 1)}
          >
            Outer ↻
          </Button>
          <Button
          variant={"outline"}
          className="likebutton bg-white bg-opacity-50 border-none outline-blue"
            disabled={spins >= SPIN_LIMIT || solved}
            onClick={() => attemptRotate(0, -1)}
          >
            Outer ↺
          </Button>
      
        </div>
        <div className="flex flex-col items-center  gap-3">
        <Button
              variant={"outline"}
              className="likebutton bg-white bg-opacity-50 border-none outline-blue"
              disabled={spins >= SPIN_LIMIT || solved}
            onClick={() => attemptRotate(1, 1)}
          >
            Middle ↻
          </Button>
          <Button
              variant={"outline"}
              className="likebutton bg-white bg-opacity-50 border-none outline-blue"
              disabled={spins >= SPIN_LIMIT || solved}
            onClick={() => attemptRotate(1, -1)}
          >
            Middle ↺
          </Button>
     
        </div>
        <div className="flex flex-col items-center gap-3">
        <Button
              variant={"outline"}
              className="likebutton bg-white bg-opacity-50 border-none outline-blue"
              disabled={spins >= SPIN_LIMIT || solved}
            onClick={() => attemptRotate(2, 1)}
          >
            Inner ↻
          </Button>
          <Button
              variant={"outline"}
              className="likebutton bg-white bg-opacity-50 border-none outline-blue"
              disabled={spins >= SPIN_LIMIT || solved}
            onClick={() => attemptRotate(2, -1)}
          >
            Inner ↺
          </Button>
    
        </div>
        <div className="flex flex-col items-center gap-3">
        <Button
              variant={"outline"}
              className="likebutton bg-white bg-opacity-50 border-none outline-blue"
              disabled={spins >= SPIN_LIMIT || solved}
            onClick={() => attemptRotate(3, 1)}
          >
            Core ↻
          </Button>
          <Button
              variant={"outline"}
              className="likebutton bg-white bg-opacity-50 border-none outline-blue"
              disabled={spins >= SPIN_LIMIT || solved}
            onClick={() => attemptRotate(3, -1)}
          >
            Core ↺
          </Button>
   
        </div>
        </div>
      </div>
     
<ul className="py-8 grid grid-cols-3 grid-rows-3 gap-4 text-[1rem]">
        
        {spokes.map((w, i) => (
            
          <li   key={i}
          onMouseEnter={() => setFocusIdx(i)}
          onMouseLeave={() => setFocusIdx(null)}
          className={valid[i] ? "text-green-700" : "text-gray-700"}
        >
          {w}
          </li>
        ))}
      </ul>
      {solved && <p className="fixed p-2 border-white border-2 rounded-lg justify-center -right-[-16rem] bottom-[28rem] text-block text-[2rem] mt-[-1rem]">Victory in {spins} spins!</p>}
     
    </main>
  );
}
