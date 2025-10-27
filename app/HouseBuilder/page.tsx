"use client";

import Image from "next/image";
import Header from "../components/Header";
import HeaderMobile from "../components/HeaderMobile";
import HeroSection from "./components/HeroSection";
import Video from "./components/Video";
import Builder from "./components/Builder";
import ComponentLibrary from "./components/ComponentLibrary";
import Soon from "./components/ComingSoon";
import Footer from "../components/Footer";
import { InventoryProvider } from "./context/InventoryContext";

export default function HouseBuilder() {
  return (
    <>
      <Header />
      <HeaderMobile />
      <HeroSection />

      {/* Current Deployment */}
      {/* <Soon /> */}

      {/* Current Development */}

      <Video />
      <InventoryProvider>
        <Builder />
        <ComponentLibrary />
      </InventoryProvider>

      <Footer />
    </>
  );
}
