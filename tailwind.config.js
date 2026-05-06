/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta original BullsEye (de Jaime)
        page: "#F6F6F4",
        accent: "#251762",
        accentBg: "#EEEAF8",
        purple: "#7B3FD4",
        purpleBg: "#F4EFFE",
        successCustom: "#16A369",
        infoCustom: "#2060D8",
        warnCustom: "#B8720A",
      },
      fontFamily: {
        sans: ["Inter", "Helvetica Neue", "Arial", "sans-serif"],
      },
    },
  },
  plugins: [],
};
