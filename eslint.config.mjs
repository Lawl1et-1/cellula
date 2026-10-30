import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const config = [
  ...nextVitals,
  ...nextTs,
  { ignores: ['.next/**', 'out/**', 'node_modules/**', 'public/mediapipe/**', 'next-env.d.ts', '_*.ts'] },
  {
    rules: {
      // R3F mutates three.js objects inside useFrame by design.
      'react-hooks/immutability': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/refs': 'off',
    },
  },
];

export default config;
