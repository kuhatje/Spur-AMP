import Image from "next/image";

import { useIsVisible } from "../../JS_Scripts/Visible";
import { useRef } from "react";

export default function ComingSoon() {
  const ref_WhatWeDo = useRef(null);
  const is_visible_WWD = useIsVisible(ref_WhatWeDo);

  return (
    <section className="bg-[#04012A] relative flex h-[525px] w-full">
      <div
        ref={ref_WhatWeDo}
        className={`text-white flex items-center justify-center px-10 md:px-20 w-full relative z-10
                                                transition-all ease-in-out duration-[1800ms] ${is_visible_WWD ? "opacity-100" : "opacity-25"}`}
      >
        <div className="w-1/2 mt-16 text-left">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-8 leading-tight">
            Coming Soon
          </h2>
          <br />
          <p className="text-sm sm:text-lg md:text-xl leading-relaxed">
            Our team is working hard on an innovative system that will allow
            you to interactively build your dream home. Stay tuned for updates
            on this exciting project!
          </p>
        </div>
        <div className="w-1/2 h-full">
          <div className="absolute w-1/2 scale-75 h-full object-fill">
            <Image
              src="/House.gif"
              alt="House Coming Together"
              fill
              className="object-contain"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
