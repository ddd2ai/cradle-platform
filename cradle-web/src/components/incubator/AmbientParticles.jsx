import { INCUBATOR_PARTICLES } from "../../constants/incubatorVisuals";

export function AmbientParticles() {
  return (
    <div className="ambient-particles" aria-hidden="true">
      {INCUBATOR_PARTICLES.map((particle, index) => (
        <span
          key={`${particle.x}-${particle.y}-${index}`}
          className={`ambient-particle ${particle.size >= 4 ? "is-bubble" : ""}`}
          style={{
            "--particle-x": `${particle.x}%`,
            "--particle-y": `${particle.y}%`,
            "--particle-size": `${particle.size}px`,
            "--particle-duration": `${particle.duration}s`,
            "--particle-delay": `${particle.delay}s`,
            "--particle-opacity": particle.opacity,
          }}
        />
      ))}
    </div>
  );
}

