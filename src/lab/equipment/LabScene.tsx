// 3D сахна негізі: камера, жарық, тор, зертханалық үстел және сызғыш құралы.
// Барлық зертханалық жұмыстар осы сахнаның ішіне өз құралдарын қояды.

import { OrbitControls } from "@react-three/drei";
import { Canvas, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import * as THREE from "three";
import { LabToolContext, type Vec3 } from "./shared";

export type { Vec3 };

interface LabelProps {
  position: Vec3;
  children: string | number | (string | number)[];
  tone?: "dark" | "light" | "accent";
  /** Мәтін түсі (әдепкі — фонға қарай). */
  color?: string;
  /** Белгі биіктігі: экранда тұрақты (камера қашықтығына тәуелсіз), ≈ кадр биіктігінің size·1.2 үлесі. */
  size?: number;
  mono?: boolean;
}

export interface LabSceneProps {
  children: ReactNode;
  camera?: Vec3;
  target?: Vec3;
  rulerActive?: boolean;
  /** Үстел өлшемі (м). */
  table?: [number, number];
  className?: string;
}

/** Зертханалық үстел: үстіңгі беті y = 0 жазықтығында. */
export function LabTable({ size = [1.6, 0.9] }: { size?: [number, number] }) {
  const [w, d] = size;
  const legs: Vec3[] = [
    [-w / 2 + 0.06, -0.42, -d / 2 + 0.06],
    [w / 2 - 0.06, -0.42, -d / 2 + 0.06],
    [-w / 2 + 0.06, -0.42, d / 2 - 0.06],
    [w / 2 - 0.06, -0.42, d / 2 - 0.06],
  ];
  return (
    <group>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <boxGeometry args={[w, 0.04, d]} />
        <meshStandardMaterial color="#d9c7a7" roughness={0.75} />
      </mesh>
      <mesh position={[0, -0.0005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[w - 0.04, d - 0.04]} />
        <meshStandardMaterial color="#2f3b45" roughness={0.9} />
      </mesh>
      {legs.map((p, i) => (
        <mesh key={i} position={p} castShadow>
          <boxGeometry args={[0.05, 0.8, 0.05]} />
          <meshStandardMaterial color="#6b6f7a" metalness={0.4} roughness={0.5} />
        </mesh>
      ))}
    </group>
  );
}

/** Шағын мәтін белгісі: canvas текстурасы бар спрайт (DOM-сыз — толық экранда да, тез де жұмыс істейді). */
export function Label({ position, children, tone = "dark", color, size = 0.03, mono = false }: LabelProps) {
  const text = (Array.isArray(children) ? children.join("") : String(children)).trim();
  const { tex, aspect } = useMemo(() => {
    const c = document.createElement("canvas");
    const g = c.getContext("2d")!;
    const font = `bold 44px ${mono ? "ui-monospace, Menlo, monospace" : "Arial, sans-serif"}`;
    g.font = font;
    const w = Math.ceil(g.measureText(text).width) + 36;
    c.width = w;
    c.height = 64;
    const bg = { dark: "rgba(18,17,32,0.88)", light: "rgba(255,255,255,0.94)", accent: "#fbbf24" }[tone];
    g.fillStyle = bg;
    g.beginPath();
    g.roundRect(0, 0, w, 64, 14);
    g.fill();
    g.font = font;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = color ?? (tone === "dark" ? "#ffffff" : "#121120");
    g.fillText(text, w / 2, 34);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { tex: t, aspect: w / 64 };
  }, [text, tone, color, mono]);
  useEffect(() => () => tex.dispose(), [tex]);
  return (
    <sprite position={position} scale={[size * aspect, size, 1]} renderOrder={10}>
      <spriteMaterial map={tex} sizeAttenuation={false} depthTest={false} depthWrite={false} transparent toneMapped={false} />
    </sprite>
  );
}

/** Күш векторы: цилиндр + конус. */
export function Arrow({ from, dir, length, color, label }: { from: Vec3; dir: Vec3; length: number; color: string; label?: string }) {
  if (length < 1e-4) return null;
  const v = new THREE.Vector3(...dir).normalize();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v);
  const head = Math.min(0.04, length * 0.4);
  const shaft = length - head;
  const end: Vec3 = [from[0] + v.x * length, from[1] + v.y * length, from[2] + v.z * length];
  return (
    <group>
      <group position={from} quaternion={q}>
        <mesh position={[0, shaft / 2, 0]}>
          <cylinderGeometry args={[0.005, 0.005, shaft, 8]} />
          <meshBasicMaterial color={color} />
        </mesh>
        <mesh position={[0, shaft + head / 2, 0]}>
          <coneGeometry args={[0.015, head, 12]} />
          <meshBasicMaterial color={color} />
        </mesh>
      </group>
      {label && (
        <Label position={[end[0] + v.x * 0.03, end[1] + v.y * 0.03, end[2] + v.z * 0.03]} tone="light" color={color}>
          {label}
        </Label>
      )}
    </group>
  );
}

/**
 * 3D сызғыш: құрал белсенді болғанда кез келген бетті екі рет басып, нүктелер арасындағы қашықтықты өлшейді.
 * Сахнадағы барлық объектілердің click оқиғасы осы топқа көтеріледі.
 */
function RulerLayer({ active, children }: { active: boolean; children: ReactNode }) {
  const [pts, setPts] = useState<THREE.Vector3[]>([]);

  function onClick(e: ThreeEvent<MouseEvent>) {
    if (!active) return;
    e.stopPropagation();
    const p = e.point.clone();
    setPts((prev) => (prev.length >= 2 ? [p] : [...prev, p]));
  }

  const shown = active ? pts : [];
  const dist = shown.length === 2 ? shown[0].distanceTo(shown[1]) : 0;
  const mid = shown.length === 2 ? shown[0].clone().add(shown[1]).multiplyScalar(0.5) : null;
  const dir = shown.length === 2 ? shown[1].clone().sub(shown[0]) : null;

  return (
    <group onClick={onClick}>
      {children}
      {shown.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.008, 16, 16]} />
          <meshBasicMaterial color="#facc15" />
        </mesh>
      ))}
      {mid && dir && (
        <>
          <mesh position={mid} quaternion={new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize())}>
            <cylinderGeometry args={[0.003, 0.003, dist, 8]} />
            <meshBasicMaterial color="#facc15" />
          </mesh>
          <Label position={[mid.x, mid.y + 0.04, mid.z]} tone="accent">
            {(dist * 100).toFixed(1)} см
          </Label>
        </>
      )}
    </group>
  );
}

/** Canvas + жарық + үстел + камера басқаруы. */
export function LabScene({ children, camera = [0, 0.75, 1.15], target = [0, 0.1, 0], rulerActive = false, table, className = "" }: LabSceneProps) {
  return (
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: camera, fov: 45, near: 0.01, far: 50 }}
      className={className}
      style={{ cursor: rulerActive ? "crosshair" : undefined, touchAction: "none" }}
    >
      <color attach="background" args={["#1a2230"]} />
      <hemisphereLight args={["#f6efe2", "#2b3240", 0.8]} />
      <directionalLight position={[1.5, 2.5, 1.5]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-2, 1.5, -1]} intensity={0.35} />
      <gridHelper args={[8, 32, "#3a4656", "#283240"]} position={[0, -0.82, 0]} />
      <LabToolContext.Provider value={{ rulerActive }}>
        <RulerLayer active={rulerActive}>
          <LabTable size={table} />
          {children}
        </RulerLayer>
      </LabToolContext.Provider>
      <OrbitControls makeDefault target={target} enableDamping minDistance={0.3} maxDistance={4} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  );
}
