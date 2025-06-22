"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to House Builder immediately
    router.push("/HouseBuilder");
  }, [router]);

  return (
    <div className="min-h-screen bg-[#04012A] flex items-center justify-center">
      <div className="text-white text-center">
        <h1 className="text-4xl font-bold mb-4">House Builder 3D</h1>
        <p className="text-lg">Loading interactive building tool...</p>
      </div>
    </div>
  );
}
