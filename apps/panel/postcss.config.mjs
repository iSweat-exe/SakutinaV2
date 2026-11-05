// Tailwind runs as a PostCSS plugin so it works with both the webpack build
// (`next build --webpack`, used in production) and Turbopack in `next dev`.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
