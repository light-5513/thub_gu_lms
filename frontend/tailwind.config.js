/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          50: "#f0f4f8",
          100: "#e0e5ec",
          200: "#c8d4e0",
          300: "#b0c3d4",
          400: "#99b1c7",
          500: "#15803d", // Accent green
          600: "#e66e5a",
          700: "#cc604f",
          800: "#b35345",
          900: "#99463c",
        },
        cream: {
          50:  "#e0e5ec",
          100: "#e0e5ec",
          200: "#e0e5ec",
          300: "#e0e5ec",
          400: "#e0e5ec",
          500: "#e0e5ec",
        },
        leather: {
          50:  "#718096", // muted text
          100: "#4a5568", 
          200: "#2d3748", // normal text
          300: "#1a202c", // bold text
          400: "#171923",
          500: "#000000",
        },
        parchment: {
          50: "#e0e5ec",
          100: "#e0e5ec",
          200: "#e0e5ec",
        },
      },
      fontFamily: {
        sans: ["Outfit", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ["Outfit", "Georgia", "serif"],
      },
      boxShadow: {
        card: "9px 9px 16px rgb(163,177,198,0.6), -9px -9px 16px rgba(255,255,255, 0.5)",
        "card-lg": "12px 12px 20px rgb(163,177,198,0.6), -12px -12px 20px rgba(255,255,255, 0.6)",
        recess: "inset 6px 6px 10px 0 rgba(163,177,198, 0.5), inset -6px -6px 10px 0 rgba(255,255,255, 0.5)",
        "btn-primary": "5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255, 0.5)",
        "btn-secondary": "5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255, 0.5)",
        "btn-danger": "5px 5px 10px rgb(163,177,198,0.6), -5px -5px 10px rgba(255,255,255, 0.5)",
        pill: "4px 4px 8px rgb(163,177,198,0.5), -4px -4px 8px rgba(255,255,255, 0.5)",
        header: "4px 4px 10px rgb(163,177,198,0.4), -4px -4px 10px rgba(255,255,255, 0.4)",
        pop: "10px 10px 20px rgb(163,177,198,0.6), -10px -10px 20px rgba(255,255,255, 0.5)",
        toast: "6px 6px 12px rgb(163,177,198,0.5), -6px -6px 12px rgba(255,255,255, 0.6)",
      },
      keyframes: {
        "fade-in": { from: { opacity: 0, transform: "translateY(4px)" }, to: { opacity: 1, transform: "translateY(0)" } },
        "press": { "0%,100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(1px)" } },
      },
      animation: {
        "fade-in": "fade-in 0.25s ease-out",
        "press": "press 120ms ease-out",
      },
      backgroundImage: {
        "noise": "none",
        "pinstripe": "none",
        "ribbon": "none",
      },
    },
  },
  plugins: [],
};
