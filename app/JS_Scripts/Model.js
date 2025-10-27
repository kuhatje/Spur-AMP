import { Canvas } from "@react-three/fiber";
import { useGLTF, Stage, PresentationControls } from "@react-three/drei";
import { useEffect, useState } from "react";
import * as THREE from 'three';

function Model({ location, scene, ...props }) {
  if (scene) {
    // Handle dynamic scene object
  return <primitive object={scene} {...props} />;
  } else {
    // Handle GLTF/GLB file
    const { scene: gltfScene } = useGLTF(location);
    return <primitive object={gltfScene} {...props} />;
  }
}

export default function Model_Preview({ loc, customScene = null }) {
  const [dynamicScene, setDynamicScene] = useState(null);

  useEffect(() => {
    if (customScene) {
      // Clone the scene to avoid modifying the original
      const clonedScene = customScene.clone();
      setDynamicScene(clonedScene);
    } else {
      setDynamicScene(null);
    }
  }, [customScene]);

  return (
    <Canvas
      dpr={[1, 2]}
      camera={{
        fov: 45,
        position: [0, 0, 5],
        near: 0.1,
        far: 1000,
      }}
      style={{ position: "relative" }}
    >
      <color attach="background" args={["#0474BC"]} />
      <PresentationControls
        key={dynamicScene ? 'dynamic' : loc} // <- force remount on model change
        speed={1.5}
        global
        zoom={0.7}
        polar={[-0.1, Math.PI / 4]}
        rotation={[0, 0, 0]}
        config={{ mass: 2, tension: 500 }}
      >
        <Stage
          environment="sunset"
          shadows={false}
          contactShadow={false}
          preset="rembrandt"
          intensity={1}
        >
          {dynamicScene ? (
            <Model scale={0.1} scene={dynamicScene} />
          ) : (
          <Model scale={0.01} location={loc} />
          )}
        </Stage>
      </PresentationControls>
    </Canvas>
  );
}
