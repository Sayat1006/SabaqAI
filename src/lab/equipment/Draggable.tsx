// Drag & Drop: құралды тышқанмен (немесе саусақпен) көлденең жазықтық бойымен жылжыту.
// Сүйреу кезінде камера айналмайды; сызғыш белсенді болса, сүйреу өшеді.

import { useThree, type ThreeEvent } from "@react-three/fiber";
import { useRef, useState, type ReactNode } from "react";
import * as THREE from "three";
import { useLabTool, type Vec3 } from "./shared";

export interface DraggableProps {
  position: Vec3;
  onChange: (p: Vec3) => void;
  /** Жіберген кезде (мыс. ұяға «жабысу» үшін). */
  onDrop?: (p: Vec3) => void;
  /** Тек бір ось бойымен жылжу (оптикалық скамья). */
  axis?: "x" | "z";
  bounds?: { x?: [number, number]; z?: [number, number] };
  /** Сүйреп жатқанда объектіні сәл көтеру. */
  lift?: number;
  disabled?: boolean;
  children: ReactNode;
}

type Controls = { enabled: boolean } | null;

const clamp = (v: number, r?: [number, number]) => (r ? Math.min(r[1], Math.max(r[0], v)) : v);

export function Draggable({ position, onChange, onDrop, axis, bounds, lift = 0.02, disabled, children }: DraggableProps) {
  const get = useThree((s) => s.get);
  const setOrbit = (enabled: boolean) => {
    const c = get().controls as unknown as Controls;
    if (c) c.enabled = enabled;
  };
  const { rulerActive } = useLabTool();
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0));
  const offset = useRef(new THREE.Vector3());
  const hit = useRef(new THREE.Vector3());
  const [dragging, setDragging] = useState(false);
  const last = useRef<Vec3>(position);
  const off = disabled || rulerActive;

  function down(e: ThreeEvent<PointerEvent>) {
    if (off) return;
    e.stopPropagation();
    (e.target as unknown as Element).setPointerCapture(e.pointerId);
    plane.current.constant = -position[1];
    if (!e.ray.intersectPlane(plane.current, hit.current)) return;
    offset.current.set(position[0] - hit.current.x, 0, position[2] - hit.current.z);
    setOrbit(false);
    last.current = position;
    setDragging(true);
    document.body.style.cursor = "grabbing";
  }

  function move(e: ThreeEvent<PointerEvent>) {
    if (!dragging) return;
    e.stopPropagation();
    if (!e.ray.intersectPlane(plane.current, hit.current)) return;
    let x = hit.current.x + offset.current.x;
    let z = hit.current.z + offset.current.z;
    if (axis === "x") z = position[2];
    if (axis === "z") x = position[0];
    const p: Vec3 = [clamp(x, bounds?.x), position[1], clamp(z, bounds?.z)];
    last.current = p;
    onChange(p);
  }

  function up(e: ThreeEvent<PointerEvent>) {
    if (!dragging) return;
    e.stopPropagation();
    (e.target as unknown as Element).releasePointerCapture(e.pointerId);
    setOrbit(true);
    setDragging(false);
    document.body.style.cursor = "grab";
    onDrop?.(last.current);
  }

  return (
    <group
      position={[position[0], position[1] + (dragging ? lift : 0), position[2]]}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerOver={(e) => {
        if (off) return;
        e.stopPropagation();
        document.body.style.cursor = "grab";
      }}
      onPointerOut={() => {
        if (!dragging) document.body.style.cursor = "";
      }}
    >
      {children}
    </group>
  );
}
