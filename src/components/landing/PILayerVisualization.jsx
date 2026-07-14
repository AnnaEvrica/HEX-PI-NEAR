import { motion } from 'framer-motion';

export default function PILayerVisualization() {
  // Distribution bar heights — bell curve (full probability space preserved)
  const distBars = [12, 22, 38, 58, 78, 92, 78, 58, 38, 22, 12];

  // Neural network node positions
  const inputNodes = [
    { y: 30, label: 'Gemini' },
    { y: 70, label: 'GPT' },
    { y: 110, label: 'Claude' },
  ];
  const hidden1Nodes = [25, 70, 115];
  const hidden2Nodes = [45, 95];

  return (
    <div className="relative w-full max-w-3xl mx-auto">
      <div className="relative h-[260px] sm:h-[340px]" style={{ perspective: '1100px' }}>
        <motion.div
          className="relative w-full h-full flex items-center justify-center gap-2 sm:gap-8"
          style={{ transformStyle: 'preserve-3d' }}
          animate={{ rotateY: [-4, 4, -4], rotateX: [2, -2, 2] }}
          transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
        >
          {/* === Traditional LLMs — Neural Network === */}
          <div style={{ transform: 'translateZ(-40px)' }} className="shrink-0">
            <svg viewBox="0 0 200 140" className="w-[130px] h-[91px] sm:w-[180px] sm:h-[126px]">
              {/* Connections: input → hidden1 */}
              {inputNodes.map((n, i) =>
                hidden1Nodes.map((hy, j) => (
                  <line key={`c1-${i}-${j}`} x1="42" y1={n.y} x2="92" y2={hy} className="text-muted-foreground" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                ))
              )}
              {/* Connections: hidden1 → hidden2 */}
              {hidden1Nodes.map((hy, i) =>
                hidden2Nodes.map((hy2, j) => (
                  <line key={`c2-${i}-${j}`} x1="92" y1={hy} x2="142" y2={hy2} className="text-muted-foreground" stroke="currentColor" strokeWidth="0.5" opacity="0.3" />
                ))
              )}
              {/* Connections: hidden2 → output (collapse to single point) */}
              {hidden2Nodes.map((hy, i) => (
                <line key={`c3-${i}`} x1="142" y1={hy} x2="185" y2="70" className="text-accent" stroke="currentColor" strokeWidth="1" opacity="0.4" />
              ))}

              {/* Input nodes with LLM labels */}
              {inputNodes.map((node, i) => (
                <g key={`in-${i}`}>
                  <motion.circle cx="42" cy={node.y} r="6" className="text-muted-foreground" fill="currentColor" animate={{ opacity: [0.5, 0.85, 0.5] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }} />
                  <text x="2" y={node.y + 3} fontSize="7" className="text-muted-foreground" fill="currentColor" opacity="0.7">{node.label}</text>
                </g>
              ))}

              {/* Hidden layer 1 nodes */}
              {hidden1Nodes.map((y, i) => (
                <motion.circle key={`h1-${i}`} cx="92" cy={y} r="5" className="text-foreground" fill="currentColor" opacity="0.35" animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.4 + 0.2 }} />
              ))}

              {/* Hidden layer 2 nodes */}
              {hidden2Nodes.map((y, i) => (
                <motion.circle key={`h2-${i}`} cx="142" cy={y} r="5" className="text-foreground" fill="currentColor" opacity="0.35" animate={{ opacity: [0.2, 0.5, 0.2] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.5 + 0.4 }} />
              ))}

              {/* Collapsed output — what traditional LLMs produce (single point) */}
              <motion.circle cx="185" cy="70" r="6" className="text-accent" fill="currentColor" animate={{ opacity: [0.6, 1, 0.6], r: [5, 7, 5] }} transition={{ duration: 2, repeat: Infinity }} />
            </svg>
          </div>

          {/* === HEX6-BLE PI Layer — Floating Hexagon === */}
          <motion.div
            className="shrink-0 relative flex items-center justify-center"
            style={{ transform: 'translateZ(30px)' }}
            animate={{ y: [-6, 6, -6] }}
            transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
          >
            {/* Pulsing glow behind hexagon */}
            <motion.div
              className="absolute w-20 h-20 sm:w-28 sm:h-28"
              style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                background: 'hsl(12 100% 50%)',
                filter: 'blur(18px)',
              }}
              animate={{ opacity: [0.25, 0.5, 0.25], scale: [1, 1.25, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            />
            {/* Hexagon body */}
            <div
              className="w-20 h-20 sm:w-28 sm:h-28 flex items-center justify-center relative"
              style={{
                clipPath: 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)',
                background: 'radial-gradient(circle, hsl(12 100% 60%) 0%, hsl(12 100% 45%) 55%, hsl(12 100% 35%) 100%)',
              }}
            >
              <div className="text-center text-white">
                <div className="text-base sm:text-xl font-bold leading-none">PI</div>
                <div className="text-[8px] sm:text-[10px] font-medium opacity-80 mt-0.5">V5.4</div>
              </div>
            </div>
          </motion.div>

          {/* === Probabilistic Output — Full Distribution === */}
          <div style={{ transform: 'translateZ(50px)' }} className="shrink-0">
            <svg viewBox="0 0 170 130" className="w-[120px] h-[92px] sm:w-[160px] sm:h-[122px]">
              {/* Baseline */}
              <line x1="8" y1="112" x2="162" y2="112" className="text-border" stroke="currentColor" strokeWidth="1" />
              {/* Distribution bars — bell curve (preserved probability space) */}
              {distBars.map((h, i) => (
                <motion.rect
                  key={i}
                  x={10 + i * 14}
                  width="11"
                  rx="1"
                  className="text-accent"
                  fill="currentColor"
                  opacity="0.7"
                  initial={{ y: 112, height: 0 }}
                  animate={{ y: 112 - h, height: h }}
                  transition={{ duration: 1.5, repeat: Infinity, repeatType: 'reverse', delay: i * 0.08, ease: 'easeInOut' }}
                />
              ))}
              {/* Label */}
              <text x="85" y="126" fontSize="7" textAnchor="middle" className="text-muted-foreground" fill="currentColor" opacity="0.6">Full Probability Space</text>
            </svg>
          </div>
        </motion.div>

        {/* Data flow particles — streaming left → right through the PI layer */}
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={`p-${i}`}
            className="absolute w-1.5 h-1.5 rounded-full bg-accent pointer-events-none"
            style={{ top: '50%', marginTop: '-3px', boxShadow: '0 0 8px hsl(12 100% 50%)' }}
            animate={{ left: ['12%', '50%', '88%'], opacity: [0, 1, 0] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.6, ease: 'easeInOut' }}
          />
        ))}
      </div>

      {/* Labels below the scene */}
      <div className="flex justify-between items-start mt-3 px-1 sm:px-4 text-[9px] sm:text-xs">
        <span className="text-center flex-1 text-secondary">
          <span className="block font-medium">Traditional LLMs</span>
          <span className="block opacity-60">neural network → collapse</span>
        </span>
        <span className="text-center flex-1 text-accent font-bold">
          <span className="block">HEX6-BLE PI Layer</span>
          <span className="block font-normal opacity-70">reads full space</span>
        </span>
        <span className="text-center flex-1 text-secondary">
          <span className="block font-medium">Probabilistic Output</span>
          <span className="block opacity-60">preserved distribution</span>
        </span>
      </div>
    </div>
  );
}