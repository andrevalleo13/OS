"use client";

import { Canvas, useFrame, ThreeEvent, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useRef, useState, useMemo, useEffect, Suspense } from "react";
import * as THREE from "three";
import gsap from "gsap";
import {
  MUSCLE_GROUPS,
  STRUCTURAL_PARTS,
  type MusclePartDef,
} from "./MuscleData";

// ─────────────────────────────────────────────
// GLSL Shaders
// ─────────────────────────────────────────────

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vViewPosition = -mvPos.xyz;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const muscleFragShader = /* glsl */ `
  uniform float uTime;
  uniform float uHover;
  uniform float uSelected;
  uniform vec3 uAccent;

  varying vec3 vNormal;
  varying vec3 vViewPosition;

  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.0); // Sharper fresnel

    // Dark sleek base
    vec3 base = vec3(0.02, 0.02, 0.025);
    vec3 edge = vec3(0.12, 0.12, 0.15);
    vec3 color = mix(base, edge, fresnel * 0.8);

    // Holographic scanlines moving upwards
    float scanline = sin(vViewPosition.y * 80.0 - uTime * 6.0) * 0.5 + 0.5;
    float pulse = 0.5 + 0.5 * sin(uTime * 3.0);

    // Extremely intense glowing rim for hovered
    vec3 hoverGlow = uAccent * fresnel * 3.0 * uHover;
    // Solid energy core for selected
    vec3 selectGlow = uAccent * (fresnel + 0.5) * 1.5 * uSelected;
    
    // Mix scanlines specifically into the glow
    color += hoverGlow + (uAccent * scanline * 0.5 * uHover);
    color += selectGlow;
    
    // Add a tiny bit of ambient pulse if selected
    color += uAccent * uSelected * pulse * 0.2;

    gl_FragColor = vec4(color, 1.0);
  }
`;

