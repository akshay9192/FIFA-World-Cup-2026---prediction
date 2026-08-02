module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      colors: {
        ink: { 950: "#07110F", 900: "#0B1A16", 800: "#123129" },
        mint: { 300: "#7DE1B8", 400: "#16C784", 500: "#10A76D" },
        gold: { 300: "#F8E39B", 400: "#F4D35E" },
        signal: "#F05D5E",
        data: "#64B5F6",
        paper: "#F2EFE6"
      },
      boxShadow: { panel: "0 24px 80px rgba(0,0,0,.22)" }
    }
  },
  plugins: [require('@tailwindcss/forms')]
};
