"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF, Center, Environment } from "@react-three/drei";
import { EffectComposer, Bloom, Vignette } from "@react-three/postprocessing";
import { useRef, useState, useEffect, Suspense, useMemo } from "react";
import * as THREE from "three";
import gsap from "gsap";

// ─────────────────────────────────────────────
// Realistic GLB Body Component
// ─────────────────────────────────────────────

function mapNodeToMuscleId(nodeName: string): string | null {
  const name = nodeName.toLowerCase();
  if (name.includes("pectoralis")) return "chest";
  if (name.includes("rectus abdominis") || name.includes("oblique")) return "abs";
  if (name.includes("deltoid")) return "shoulders";
  if (name.includes("biceps brachii") || name.includes("brachialis")) return "biceps";
  if (name.includes("triceps brachii")) return "triceps";
  if (name.includes("brachioradialis") || name.includes("flexor carpi") || name.includes("extensor carpi") || name.includes("pronator") || name.includes("supinator")) return "forearms";
  if (name.includes("rectus femoris") || name.includes("vastus") || name.includes("sartorius")) return "quads";
  if (name.includes("biceps femoris") || name.includes("semitendinosus") || name.includes("semimembranosus")) return "hamstrings";
  if (name.includes("gastrocnemius") || name.includes("soleus")) return "calves";
  if (name.includes("latissimus dorsi")) return "lats";
  if (name.includes("trapezius")) return "traps";
  if (name.includes("iliocostalis") || name.includes("longissimus") || name.includes("spinalis") || name.includes("quadratus lumborum")) return "lower_back";
  if (name.includes("gluteus")) return "glutes";
  
  if (name.includes("frontalis") || name.includes("oculi") || name.includes("oris") || name.includes("masseter") || name.includes("temporalis") || name.includes("pterygoid") || name.includes("zygomaticus") || name.includes("labii") || name.includes("anguli") || name.includes("risorius") || name.includes("mentalis") || name.includes("procerus") || name.includes("nasalis") || name.includes("corrugator") || name.includes("depressor") || name.includes("levator")) return "face";
  return null;
}

function RealisticProceduralBody({ onSelect, selectedId, targetRotation, onHover, muscleSoreness = {} }: any) {
  const groupRef = useRef<THREE.Group>(null);
  const { scene } = useGLTF('/anatomy.glb');
  
  const materialsRef = useRef<Record<string, THREE.MeshPhysicalMaterial[]>>({});
  
  // Clone scene and setup materials ONCE
  const clonedScene = useMemo(() => {
    const s = scene.clone();
    s.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        const muscleId = mapNodeToMuscleId(child.name);
        
        // Hide terrifying facial muscles for a sleek faceless look
        if (muscleId === "face") {
          child.visible = false;
          return;
        }
        
        const mat = new THREE.MeshPhysicalMaterial({
          color: new THREE.Color("#000000"), // Pure deep black
          emissive: new THREE.Color("#000000"),
          emissiveIntensity: 0,
          transparent: true,
          opacity: 0.95,
          roughness: 0.1, // Highly polished/glossy
          metalness: 1.0, // Maximum metallic for obsidian look
          clearcoat: 0.2, // Slight clearcoat for extra shine
          side: THREE.DoubleSide
        });
        child.material = mat;

        if (muscleId) {
          child.userData = { muscleId };
          if (!materialsRef.current[muscleId]) {
            materialsRef.current[muscleId] = [];
          }
          materialsRef.current[muscleId].push(mat);
        }
      }
    });
    return s;
  }, [scene]);

  // Update properties efficiently without creating new materials
  useEffect(() => {
    Object.entries(materialsRef.current).forEach(([muscleId, mats]) => {
      const isSelected = selectedId === muscleId;
      const soreness = muscleSoreness[muscleId] || 0;
      
      const soreColor = new THREE.Color("#ff5533");
      const healthyColor = new THREE.Color("#ffffff"); // Pure white for highlights
      const finalEmissive = isSelected ? healthyColor : healthyColor.clone().lerp(soreColor, soreness / 100);
      
      const targetIntensity = isSelected ? 0.6 : (soreness > 0 ? 0.2 + (soreness / 100) * 0.4 : 0);
      const targetOpacity = isSelected ? 1.0 : 0.7 + (soreness / 100) * 0.2;

      mats.forEach(mat => {
        mat.emissive.copy(finalEmissive);
        mat.emissiveIntensity = targetIntensity;
        mat.opacity = targetOpacity;
      });
    });
  }, [selectedId, muscleSoreness]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(groupRef.current.rotation.y, targetRotation, 0.04);
    }
  });

  const handlePointerOver = (e: any) => {
    e.stopPropagation();
    const id = e.object.userData.muscleId;
    if (id) {
      onHover(id);
      document.body.style.cursor = "pointer";
    }
  };

  const handlePointerOut = () => {
    onHover(null);
    document.body.style.cursor = "auto";
  };

  const handleClick = (e: any) => {
    e.stopPropagation();
    const id = e.object.userData.muscleId;
    if (id) {
      onSelect(id);
    }
  };

  return (
    <group ref={groupRef}>
      <Center>
        <primitive 
          object={clonedScene} 
          scale={0.0014} // Perfect scale to fill the container nicely
          rotation={[-Math.PI / 2, 0, 0]} // Stand the model upright
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        />
      </Center>
    </group>
  );
}

// Preload the model
useGLTF.preload('/anatomy.glb');

// ─────────────────────────────────────────────
// Environment / Particles
// ─────────────────────────────────────────────

function FloatingParticles() {
  const count = 40;
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

export default function BodyModel({ onSelectMuscle, selectedMuscle, onHoverMuscle, muscleSoreness = {} }: any) {
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
            muscleSoreness={muscleSoreness} 
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