const structuralFragShader = /* glsl */ `
  uniform float uTime;
  varying vec3 vNormal;
  varying vec3 vViewPosition;
  void main() {
    vec3 viewDir = normalize(vViewPosition);
    float fresnel = pow(1.0 - max(dot(viewDir, vNormal), 0.0), 2.5);
    vec3 base = vec3(0.03, 0.03, 0.035);
    vec3 edge = vec3(0.08, 0.08, 0.1);
    vec3 color = mix(base, edge, fresnel * 0.5);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// ─────────────────────────────────────────────
// Procedural Geometry (Fallback)
// ─────────────────────────────────────────────

function PartGeometry({ type, args }: { type: string; args: number[] }) {
  switch (type) {
    case "sphere": return <sphereGeometry args={args as [number, number, number]} />;
    case "capsule": return <capsuleGeometry args={args as [number, number, number, number]} />;
    case "box": return <boxGeometry args={args as [number, number, number]} />;
    case "cylinder": return <cylinderGeometry args={args as [number, number, number, number]} />;
    default: return <sphereGeometry args={[0.05, 16, 16]} />;
  }
}

function MusclePiece({ part, isHovered, isSelected, onClick, onPointerOver, onPointerOut }: any) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uHover: { value: 0 },
      uSelected: { value: 0 },
      uAccent: { value: new THREE.Color("#ffffff") },
      uHitboxMode: { value: 0.0 }
    }),
    []
  );

  useFrame((state) => {
    if (matRef.current) {
      matRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <mesh
      position={part.position}
      rotation={part.rotation || [0, 0, 0]}
      scale={part.scale || [1, 1, 1]}
      onClick={onClick}
      onPointerOver={onPointerOver}
      onPointerOut={onPointerOut}
    >
      <PartGeometry type={part.type} args={part.args} />
      <shaderMaterial 
        ref={matRef} 
        uniforms={uniforms} 
        vertexShader={vertexShader} 
        fragmentShader={muscleFragShader} 
        transparent={true}
        blending={THREE.NormalBlending}
        depthWrite={true}
        depthTest={true}
      />
    </mesh>
  );
}

function StructuralPiece({ part }: { part: MusclePartDef }) {
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);
  useFrame((state) => { if (matRef.current) matRef.current.uniforms.uTime.value = state.clock.elapsedTime; });
  return (
    <mesh position={part.position} rotation={part.rotation || [0, 0, 0]} scale={part.scale || [1, 1, 1]}>
      <PartGeometry type={part.type} args={part.args} />
      <shaderMaterial ref={matRef} uniforms={uniforms} vertexShader={vertexShader} fragmentShader={structuralFragShader} />
    </mesh>
  );
}

// ─────────────────────────────────────────────
// Realistic GLB Body Component (Target)
// ─────────────────────────────────────────────

function FallbackProceduralBody({ onSelect, selectedId, targetRotation, onHover }: any) {
  const groupRef = useRef<THREE.Group>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation, 0.04);
    }
  });

  return (
    <group ref={groupRef} position={[0, -0.1, 0]}>
      {STRUCTURAL_PARTS.map((part, i) => <StructuralPiece key={`s-${i}`} part={part} />)}
      {MUSCLE_GROUPS.map((group) =>
        group.parts.map((part, pi) => (
          <MusclePiece
            key={`${group.id}-${pi}`}
            part={part}
            isHovered={hoveredId === group.id}
            isSelected={selectedId === group.id}
            onPointerOver={(e: any) => { 
              e.stopPropagation(); 
              setHoveredId(group.id); 
              onHover(group.id); 
              onSelect(group.id); // Trigger camera zoom and panel on hover!
              document.body.style.cursor = "pointer"; 
            }}
            onPointerOut={() => { 
              setHoveredId(null); 
              onHover(null); 
              document.body.style.cursor = "auto"; 
            }}
            onClick={(e: any) => { e.stopPropagation(); }}
          />
        ))
      )}
    </group>
  );
}

// ─────────────────────────────────────────────
// Environment / Particles
// ─────────────────────────────────────────────

function FloatingParticles() {
  const count = 80;
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 6;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.012;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.008) * 0.08;
    }
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.01} color="#444" transparent opacity={0.35} sizeAttenuation />
    </points>
  );
}

// ─────────────────────────────────────────────
// Camera Animation Controller
// ─────────────────────────────────────────────

const MUSCLE_CAMERA_TARGETS: Record<string, { pos: [number, number, number], target: [number, number, number] }> = {
  chest: { pos: [0, 0.4, 0.8], target: [0, 0.35, 0] },
  abs: { pos: [0, 0.1, 0.8], target: [0, 0.1, 0] },
  shoulders: { pos: [0, 0.6, 0.9], target: [0, 0.5, 0] },
  biceps: { pos: [0.3, 0.3, 0.8], target: [0, 0.3, 0] },
  triceps: { pos: [0.3, 0.3, 0.8], target: [0, 0.3, 0] },
  forearms: { pos: [0.4, 0.0, 0.8], target: [0, 0.0, 0] },
  quads: { pos: [0, -0.3, 1.2], target: [0, -0.3, 0] },
  hamstrings: { pos: [0, -0.3, -1.2], target: [0, -0.3, 0] },
  calves: { pos: [0, -0.7, 1.0], target: [0, -0.7, 0] },
  lats: { pos: [0, 0.3, -1.0], target: [0, 0.3, 0] },
  traps: { pos: [0, 0.6, -0.8], target: [0, 0.5, 0] },
  lower_back: { pos: [0, 0.1, -1.0], target: [0, 0.1, 0] },
  glutes: { pos: [0, -0.1, -1.0], target: [0, -0.1, 0] },
};

function CameraController({ selectedMuscle, controlsRef }: any) {
  const { camera } = useThree();

  useEffect(() => {
    let targetPos = [0, 0.15, 2.2];
    let targetLook = [0, 0, 0];
    let targetFov = 50; // default wide angle

    if (selectedMuscle && MUSCLE_CAMERA_TARGETS[selectedMuscle]) {
      targetPos = MUSCLE_CAMERA_TARGETS[selectedMuscle].pos;
      targetLook = MUSCLE_CAMERA_TARGETS[selectedMuscle].target;
      targetFov = 35; // Cinematic tight zoom
    }

    // Zoom and position
    gsap.to(camera.position, {
      x: targetPos[0],
      y: targetPos[1],
      z: targetPos[2],
      duration: 1.2,
      ease: "power3.inOut",
    });

    // Dynamic FOV Warp
    gsap.to(camera, {
      fov: targetFov,
      duration: 1.2,
      ease: "power3.inOut",
      onUpdate: () => camera.updateProjectionMatrix()
    });

    // Target tracking
    if (controlsRef.current) {
      gsap.to(controlsRef.current.target, {
        x: targetLook[0],
        y: targetLook[1],
        z: targetLook[2],
        duration: 1.2,
        ease: "power3.inOut",
      });
    }
  }, [selectedMuscle, camera, controlsRef]);

  return null;
}


// ─────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────

export default function BodyModel({ onSelectMuscle, selectedMuscle, onHoverMuscle }: any) {
  const [isFront, setIsFront] = useState(true);
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    return () => { document.body.style.cursor = "auto"; };
  }, []);

  return (
    <div className="relative w-full h-full">
      <Canvas camera={{ position: [0, 0.15, 2.2], fov: 50 }} gl={{ antialias: true, alpha: true }} style={{ background: "transparent" }}>
        <ambientLight intensity={0.08} />
        <directionalLight position={[3, 4, 2]} intensity={0.12} color="#fff" />
        <directionalLight position={[-2, 1, -3]} intensity={0.06} color="#aaaaff" />

        <Suspense fallback={null}>
          <FallbackProceduralBody onSelect={onSelectMuscle} selectedId={selectedMuscle} onHover={onHoverMuscle} targetRotation={isFront ? 0 : Math.PI} />
        </Suspense>

        <FloatingParticles />
        <CameraController selectedMuscle={selectedMuscle} controlsRef={controlsRef} />
        <OrbitControls ref={controlsRef} enableZoom={false} enablePan={false} minPolarAngle={Math.PI / 3} maxPolarAngle={(Math.PI * 2) / 3} rotateSpeed={0.5} />
        
        {/* Cinematic Post-Processing */}
        <EffectComposer enableNormalPass={false}>
          <Bloom 
            luminanceThreshold={0.2} 
            mipmapBlur 
            intensity={1.2} 
          />
          <Vignette eskil={false} offset={0.1} darkness={1.1} />
        </EffectComposer>
      </Canvas>

      {/* Front / Back Toggle */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-[#0a0a0a]/80 backdrop-blur-xl border border-white/10 rounded-full p-0.5">
        <button onClick={() => setIsFront(true)} className={`px-4 py-1.5 text-[10px] font-medium rounded-full transition-all ${isFront ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
          Front
        </button>
        <button onClick={() => setIsFront(false)} className={`px-4 py-1.5 text-[10px] font-medium rounded-full transition-all ${!isFront ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"}`}>
          Back
        </button>
      </div>

    </div>
  );
}
