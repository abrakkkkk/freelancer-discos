export default function manifest() {
  return {
    name: 'Estoque de Discos | Freelancer Discos',
    short_name: 'Estoque Discos',
    description: 'Sistema de gerenciamento de estoque da Freelancer Discos',
    start_url: '/',
    display: 'standalone',
    background_color: '#09090b',
    theme_color: '#09090b',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  };
}
