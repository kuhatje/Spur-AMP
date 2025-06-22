import {
  FaEnvelope,
  FaGlobe,
} from "react-icons/fa6";

export default function Footer() {
  return (
    <footer className="bg-[#0d1030] text-white pt-8 pb-6">
      <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-8">
        {/* Brand */}
        <div className="text-center md:text-left">
          <div className="text-3xl font-bold text-[#0078C7] mb-2">
            House Builder
          </div>
          <p className="text-sm text-gray-300">Interactive 3D Building Tool</p>
        </div>

        {/* Info */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-[#0078C7] mb-3">
            DEMO
          </h2>
          <div className="flex flex-col gap-2 text-sm">
            <p className="text-gray-300">
              Build houses with our interactive tool
            </p>
            <p className="text-gray-300">
              Save, load, and visualize in 3D
            </p>
          </div>
        </div>
      </div>

      {/* Bottom copyright */}
      <div className="border-t border-gray-500 mt-8 pt-4 text-center text-sm text-gray-300">
        © 2025 House Builder Demo
      </div>
    </footer>
  );
}
