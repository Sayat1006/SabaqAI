// Электр тізбегінің құралдары: қысқыш (терминал), сым, ток көзі, резистор, ұстағыш, шам, кілт.

import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { Label, type Vec3 } from "./LabScene";

/* ───────── Қысқыш ───────── */

export interface TerminalProps {
  position: Vec3;
  polarity?: "+" | "-" | null;
  selected?: boolean;
  onClick?: () => void;
}

export function Terminal({ position, polarity = null, selected, onClick }: TerminalProps) {
  const [hover, setHover] = useState(false);
  const ring = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (ring.current) ring.current.scale.setScalar(selected ? 1 + 0.25 * Math.sin(clock.elapsedTime * 8) : 1);
  });
  const color = polarity === "+" ? "#dc2626" : polarity === "-" ? "#111827" : "#a8a29e";
  return (
    <group position={position}>
      <mesh position={[0, -0.008, 0]}>
        <cylinderGeometry args={[0.006, 0.008, 0.016, 12]} />
        <meshStandardMaterial color="#c9a227" metalness={0.8} roughness={0.3} />
      </mesh>
      <mesh
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          onClick?.();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
        scale={hover ? 1.3 : 1}
      >
        <sphereGeometry args={[0.011, 16, 16]} />
        <meshStandardMaterial color={color} emissive={selected ? "#facc15" : "#000"} emissiveIntensity={selected ? 0.8 : 0} roughness={0.4} />
      </mesh>
      {selected && (
        <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.016, 0.021, 24]} />
          <meshBasicMaterial color="#facc15" side={THREE.DoubleSide} />
        </mesh>
      )}
      {polarity && (
        <Label position={[0, 0.03, 0]} tone="light" size={0.024} color={polarity === "+" ? "#dc2626" : "#111827"}>
          {polarity === "+" ? "+" : "−"}
        </Label>
      )}
    </group>
  );
}

/* ───────── Сым ───────── */

export function Wire({ from, to, color = "#ef4444", onClick }: { from: Vec3; to: Vec3; color?: string; onClick?: () => void }) {
  const [hover, setHover] = useState(false);
  const curve = useMemo(() => {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const len = a.distanceTo(b);
    const up = Math.min(0.12, 0.03 + len * 0.18);
    const mid = a.clone().lerp(b, 0.5);
    mid.y = Math.max(a.y, b.y) + up;
    return new THREE.CatmullRomCurve3([a, a.clone().setY(a.y + up * 0.5), mid, b.clone().setY(b.y + up * 0.5), b]);
  }, [from, to]);
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 48, 0.0035, 8, false), [curve]);
  return (
    <mesh
      geometry={geo}
      castShadow
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHover(true);
        document.body.style.cursor = "pointer";
      }}
      onPointerOut={() => {
        setHover(false);
        document.body.style.cursor = "";
      }}
    >
      <meshStandardMaterial color={hover ? "#facc15" : color} roughness={0.45} />
    </mesh>
  );
}

/* ───────── Реттелетін ток көзі ───────── */

export function PowerSupply({ position, voltage, on }: { position: Vec3; voltage: number; on: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.06, 0]} castShadow>
        <boxGeometry args={[0.22, 0.12, 0.15]} />
        <meshStandardMaterial color="#e7e5e4" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.085, 0.0755]}>
        <planeGeometry args={[0.1, 0.035]} />
        <meshBasicMaterial color={on ? "#052e16" : "#111"} />
      </mesh>
      <mesh position={[0.075, 0.075, 0.08]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.018, 0.018, 0.012, 24]} />
        <meshStandardMaterial color="#334155" />
      </mesh>
      <mesh position={[0.075, 0.075, 0.0865]} rotation={[0, 0, -((voltage / 12) * 270 - 135) * (Math.PI / 180)]}>
        <boxGeometry args={[0.003, 0.016, 0.002]} />
        <meshBasicMaterial color="#fff" />
      </mesh>
      <Label position={[0, 0.085, 0.09]} tone="dark" color="#6ee7b7" mono>
        {voltage.toFixed(1)} V
      </Label>
    </group>
  );
}

/* ───────── Резистор ───────── */

const BAND: Record<number, string[]> = {
  2: ["#dc2626", "#000", "#d4af37"],
  5: ["#16a34a", "#000", "#d4af37"],
  10: ["#92400e", "#000", "#b45309"],
};

