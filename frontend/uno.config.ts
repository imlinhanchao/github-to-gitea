import { defineConfig, presetUno } from 'unocss';
import presetIcons from '@unocss/preset-icons';

export default defineConfig({
  presets: [
    presetUno({ dark: 'class' }),
    presetIcons({
      scale: 1.2,
      warn: true,
    }),
  ],
});
