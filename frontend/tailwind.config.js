module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#071411", 900: "#0b201b", 800: "#123129" },
        mint: { 300: "#a5f3d2", 400: "#77e8bd", 500: "#3fc99a" },
        gold: { 300: "#f7d487", 400: "#f2c059" }
      },
      boxShadow: { panel: "0 24px 80px rgba(0,0,0,.22)" }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
