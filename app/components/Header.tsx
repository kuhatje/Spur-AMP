"use client";

import Image from "next/image";
import Link from "next/link";

import {
  FaInstagram,
  FaFacebookF,
  FaLinkedinIn,
  FaYoutube,
  FaTiktok,
  FaEnvelope,
} from "react-icons/fa6";
import { CgSearch } from "react-icons/cg";

/* const Header = () =>
{

 
};

export default Header; */

export default function Header() {
  return (
    <header className="hidden md:flex sticky top-0 z-50 w-full flex justify-between items-center px-6 py-4 bg-white text-blue-900 border-b border-blue-200 shadow-sm">
      {/* Brand */}
      <div className="text-2xl font-bold text-[#0474BC]">
        <a href="/" className="hover:text-[#110C27]">
          House Builder
        </a>
      </div>

      {/* Center: House Builder Link */}
      <nav className="flex gap-6 text-sm md:font-semibold tracking-wide text-center">
        <a href="/HouseBuilder" className="hover:text-[#110C27] text-lg font-bold">
          BUILDER TOOL
        </a>
      </nav>

      {/* Right: Simplified branding */}
      <div className="text-[#0474BC] text-xl font-bold">
        3D DEMO
      </div>
    </header>
  );
}
