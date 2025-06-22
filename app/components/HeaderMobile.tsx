"use client";

import Image from "next/image";
import Link from "next/link";

export default function HeaderMobile() {
  return (
    <header className="md:hidden sticky top-0 z-50 w-full flex justify-between items-center px-4 py-3 bg-white text-blue-900 border-b border-blue-200 shadow-sm">
      {/* Brand */}
      <div className="text-lg font-bold text-[#0474BC]">
        <a href="/" className="hover:text-[#110C27]">
          House Builder
        </a>
      </div>

      {/* House Builder Link */}
      <nav className="flex-1 text-center">
        <a href="/HouseBuilder" className="hover:text-[#110C27] text-sm font-semibold">
          BUILDER TOOL
        </a>
      </nav>

      {/* Right: Simplified branding */}
      <div className="text-[#0474BC] text-sm font-bold">
        DEMO
      </div>
    </header>
  );
}
