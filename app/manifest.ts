import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LanguageLearnAssistant',
    short_name: 'LLA',
    description: 'ИИ-ассистент для изучения немецкого языка',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#18171F',
    theme_color: '#6C5FC9',
    lang: 'ru',
    categories: ['education'],
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
    ],
  };
}
