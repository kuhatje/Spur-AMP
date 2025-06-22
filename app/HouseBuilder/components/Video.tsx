import Image from "next/image";

import { useIsVisible } from "../../JS_Scripts/Visible";
import { useRef } from "react";

export default function Video() {
  const ref_WhatWeDo = useRef(null);
  const is_visible_WWD = useIsVisible(ref_WhatWeDo);

  return (
    <section className="bg-[#04012A] relative py-12 md:py-16 w-full min-h-[400px] md:h-[525px]">
      <div
        ref={ref_WhatWeDo}
        className={`text-white flex flex-col md:flex-row items-center justify-center px-4 md:px-10 lg:px-20 w-full relative z-10 gap-8 md:gap-0
                                                transition-all ease-in-out duration-[1800ms] ${is_visible_WWD ? "opacity-100" : "opacity-25"}`}
      >
        <div className="w-full md:w-1/2 text-center md:text-left md:mt-16">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-extrabold mb-4 md:mb-8 leading-tight">
            House Builder
          </h2>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl leading-relaxed px-2 md:px-0">
            The House Builder tool lets you enter your project
            specifications to generate a complete house plan. This plan includes
            a detailed list of materials and components required, and you'll also
            have the option to download the corresponding files.
          </p>
        </div>
        <div className="w-full md:w-1/2 h-48 md:h-full relative">
          <div className="relative w-full h-full flex items-center justify-center">
            <div className="relative w-3/4 md:w-2/3 h-full">
              <Image
                src="/House.gif"
                alt="House Coming Together"
                fill
                className="object-contain"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
