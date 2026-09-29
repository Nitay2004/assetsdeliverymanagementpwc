"use client";

import { useState, useRef, useCallback } from "react";

interface PincodeInputProps {
  pincodeName?: string;
  cityName?: string;
  stateName?: string;
  defaultPincode?: string;
  defaultCity?: string;
  defaultState?: string;
  required?: boolean;
  onLocationChange?: (city: string, state: string) => void;
}

export function PincodeInput({
  pincodeName = "pinCode",
  cityName = "city",
  stateName = "state",
  defaultPincode = "",
  defaultCity = "",
  defaultState = "",
  required,
  onLocationChange,
}: PincodeInputProps) {
  const [pincode, setPincode] = useState(defaultPincode);
  const [city, setCity] = useState(defaultCity);
  const [state, setState] = useState(defaultState);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback(
    (nextCity: string, nextState: string) => {
      onLocationChange?.(nextCity, nextState);
    },
    [onLocationChange]
  );

  const fetchPincode = useCallback(
    async (code: string) => {
      if (!/^\d{6}$/.test(code)) return;
      setLoading(true);
      try {
        const res = await fetch(`/api/pincode/${code}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!data.city && !data.state) return;
        const nextCity = data.city ?? "";
        const nextState = data.state ?? "";
        if (data.city) setCity(data.city);
        if (data.state) setState(data.state);
        notify(nextCity, nextState);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    },
    [notify]
  );

  function handlePincodeChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setPincode(digits);
    if (timerRef.current) clearTimeout(timerRef.current);
    if (digits.length === 6) {
      timerRef.current = setTimeout(() => fetchPincode(digits), 400);
    }
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          City
        </label>
        <input
          name={cityName}
          value={city}
          onChange={e => setCity(e.target.value)}
          placeholder="City"
          className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          State
        </label>
        <input
          name={stateName}
          value={state}
          onChange={e => setState(e.target.value)}
          placeholder="State"
          className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-foreground">
          Pin Code{required ? <span className="text-destructive"> *</span> : ""}
        </label>
        <div className="relative">
          <input
            name={pincodeName}
            value={pincode}
            onChange={e => handlePincodeChange(e.target.value)}
            placeholder="Pin Code"
            required={required}
            maxLength={6}
            inputMode="numeric"
            className="flex h-9 w-full rounded-lg border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          {loading && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">
              ...
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
