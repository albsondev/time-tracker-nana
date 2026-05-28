export const motionEasing = {
  standard: [0.2, 0, 0, 1] as [number, number, number, number],
  emphasized: [0.2, 0.8, 0.2, 1] as [number, number, number, number],
  exit: [0.4, 0, 1, 1] as [number, number, number, number],
  overshoot: [0.34, 1.56, 0.64, 1] as [number, number, number, number],
};

export const motionDuration = {
  instant: 0.09,
  fast: 0.14,
  medium: 0.22,
  slow: 0.36,
  reveal: 0.52,
  chart: 0.9,
} as const;

export const motionDelay = {
  none: 0,
  micro: 0.03,
  step: 0.06,
  cascade: 0.09,
} as const;

export const fadeUp = {
  hidden: { opacity: 0, y: 18, filter: "blur(8px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: motionDuration.medium,
      ease: motionEasing.standard,
    },
  },
};

export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: motionDelay.step,
      delayChildren: motionDelay.micro,
    },
  },
};

export const springy = {
  type: "spring" as const,
  stiffness: 390,
  damping: 28,
  mass: 0.82,
};
