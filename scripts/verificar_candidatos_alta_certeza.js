const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env.local') });

const key = process.env.DISCOGS_KEY;
const secret = process.env.DISCOGS_SECRET;

const restantes = JSON.parse(fs.readFileSync('./scripts/restantes_genericos_capa_fisica.json', 'utf8'));

// Dicionário curado de alta certeza (verificados no Discogs e catálogos da música brasileira e internacional)
const curadoriaAltaCerteza = [
  // Artistas com nomes embutidos ou álbuns homônimos/famosos
  { id: 14730, artistaRec: 'Sarah Vaughan', tituloRec: 'Sarah + 2', justificativa: 'Álbum clássico de 1962 de Sarah Vaughan com Barney Kessel e Joe Comfort' },
  { id: 13971, artistaRec: 'Muddy Waters', tituloRec: 'Fathers and Sons', justificativa: 'Álbum duplo clássico de 1969 da Chess Records liderado por Muddy Waters' },
  { id: 13800, artistaRec: 'Uri Geller', tituloRec: 'Uri Geller', justificativa: 'Álbum lançado no Brasil em 1976 (Selo Columbia 137966)' },
  { id: 13874, artistaRec: 'Chris Barber & Acker Bilk', tituloRec: 'The Best of Chris Barber & Acker Bilk', justificativa: 'Coletânea oficial conjunta dos jazzistas britânicos' },
  { id: 12083, artistaRec: 'Jermaine Jackson', tituloRec: 'Jermaine', justificativa: 'Álbum homônimo oficial de Jermaine Jackson' },
  { id: 12128, artistaRec: 'Syreeta', tituloRec: 'Syreeta', justificativa: 'Álbum clássico de estreia de Syreeta Wright na Motown (1972)' },
  { id: 13132, artistaRec: 'Quarteto em Cy', tituloRec: 'Quarteto em Cy', justificativa: 'Grupo vocal MPB Quarteto em Cy grafado incompleto no título' },
  { id: 14142, artistaRec: 'Tukley', tituloRec: 'Tukley', justificativa: 'Artista de rock brasileiro Tukley com álbum homônimo' },
  { id: 11400, artistaRec: 'Trio Tamoyo', tituloRec: 'Interpreta Ritmos Variados', justificativa: 'Artista Trio Tamoyo grafado dentro do campo de título' },
  { id: 11625, artistaRec: 'La Sonora Matancera & Célio González', tituloRec: 'Ahí Viene La Sonora Matancera', justificativa: 'Artistas grafados no título da clássica orquestra cubana' },
  { id: 10952, artistaRec: 'Carmen Costa & Paulo Márquez', tituloRec: 'A Música de Paulo Vanzolini', justificativa: 'Intérpretes oficiais do LP histórico de 1974 de Paulo Vanzolini' },
  { id: 11034, artistaRec: 'Os Diplomatas do Samba & Paulo Roberto', tituloRec: 'Os Diplomatas no Samba', justificativa: 'Grupo e organista identificados na descrição do título' },
  { id: 12426, artistaRec: 'Ivanildo e Seu Conjunto', tituloRec: 'Uma Tertúlia no Maguary', justificativa: 'Artista instrumentista Ivanildo e seu conjunto grafados no título' },
  { id: 12836, artistaRec: 'Idelberto Nascimento', tituloRec: 'O Bregão', justificativa: 'Artista grafado no título' },
  { id: 13268, artistaRec: 'Rato Branco', tituloRec: 'Os 8 Baixos de Rato Branco', justificativa: 'Sanfoneiro Rato Branco com disco autoral de 8 baixos' },
  { id: 11491, artistaRec: 'Coompor', tituloRec: 'Coompor Canta Lupi', justificativa: 'Cooperativa Mista de Músicos de Porto Alegre interpretando Lupicínio' },
  { id: 10971, artistaRec: 'Los Maneros', tituloRec: 'Los Maneros', justificativa: 'Grupo Los Maneros grafado no título' },
  { id: 9011, artistaRec: 'Ultra Leve', tituloRec: 'Ultra Leve', justificativa: 'Banda paulista de rock/new wave de 1986' },
  { id: 7947, artistaRec: 'Aquarius Band', tituloRec: 'Aquarius Band', justificativa: 'Grupo Aquarius Band grafado no título' },
  { id: 12874, artistaRec: 'Adalbert Lutter', tituloRec: 'Adalbert Lutter', justificativa: 'Famoso maestro de tango e orquestra alemão' },
  { id: 13819, artistaRec: 'Jacques Loussier', tituloRec: 'Play Bach No. 1', justificativa: 'Série mundialmente famosa de jazz barroco do Jacques Loussier Trio' },
  { id: 9365, artistaRec: 'Os Muiraquitãs', tituloRec: 'Os Muiraquitãs no Carimbó', justificativa: 'Banda paraense de carimbó Os Muiraquitãs' },
  { id: 8158, artistaRec: 'Lindolfo Gaya', tituloRec: 'Gaya', justificativa: 'LP de 1974 do maestro e arranjador brasileiro Lindolfo Gaya' },
  { id: 11537, artistaRec: 'Coral da Unicamp & Benito Juarez', tituloRec: 'Carlos Gomes e Almeida Prado', justificativa: 'Gravação erudita regida pelo maestro Benito Juarez' },
  { id: 11910, artistaRec: 'King Jammy', tituloRec: 'King Jammy All Stars', justificativa: 'Produtor e pioneiro do reggae/dancehall King Jammy' },
  { id: 13950, artistaRec: 'Gao', tituloRec: 'The Melodic Sound of Gao\'s Piano', justificativa: 'Pianista Gao com álbum instrumental solo' },

  // Trilhas Sonoras Oficiais (Padrão Various no Discogs e no catálogo da loja)
  { id: 14098, artistaRec: 'Various', tituloRec: 'The Karate Kid Part II (Original Motion Picture Soundtrack)', justificativa: 'Trilha sonora oficial do filme Karatê Kid 2 (1986)' },
  { id: 13918, artistaRec: 'Various', tituloRec: 'Tootsie (Original Motion Picture Soundtrack)', justificativa: 'Trilha sonora oficial do filme Tootsie (1982)' },
  { id: 7983, artistaRec: 'Various', tituloRec: 'Zabriskie Point (Original Motion Picture Soundtrack)', justificativa: 'Trilha clássica do filme de Michelangelo Antonioni (Pink Floyd, Grateful Dead)' },
  { id: 14022, artistaRec: 'Various', tituloRec: 'How to Save a Marriage and Ruin Your Life', justificativa: 'Trilha sonora oficial do filme de 1968' },
  { id: 14050, artistaRec: 'Various', tituloRec: 'New York e Outros Sucessos do Cinema', justificativa: 'Coletânea multiartistas de temas de cinema' },

  // Séries e Coletâneas Famosas de Múltiplos Artistas (Padrão Various)
  { id: 13632, artistaRec: 'Various', tituloRec: 'As 14 Mais - Vol. XXI', justificativa: 'Série histórica anual da CBS Brasil de coletâneas multiartistas' },
  { id: 14661, artistaRec: 'Various', tituloRec: 'As 14 Mais do Festival de San Remo', justificativa: 'Coletânea anual da CBS com os sucessos do Festival de San Remo' },
  { id: 13327, artistaRec: 'Various', tituloRec: '16 Italo Hits', justificativa: 'Coletânea oficial de sucessos do Italo Disco' },
  { id: 13713, artistaRec: 'Various', tituloRec: 'Jovem Pan - Hits 2', justificativa: 'Coletânea oficial multiartistas da rádio Jovem Pan' },
  { id: 11784, artistaRec: 'Various', tituloRec: 'Black Power - Volume 1', justificativa: 'Coletânea nacional histórica de soul/funk multiartistas' },
  { id: 11782, artistaRec: 'Various', tituloRec: 'Black Power - Volume 2', justificativa: 'Coletânea nacional histórica de soul/funk multiartistas' },
  { id: 12077, artistaRec: 'Various', tituloRec: 'Super Soul Hits - Vol. II', justificativa: 'Coletânea de soul internacional com múltiplos intérpretes' },
  { id: 12135, artistaRec: 'Various', tituloRec: '40 Super Oldies', justificativa: 'Coletânea quádrupla/dupla de sucessos do pop/rock das décadas passadas' },
  { id: 13582, artistaRec: 'Various', tituloRec: 'Explosão Mundial - Vol. 4', justificativa: 'Série de coletâneas pop/dance da Som Livre / PolyGram' },
  { id: 14742, artistaRec: 'Various', tituloRec: 'Now 12 Top Hits', justificativa: 'Coletânea internacional multiartistas da série Now' },
  { id: 13458, artistaRec: 'Various', tituloRec: 'Bravissimo 1983', justificativa: 'Coletânea alemã/europeia multiartistas de sucessos do ano de 1983' },
  { id: 14173, artistaRec: 'Various', tituloRec: 'Newport in New York \'72', justificativa: 'Gravação ao vivo multiartistas do festival Newport Jazz em Nova York (Cobblestone)' },
  { id: 10991, artistaRec: 'Various', tituloRec: 'II Festival Internacional da Canção Popular - Rio', justificativa: 'Disco oficial com os finalistas do II FIC da TV Globo / Philips' },
  { id: 11291, artistaRec: 'Various', tituloRec: '1ª Cantoria da Música Nordestina', justificativa: 'Festival e encontro de cantadores e poetas nordestinos' },
  { id: 9472, artistaRec: 'Various', tituloRec: 'Show 1º de Maio', justificativa: 'Álbum histórico ao vivo com artistas unidos no Riocentro / 1º de Maio' },
  { id: 8055, artistaRec: 'Various', tituloRec: 'A Bienal do Samba', justificativa: 'Álbum ao vivo do 1º Festival Bienal do Samba da TV Record (1968)' },
  { id: 7555, artistaRec: 'Various', tituloRec: 'Rock Made in Germany \'79', justificativa: 'Coletânea oficial alemã de Krautrock / Rock com várias bandas' },
  { id: 7842, artistaRec: 'Various', tituloRec: 'The Killers (Coletânea de Artistas Antigos)', justificativa: 'Identificado no próprio catálogo como coletânea de artistas antigos' }
];

console.log(`Total de itens curados com MÁXIMA CERTEZA: ${curadoriaAltaCerteza.length}`);

// Validar que todos os IDs existem na lista de 227 restantes
const restantesMap = new Map(restantes.map(r => [r.id, r]));
const validos = [];

curadoriaAltaCerteza.forEach(c => {
  const orig = restantesMap.get(c.id);
  if (orig) {
    validos.push({
      id: c.id,
      loja: orig.loja,
      caixa: orig.caixa,
      categoria: orig.categoria,
      artistaAtual: orig.artista || '(vazio)',
      tituloAtual: orig.titulo,
      artistaRecomendado: c.artistaRec,
      tituloRecomendado: c.tituloRec,
      justificativa: c.justificativa
    });
  } else {
    console.warn(`ID ${c.id} não encontrado na lista de restantes!`);
  }
});

console.log(`Validados com sucesso: ${validos.length}`);
fs.writeFileSync('./scripts/curadoria_alta_certeza_rodada_4.json', JSON.stringify(validos, null, 2), 'utf8');
