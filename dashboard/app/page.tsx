"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Landing from "@/components/Landing";
import Boot from "@/components/Boot";

export default function Page() {
  const router = useRouter();
  const [booting, setBooting] = useState(false);

  // brief boot animation, then hand off to the dashboard's real (linkable) route
  const start = () => {
    setBooting(true);
    setTimeout(() => router.push("/overview"), 1750);
  };

  return booting ? <Boot /> : <Landing onStart={start} />;
}
