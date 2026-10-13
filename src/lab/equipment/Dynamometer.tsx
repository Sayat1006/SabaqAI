// Серіппелі динамометр: жүк ілінгенде серіппе созылып, тілше шкала бойымен төмен түседі.

import { useMemo } from "react";
import * as THREE from "three";
import { DYN, type Vec3 } from "./shared";

const { PLATE_TOP, PLATE_H, ZERO, ROD } = DYN;

function scaleTexture(maxForce: number, k: number) {
  const W = 160;
  const H = Math.round((W * PLATE_H) / 0.04);
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fefce8";
  g.fillRect(0, 0, W, H);
  const yOf = (F: number) => ((PLATE_TOP - (ZERO - F / k)) / PLATE_H) * H;
  g.strokeStyle = "#1c1b2e";
  g.fillStyle = "#1c1b2e";
  g.textBaseline = "middle";
  g.font = "bold 46px Arial, sans-serif";
  for (let i = 0; i <= Math.round(maxForce * 10); i++) {
    const F = i / 10;
    const y = yOf(F);
    const major = i % 10 === 0;
    const half = i % 5 === 0;
    g.lineWidth = major ? 6 : 3;
    g.beginPath();
    g.moveTo(W - (major ? 70 : half ? 52 : 36), y);
    g.lineTo(W, y);
    g.stroke();
    if (major) g.fillText(String(F), 12, y);
  }
  g.font = "bold 40px Arial, sans-serif";
  g.fillText("Н", 12, H - 34);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function Dynamometer({ position, extension, maxForce = 5, k = 40 }: { position: Vec3; extension: number; maxForce?: number; k?: number }) {
  const tex = useMemo(() => scaleTexture(maxForce, k), [maxForce, k]);
  const helix = useMemo(() => {
    const turns = 16;
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= turns * 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      pts.push(new THREE.Vector3(0.007 * Math.cos(a), -i / (turns * 24), 0.007 * Math.sin(a)));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), turns * 24, 0.0011, 6, false);
  }, []);
  const pointerY = ZERO - extension;
  const springLen = pointerY - -0.012;

  return (
    <group position={position}>
      <mesh position={[0, 0.008, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.008, 0.0016, 8, 20]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.8} roughness={0.3} />
      </mesh>
      {/* Корпус және шкала */}
      <mesh position={[0, PLATE_TOP - PLATE_H / 2, -0.012]} castShadow>
        <boxGeometry args={[0.05, PLATE_H + 0.01, 0.006]} />
        <meshStandardMaterial color="#1d4ed8" roughness={0.5} />
      </mesh>
      <mesh position={[0.004, PLATE_TOP - PLATE_H / 2, -0.0085]}>
        <planeGeometry args={[0.04, PLATE_H]} />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      {/* Серіппе */}
      <mesh geometry={helix} position={[-0.012, -0.012, 0]} scale={[1, -springLen, 1]}>
        <meshStandardMaterial color="#d4d4d8" metalness={0.9} roughness={0.25} />
      </mesh>
      {/* Тілше */}
      <mesh position={[0.0, pointerY, -0.006]}>
        <boxGeometry args={[0.03, 0.0025, 0.002]} />
        <meshBasicMaterial color="#dc2626" />
      </mesh>
      <mesh position={[-0.012, pointerY - ROD / 2 + 0.005, 0]}>
        <cylinderGeometry args={[0.0013, 0.0013, ROD - 0.01, 8]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.2} />
      </mesh>
      {/* Ілгек */}
      <mesh position={[-0.012, pointerY - ROD + 0.006, 0]} rotation={[0, 0, Math.PI]}>
        <torusGeometry args={[0.006, 0.0013, 8, 16, Math.PI * 1.4]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.9} roughness={0.2} />
      </mesh>
    </group>
  );
}
