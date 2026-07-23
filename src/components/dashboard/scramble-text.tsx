"use client";

import { useState, useEffect, useRef } from "react";

interface ScrambleTextProps {
  text: string;
  duration?: number;
  className?: string;
}

const CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

function getRandomChar(): string {
  return CHARS[Math.floor(Math.random() * CHARS.length)];
}

export function ScrambleText({ text, duration = 3000, className }: ScrambleTextProps) {
  const [displayText, setDisplayText] = useState(text);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const totalFrames = Math.floor(duration / 30);
    let frame = 0;

    function tick() {
      frame++;
      const progress = Math.min(frame / totalFrames, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      const revealedCount = Math.floor(eased * text.length);

      const next = text
        .split("")
        .map((char, i) => {
          if (i < revealedCount) return char;
          if (i === revealedCount && Math.random() < 0.3) return char;
          return getRandomChar();
        })
        .join("");

      setDisplayText(next);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    }

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [text, duration]);

  return (
    <span className={`relative inline-block ${className ?? ""}`}>
      <span className="invisible">{text}</span>
      <span className="absolute left-0 top-0">{displayText}</span>
    </span>
  );
}
