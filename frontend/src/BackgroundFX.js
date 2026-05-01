import { motion } from "framer-motion";

function BackgroundFX() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <motion.div
          key={i}
          animate={{
            x: [0, 200, -200, 0],
            y: [0, -150, 150, 0],
          }}
          transition={{
            duration: 20 + i * 2,
            repeat: Infinity,
            ease: "linear",
          }}
          style={{
            position: "fixed",
            width: "300px",
            height: "300px",
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(56,189,248,0.2), transparent)",
            filter: "blur(80px)",
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            zIndex: 0,
          }}
        />
      ))}
    </>
  );
}

export default BackgroundFX;
