// Аналогты өлшеу құралы (амперметр / вольтметр): шкала, тілше және терминалдар.
// Тілше көрсетуге қарай біркелкі бұрылады; шкаладан асса — шетке «соғылады».

import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import { Label, type Vec3 } from "./LabScene";

const FACE_W = 0.13;
const FACE_H = 0.095;
const SWEEP = (100 * Math.PI) / 180;
const PIVOT_V = 0.16; // тілше осі — беттің астынан 16%

function dialTexture(letter: string, max: number, majors: number, unit: string) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 376;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fbfaf5";
  g.fillRect(0, 0, c.width, c.height);
  const cx = 256;
  const cy = c.height * (1 - PIVOT_V);
  const r = 250;
  g.strokeStyle = "#1c1b2e";
  g.lineWidth = 3;
  g.beginPath();
  g.arc(cx, cy, r - 40, -Math.PI / 2 - SWEEP / 2, -Math.PI / 2 + SWEEP / 2);
  g.stroke();
  const minors = majors * 5;
  for (let i = 0; i <= minors; i++) {
    const a = -Math.PI / 2 - SWEEP / 2 + (SWEEP * i) / minors;
    const big = i % 5 === 0;
    const r1 = r - 40;
    const r2 = r1 + (big ? 26 : 14);
    g.lineWidth = big ? 4 : 2;
    g.beginPath();
    g.moveTo(cx + r1 * Math.cos(a), cy + r1 * Math.sin(a));
    g.lineTo(cx + r2 * Math.cos(a), cy + r2 * Math.sin(a));
    g.stroke();
    if (big) {
      const v = (max * i) / minors;
      g.fillStyle = "#1c1b2e";
      g.font = "bold 30px Arial, sans-serif";
      g.textAlign = "center";
      g.textBaseline = "middle";
      const rt = r1 - 26;
      g.fillText(Number.isInteger(v) ? String(v) : v.toFixed(1), cx + rt * Math.cos(a), cy + rt * Math.sin(a));
    }
  }
  g.fillStyle = letter === "A" ? "#b91c1c" : "#1d4ed8";
  g.font = "bold 74px Georgia, serif";
  g.textAlign = "center";
  g.fillText(letter, cx, cy - 92);
  g.fillStyle = "#6b6680";
  g.font = "24px Arial, sans-serif";
  g.fillText(unit, cx, cy - 38);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export interface MeterProps {
  position: Vec3;
  kind: "ammeter" | "voltmeter";
  value: number;
  max: number;
  majors?: number;
  unit: string;
  /** Цифрлық көрсеткіш белгісі (null — көрсетпеу). */
  readout?: string | null;
  highlight?: boolean;
}

export function Meter({ position, kind, value, max, majors = 6, unit, readout, highlight }: MeterProps) {
  const letter = kind === "ammeter" ? "A" : "V";
  const tex = useMemo(() => dialTexture(letter, max, majors, unit), [letter, max, majors, unit]);
  const needle = useRef<THREE.Group>(null);
  const frac = Math.max(-0.04, Math.min(1.04, value / max));
  const target = SWEEP / 2 - SWEEP * frac;

  useFrame((_, dt) => {
    if (!needle.current) return;
    const z = needle.current.rotation.z;
    needle.current.rotation.z = z + (target - z) * Math.min(1, dt * 7);
  });

  const tilt = -0.45;
  return (
    <group position={position}>
      <mesh position={[0, 0.045, 0]} castShadow>
        <boxGeometry args={[0.16, 0.09, 0.12]} />
        <meshStandardMaterial color={highlight ? "#3a4b63" : "#20262f"} roughness={0.5} />
      </mesh>
      <group position={[0, 0.115, -0.005]} rotation={[tilt, 0, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.16, 0.11, 0.025]} />
          <meshStandardMaterial color="#20262f" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.0131]}>
          <planeGeometry args={[FACE_W, FACE_H]} />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
        <group ref={needle} position={[0, -FACE_H / 2 + FACE_H * PIVOT_V, 0.015]} rotation={[0, 0, SWEEP / 2]}>
          <mesh position={[0, 0.034, 0]}>
            <boxGeometry args={[0.0018, 0.068, 0.001]} />
            <meshBasicMaterial color="#111" />
          </mesh>
        </group>
        <mesh position={[0, -FACE_H / 2 + FACE_H * PIVOT_V, 0.016]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.005, 0.005, 0.002, 16]} />
          <meshStandardMaterial color="#444" />
        </mesh>
      </group>
      {readout !== null && readout !== undefined && (
        <Label position={[0, 0.215, 0]} mono>
          {readout}
        </Label>
      )}
    </group>
  );
}
