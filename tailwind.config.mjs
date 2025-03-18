/** @type {import('tailwindcss').Config} */
export default {
    content: [
      './src/**/*.{html,js,ts,jsx,tsx}',
      "./pages/**/*.{js,ts,jsx,tsx,mdx}",
      "./components/**/*.{js,ts,jsx,tsx,mdx}",
      "./app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
      extend: {
        fontFamily: {
          roboto: ['Roboto', "sans-serif"],
        },
        colors: {
          background: "var(--background)",
          foreground: "var(--foreground)",
        },
      },
    },
    plugins: [
      require("daisyui"),
    ],
  };
  