export function Resistor({ ohms, highlight }: { ohms: number; highlight?: boolean }) {
  const bands = BAND[ohms] ?? ["#555", "#555", "#555"];
  return (
    <group>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.02, 0]} castShadow>
        <cylinderGeometry args={[0.0013, 0.0013, 0.12, 8]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
      </mesh>
      <mesh rotation={[0, 0, Math.PI / 2]} position={[0, 0.02, 0]} castShadow>
        <capsuleGeometry args={[0.011, 0.04, 6, 16]} />
        <meshStandardMaterial color={highlight ? "#fde68a" : "#e8d3a9"} roughness={0.6} />
      </mesh>
      {bands.map((c, i) => (
        <mesh key={i} rotation={[0, 0, Math.PI / 2]} position={[-0.012 + i * 0.01, 0.02, 0]}>
          <cylinderGeometry args={[0.0115, 0.0115, 0.004, 16]} />
          <meshStandardMaterial color={c} />
        </mesh>
      ))}
      <Label position={[0, 0.055, 0]} tone="light">
        {ohms} Ом
      </Label>
    </group>
  );
}

/** Резистор ұстағышы (тізбектегі «ұя»). */
export function ResistorHolder({ position, filled }: { position: Vec3; filled: boolean }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.006, 0]} receiveShadow>
        <boxGeometry args={[0.16, 0.012, 0.05]} />
        <meshStandardMaterial color="#44403c" roughness={0.8} />
      </mesh>
      {!filled && (
        <mesh position={[0, 0.0125, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.09, 0.03]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.35} />
        </mesh>
      )}
    </group>
  );
}

/* ───────── Шам ───────── */

/** brightness 0…1 — шамның жарқырауы (қуатқа пропорционал). */
export function Bulb({ position, brightness }: { position: Vec3; brightness: number }) {
  const b = Math.max(0, Math.min(1, brightness));
  const glass = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    if (glass.current) glass.current.emissiveIntensity = b * (2.2 + 0.08 * Math.sin(clock.elapsedTime * 50));
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.006, 0]}>
        <boxGeometry args={[0.1, 0.012, 0.06]} />
        <meshStandardMaterial color="#44403c" />
      </mesh>
      <mesh position={[0, 0.03, 0]} castShadow>
        <cylinderGeometry args={[0.014, 0.016, 0.035, 20]} />
        <meshStandardMaterial color="#a8a29e" metalness={0.7} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.07, 0]}>
        <sphereGeometry args={[0.026, 32, 32]} />
        <meshStandardMaterial ref={glass} color={b > 0.02 ? "#fff7d6" : "#e5e7eb"} emissive="#ffcf5c" emissiveIntensity={0} transparent opacity={0.85} roughness={0.1} />
      </mesh>
      <mesh position={[0, 0.068, 0]}>
        <torusGeometry args={[0.007, 0.0012, 8, 16]} />
        <meshBasicMaterial color={b > 0.02 ? "#fff3b0" : "#6b7280"} />
      </mesh>
      <pointLight position={[0, 0.08, 0]} color="#ffcf5c" intensity={b * 1.2} distance={0.8} decay={2} />
    </group>
  );
}

/* ───────── Кілт ───────── */

export function Switch({ position, closed, onToggle }: { position: Vec3; closed: boolean; onToggle: () => void }) {
  const lever = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    if (!lever.current) return;
    const target = closed ? 0 : -0.7;
    lever.current.rotation.z += (target - lever.current.rotation.z) * Math.min(1, dt * 12);
  });
  return (
    <group position={position}>
      <mesh position={[0, 0.006, 0]} receiveShadow>
        <boxGeometry args={[0.13, 0.012, 0.05]} />
        <meshStandardMaterial color="#57534e" />
      </mesh>
      <group
        ref={lever}
        position={[-0.045, 0.024, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => (document.body.style.cursor = "")}
      >
        <mesh position={[0.045, 0, 0]}>
          <boxGeometry args={[0.09, 0.005, 0.012]} />
          <meshStandardMaterial color="#d6d3d1" metalness={0.8} roughness={0.25} />
        </mesh>
        <mesh position={[0.09, 0.012, 0]}>
          <sphereGeometry args={[0.009, 16, 16]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </group>
      <Label position={[0, 0.07, 0]} tone={closed ? "accent" : "light"}>
        {closed ? "ON" : "OFF"}
      </Label>
    </group>
  );
}
