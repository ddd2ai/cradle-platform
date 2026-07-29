const NUTRIENT_PARTICLES = [
  { x: 8, y: 18, size: 2, depth: "far", duration: 34, delay: -3 },
  { x: 17, y: 64, size: 3, depth: "mid", duration: 41, delay: -13 },
  { x: 26, y: 34, size: 2, depth: "far", duration: 38, delay: -8 },
  { x: 34, y: 77, size: 4, depth: "near", duration: 29, delay: -18 },
  { x: 42, y: 22, size: 2, depth: "far", duration: 46, delay: -6 },
  { x: 49, y: 58, size: 3, depth: "mid", duration: 36, delay: -20 },
  { x: 56, y: 13, size: 2, depth: "far", duration: 44, delay: -11 },
  { x: 63, y: 71, size: 4, depth: "near", duration: 31, delay: -4 },
  { x: 70, y: 39, size: 3, depth: "mid", duration: 39, delay: -15 },
  { x: 78, y: 25, size: 2, depth: "far", duration: 43, delay: -22 },
  { x: 86, y: 67, size: 3, depth: "mid", duration: 35, delay: -9 },
  { x: 92, y: 46, size: 2, depth: "far", duration: 48, delay: -16 },
  { x: 13, y: 43, size: 4, depth: "near", duration: 32, delay: -24 },
  { x: 31, y: 12, size: 3, depth: "mid", duration: 37, delay: -5 },
  { x: 51, y: 83, size: 2, depth: "far", duration: 45, delay: -19 },
  { x: 74, y: 82, size: 4, depth: "near", duration: 30, delay: -2 },
];

const OXYGEN_BUBBLES = [
  { x: 4, size: 9, duration: 104, delay: -54 },
  { x: 11, size: 5, duration: 92, delay: -18 },
  { x: 21, size: 12, duration: 116, delay: -37 },
  { x: 29, size: 7, duration: 108, delay: -44 },
  { x: 37, size: 4, duration: 96, delay: -12 },
  { x: 47, size: 4, duration: 98, delay: -7 },
  { x: 55, size: 10, duration: 122, delay: -69 },
  { x: 66, size: 6, duration: 114, delay: -31 },
  { x: 73, size: 13, duration: 128, delay: -46 },
  { x: 84, size: 5, duration: 101, delay: -53 },
  { x: 91, size: 8, duration: 111, delay: -28 },
  { x: 96, size: 4, duration: 106, delay: -25 },
];

export function LivingMedium({ isFeeding = false }) {
  return (
    <div
      className={[
        "incubator-medium",
        isFeeding ? "is-feeding" : "",
      ].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <div className="incubator-medium__surface" />
      <div className="incubator-medium__ripples" />
      <div className="incubator-medium__flow" />
      <div className="incubator-medium__nutrients">
        {NUTRIENT_PARTICLES.map((particle, index) => (
          <span
            key={`nutrient-${index}`}
            className={`incubator-medium__nutrient is-${particle.depth}`}
            style={{
              "--nutrient-x": `${particle.x}%`,
              "--nutrient-y": `${particle.y}%`,
              "--nutrient-size": `${particle.size}px`,
              "--nutrient-duration": `${particle.duration}s`,
              "--nutrient-delay": `${particle.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="incubator-medium__bubbles">
        {OXYGEN_BUBBLES.map((bubble, index) => (
          <span
            key={`bubble-${index}`}
            className="incubator-medium__bubble"
            style={{
              "--bubble-x": `${bubble.x}%`,
              "--bubble-size": `${bubble.size}px`,
              "--bubble-duration": `${bubble.duration}s`,
              "--bubble-delay": `${bubble.delay}s`,
            }}
          />
        ))}
      </div>
      <div className="incubator-medium__feed-wave" />
    </div>
  );
}
