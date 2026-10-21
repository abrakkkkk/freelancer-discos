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
        src: '/icon.jpg',
        sizes: '1080x1080',
        type: 'image/jpeg',
      },
    ],
  };
}
