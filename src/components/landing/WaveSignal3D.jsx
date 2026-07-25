import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { motion } from 'framer-motion';

// A 3D radial wave field rendered with three.js: a grid of lines displaced by
// a smooth outgoing ripple, with a handful of "identified signal points"
// (glowing spheres + rings) riding the wave. A 2D concentric ripple overlay
// sits on top, aligned to the same radial center — the "circular animation
// that overlaps on top."
export default function WaveSignal3D() {
  const mountRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    let width = mount.clientWidth || 600;
    let height = mount.clientHeight || 280;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(0, 16, 24);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    mount.appendChild(renderer.domElement);

    // --- Wave grid (line segments that we displace each frame) ---
    const N = 36;
    const SIZE = 40;
    const STEP = SIZE / (N - 1);
    const verts = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        verts.push(-SIZE / 2 + j * STEP, 0, -SIZE / 2 + i * STEP);
      }
    }
    const indices = [];
    for (let i = 0; i < N; i++) {
      for (let j = 0; j < N; j++) {
        const a = i * N + j;
        if (j < N - 1) indices.push(a, a + 1);
        if (i < N - 1) indices.push(a, a + N);
      }
    }
    const gridGeo = new THREE.BufferGeometry();
    gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    gridGeo.setIndex(indices);
    const grid = new THREE.LineSegments(
      gridGeo,
      new THREE.LineBasicMaterial({ color: 0xFF6B35, transparent: true, opacity: 0.5 })
    );
    scene.add(grid);
    const posAttr = gridGeo.attributes.position;

    // --- Identified signal points: spheres + pulsing rings at fixed coords ---
    const signalCoords = [
      [0, 0], [9, 6], [-8, 5], [7, -8], [-9, -4],
    ];
    const sphereGeo = new THREE.SphereGeometry(0.32, 16, 16);
    const sphereMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const ringGeo = new THREE.RingGeometry(0.6, 0.78, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xFF6B35, transparent: true, opacity: 0.55, side: THREE.DoubleSide,
    });
    const signals = signalCoords.map(([x, z]) => {
      const mesh = new THREE.Mesh(sphereGeo, sphereMat);
      mesh.position.set(x, 0, z);
      scene.add(mesh);
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.set(x, 0.05, z);
      scene.add(ring);
      return { mesh, ring, x, z };
    });

    // Shared radial wave function so the grid and the signal points move together.
    const waveY = (x, z, t) =>
      Math.sin(Math.sqrt(x * x + z * z) * 0.55 - t * 1.6) * 1.25 *
      Math.exp(-Math.sqrt(x * x + z * z) * 0.035);

    let raf = null;
    let visible = true;
    const clock = new THREE.Clock();
    let elapsed = 0;
    let firstFrame = true;
    const animate = () => {
      if (!visible) { raf = null; return; }
      elapsed += clock.getDelta();
      const t = elapsed;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const z = posAttr.getZ(i);
        posAttr.setY(i, waveY(x, z, t));
      }
      posAttr.needsUpdate = true;
      for (const s of signals) {
        const y = waveY(s.x, s.z, t);
        s.mesh.position.y = y + 0.45;
        s.ring.position.y = y + 0.08;
        s.ring.scale.setScalar(1 + 0.35 * Math.sin(t * 2 + Math.sqrt(s.x * s.x + s.z * s.z)));
      }
      grid.rotation.y = t * 0.06;
      renderer.render(scene, camera);
      if (firstFrame) { firstFrame = false; setReady(true); }
      raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    // Pause the render loop when the field scrolls off-screen so it stops
    // consuming CPU/GPU while invisible; resume instantly on return.
    const io = new IntersectionObserver((entries) => {
      visible = entries[0].isIntersecting;
      if (visible && raf === null) raf = requestAnimationFrame(animate);
      else if (!visible && raf !== null) { cancelAnimationFrame(raf); raf = null; }
    }, { threshold: 0 });
    io.observe(mount);

    const onResize = () => {
      const w = mount.clientWidth || 600;
      const h = mount.clientHeight || 280;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      io.disconnect();
      window.removeEventListener('resize', onResize);
      gridGeo.dispose();
      sphereGeo.dispose();
      sphereMat.dispose();
      ringGeo.dispose();
      ringMat.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div className="relative w-full h-[240px] sm:h-[300px] md:h-[340px] pointer-events-none" style={{ opacity: ready ? 1 : 0, transition: 'opacity 0.7s ease-out' }}>
      <div ref={mountRef} className="absolute inset-0" />
      {/* Circular ripple animation overlapping on top, aligned to the radial center */}
      <svg viewBox="0 0 400 200" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet">
        {[0, 1, 2, 3].map((i) => (
          <motion.circle
            key={i}
            cx="200" cy="100" fill="none" stroke="#FF6B35" strokeWidth="1.2"
            initial={{ r: 4, opacity: 0.5 }}
            animate={{ r: [4, 120], opacity: [0.5, 0] }}
            transition={{ duration: 3.2, repeat: Infinity, delay: i * 0.8, ease: 'easeOut' }}
          />
        ))}
      </svg>
    </div>
  );
}