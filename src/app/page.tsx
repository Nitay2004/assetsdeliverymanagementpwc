"use client";

import Image from "next/image";
import { useState, useEffect } from "react";
import { LoginForm } from "@/components/login-form";

// Unsplash CDN background images
const BACKGROUND_PHOTOS = [
  "https://images.unsplash.com/photo-1777836439057-f80dbde5703c?w=1920&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1779881718730-e649656ebae1?w=1920&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1778222013858-3fc072cd10c6?w=1920&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1778510092958-c952c661b807?w=1920&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1780049921469-4afa2c328d4e?w=1920&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1780552274859-b3a1e6effd50?w=1920&auto=format&fit=crop&q=80",
];

export default function LoginPage() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Randomize starting image only on client after hydration
  useEffect(() => {
    setCurrentIndex(Math.floor(Math.random() * BACKGROUND_PHOTOS.length));
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const interval = setInterval(() => {
      setCurrentIndex((i) => (i + 1) % BACKGROUND_PHOTOS.length);
    }, 6000); // change every 6 seconds

    return () => clearInterval(interval);
  }, [mounted]);

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden">
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${BACKGROUND_PHOTOS[currentIndex]})` }}
      />

      {/* Dark overlay for readability */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[1px]" />

      {/* Content */}
      <div className="relative z-10 flex w-full max-w-sm flex-col gap-6 px-6 animate-fade-in-up">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-white p-1 shadow-md">
            <Image
              src="/devitlogo.png"
              alt="DevIT"
              width={28}
              height={28}
              className="size-7"
              priority
            />
          </div>
          <span className="text-lg font-semibold tracking-tight text-white">
            DevIT
          </span>
        </div>

        {/* Login card */}
        <LoginForm />

        {/* Image dots indicator */}
        <div className="flex justify-center gap-1.5">
          {BACKGROUND_PHOTOS.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-6 bg-white"
                  : "w-1.5 bg-white/40 hover:bg-white/60"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
