import Image from "next/image";

export default function HeroSection() {
  return (
    <section className="relative h-screen w-full">
      <div>
        <Image
          src="/Apartment.png"
          alt="Background"
          fill
          className="delay-15000 object-cover animate-fade-image"
          priority
        />
        <Image
          src="/241-waterloo.jpg"
          alt="Background"
          fill
          className="delay-10000 object-cover animate-fade-image"
          priority
        />
        <Image
          src="/what-we-do.jpg"
          alt="Background"
          fill
          className="delay-5000 object-cover animate-fade-image"
          priority
        />
        <Image
          src="/background.jpg"
          alt="Background"
          fill
          className="object-cover animate-fade-image"
          priority
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center z-20 px-4">
        <div className="backdrop-blur-sm bg-black/50 text-white px-6 sm:px-8 md:px-12 py-8 sm:py-12 md:py-16 rounded-xl shadow-lg text-center max-w-4xl">
          <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-bold tracking-tight leading-tight">
            House Builder 3D
          </h1>
          <p className="text-lg sm:text-xl md:text-2xl mt-3 md:mt-4 text-gray-200 leading-relaxed">
            Interactive Building Design Tool
          </p>
        </div>
      </div>
    </section>
  );
}
