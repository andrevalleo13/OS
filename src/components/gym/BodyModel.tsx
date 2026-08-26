"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Center } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useRef, useState, useEffect, Suspense, useMemo } from "react";
import * as THREE from "three";
import gsap from "gsap";

// ─────────────────────────────────────────────
// Realistic GLB Body Component
// ─────────────────────────────────────────────

function RealisticProceduralBody({ onSelect, selectedId, targetRotation, onHover }: any) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation, 0.04);
    }
  });

  return (
    <group ref={groupRef}>
      <Center>
        <mesh 
          scale={[0.8, 2.0, 0.4]} 
          onClick={(e) => {
            e.stopPropagation();
            onSelect("chest"); // Fallback mock selection
          }}
          onPointerOver={(e) => {
            e.stopPropagation();
            onHover("chest");
            document.body.style.cursor = "pointer";
          }}
          onPointerOut={() => {
            onHover(null);
            document.body.style.cursor = "auto";
          }}
        >
          <boxGeometry />
          <meshPhysicalMaterial 
            color="#000000" 
            emissive="#ffffff" 
            emissiveIntensity={selectedId ? 0.5 : 0.1}
            transparent 
            opacity={0.8} 
            wireframe={true} 
          />
        </mesh>
      </Center>
    </group>
  );
}

// Preload the model (Commented out temporarily)
// useGLTF.preload('/anatomy.glb');

// ─────────────────────────────────────────────
// Environment / Particles
// ─────────────────────────────────────────────

function FloatingParticles() {
  const count = 40;
  const ref = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const seeded = (offset: number) => {
        const value = Math.sin((i * 3 + offset + 1) * 12.9898) * 43_758.5453;
        return value - Math.floor(value);
      };
      pos[i * 3] = (seeded(0) - 0.5) * 6;
      pos[i * 3 + 1] = (seeded(1) - 0.5) * 6;
      pos[i * 3 + 2] = (seeded(2) - 0.5) * 6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return geo;
  }, []);

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.005;
      ref.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.003) * 0.04;
    }
  });

  return (
    <points ref={ref} geometry={geometry}>
      <pointsMaterial size={0.015} color="#ffffff" transparent opacity={0.1} sizeAttenuation />
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
    let targetPos = [0, 0, 2.5]; // Slightly closer default framing
    let targetLook = [0, -0.2, 0]; // Look slightly down towards center
    let targetFov = 40; // More cinematic default FOV

    if (selectedMuscle && MUSCLE_CAMERA_TARGETS[selectedMuscle]) {
      targetPos = MUSCLE_CAMERA_TARGETS[selectedMuscle].pos;
      targetLook = MUSCLE_CAMERA_TARGETS[selectedMuscle].target;
      targetFov = 25; // Tight cinematic lens
    }

    gsap.to(camera.position, {
      x: targetPos[0],
      y: targetPos[1],
      z: targetPos[2],
      duration: 1.2,
      ease: "power3.inOut",
    });

    gsap.to(camera, {
      fov: targetFov,
      duration: 1.2,
      ease: "power3.inOut",
      onUpdate: () => camera.updateProjectionMatrix()
    });

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
      {/* 
        onPointerMissed is triggered when clicking on the Canvas background (not on a mesh),
        allowing the user to unselect the muscle and zoom out.
      */}
      <Canvas 
        onPointerMissed={() => onSelectMuscle(null)}
        camera={{ position: [0, 0, 2.5], fov: 40 }} 
        gl={{ antialias: true, alpha: true }} 
        style={{ background: "transparent" }}
      >
        {/* Ultra Minimalist Studio Lighting Setup (Monochromatic) */}
        <ambientLight intensity={0.8} />
        {/* Soft top-front light */}
        <directionalLight position={[0, 8, 5]} intensity={1.5} color="#ffffff" />
        {/* Very sharp white rim lights for silhouette */}
        <directionalLight position={[-6, 4, -6]} intensity={5.0} color="#ffffff" />
        <directionalLight position={[6, -4, -6]} intensity={3.0} color="#ffffff" />
        
        <Suspense fallback={null}>
          <RealisticProceduralBody 
            onSelect={onSelectMuscle} 
            selectedId={selectedMuscle} 
            onHover={onHoverMuscle} 
            targetRotation={isFront ? 0 : Math.PI} 
          />
        </Suspense>

        <FloatingParticles />
        <CameraController selectedMuscle={selectedMuscle} controlsRef={controlsRef} />
        <OrbitControls 
          ref={controlsRef} 
          enableZoom={false} // Disable scroll zoom so framing is always perfectly pro
          enablePan={false}  // Disable panning so it stays centered
          minPolarAngle={Math.PI / 4}
          maxPolarAngle={Math.PI / 1.5}
        />
        
        <EffectComposer enableNormalPass={false}>
          <Bloom 
            luminanceThreshold={0.4} 
            mipmapBlur 
            intensity={0.8} 
          />
          <Vignette eskil={false} offset={0.2} darkness={0.9} />
        </EffectComposer>
      </Canvas>

      {/* Helper text when zoomed in */}
      {selectedMuscle && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-[10px] text-gray-500 font-mono tracking-wide pointer-events-none">
          Click background to zoom out
        </div>
      )}

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
