export interface Product {
  id: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  originalPrice?: number;
  stock: number;
  description: string;
  images: string[];
  sku: string;
  active: boolean;
  featured?: boolean;
}

export interface Category {
  id: string;
  name: string;
  image: string;
  subcategories: string[];
}

export interface Order {
  id: string;
  number: string;
  customer: string;
  email: string;
  items: { productName: string; quantity: number; price: number }[];
  total: number;
  status: 'pendiente' | 'pagado' | 'enviado' | 'entregado' | 'cancelado';
  paymentMethod: 'card' | 'transfer';
  date: string;
  address: string;
  hasComprobante?: boolean;
}

export interface Discount {
  id: string;
  code?: string;
  type: 'percent' | 'fixed';
  value: number;
  appliesTo: 'product' | 'category' | 'store';
  targetId?: string;
  targetName?: string;
  startDate: string;
  endDate: string;
  active: boolean;
}

export const categories: Category[] = [
  {
    id: 'electrodomesticos',
    name: 'Electrodomésticos',
    image: 'https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=400&h=400&fit=crop&auto=format',
    subcategories: ['Lavadoras', 'Refrigeradores', 'Microondas', 'Aspiradoras', 'Cafeteras', 'Planchas'],
  },
  {
    id: 'tecnologia',
    name: 'Tecnología',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=400&fit=crop&auto=format',
    subcategories: ['Smart Home', 'Audio', 'Iluminación inteligente', 'Seguridad'],
  },
  {
    id: 'bano',
    name: 'Baño',
    image: 'https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=400&h=400&fit=crop&auto=format',
    subcategories: ['Toallas', 'Accesorios', 'Dispensadores', 'Cortinas de baño'],
  },
  {
    id: 'dormitorio',
    name: 'Dormitorio',
    image: 'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=400&fit=crop&auto=format',
    subcategories: ['Ropa de cama', 'Organización y decoración', 'Muebles', 'Descanso'],
  },
  {
    id: 'comedor',
    name: 'Comedor',
    image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=400&h=400&fit=crop&auto=format',
    subcategories: ['Vajillas', 'Cristalería', 'Mantelería', 'Cubiertos'],
  },
  {
    id: 'cocina',
    name: 'Cocina',
    image: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=400&fit=crop&auto=format',
    subcategories: ['Utensilios', 'Organización', 'Cocción', 'Almacenamiento', 'Cuchillería', 'Textil para cocina'],
  },
  {
    id: 'exteriores',
    name: 'Exteriores',
    image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400&h=400&fit=crop&auto=format',
    subcategories: ['Muebles de jardín', 'Plantas', 'Herramientas', 'BBQ'],
  },
  {
    id: 'decoracion',
    name: 'Decoración y muebles',
    image: 'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=400&h=400&fit=crop&auto=format',
    subcategories: ['Cuadros', 'Cojines', 'Lámparas', 'Alfombras', 'Plantas decorativas'],
  },
];

export const products: Product[] = [
  {
    id: 'p1',
    name: 'Espátula de silicona premium',
    category: 'cocina',
    subcategory: 'Utensilios',
    price: 12.99,
    stock: 42,
    description: 'Espátula de silicona resistente al calor hasta 280°C. Ideal para cocinar sin rayar superficies antiadherentes. Mango ergonómico de acero inoxidable. Apta para lavavajillas.',
    images: [
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1612538498816-afcfe6a3b3b8?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'COC-ESP-001',
    active: true,
    featured: false,
  },
  {
    id: 'p2',
    name: 'Sábanas percal algodón Queen',
    category: 'dormitorio',
    subcategory: 'Ropa de cama',
    price: 45.99,
    originalPrice: 62.99,
    stock: 18,
    description: 'Juego de sábanas 100% algodón percal 200 hilos. Incluye sábana encimera, sábana bajera ajustable y 2 fundas de almohada. Suavidad excepcional desde el primer uso. Disponible en color marfil.',
    images: [
      'https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=600&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'DOR-SAB-002',
    active: true,
    featured: true,
  },
  {
    id: 'p3',
    name: 'Cojín decorativo arena 45×45 cm',
    category: 'decoracion',
    subcategory: 'Cojines',
    price: 18.50,
    stock: 35,
    description: 'Cojín decorativo en tono arena con textura bouclé. Relleno de fibra hueca siliconada para una forma perfecta. Funda con cierre invisible. Lavable a máquina a 30°C.',
    images: [
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1616594039964-ae9021a400a0?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'DEC-COJ-003',
    active: true,
    featured: true,
  },
  {
    id: 'p4',
    name: 'Set de ollas antiadherentes 5 piezas',
    category: 'cocina',
    subcategory: 'Cocción',
    price: 79.99,
    originalPrice: 119.99,
    stock: 9,
    description: 'Juego de 5 ollas y sartenes con revestimiento antiadherente reforzado de granito. Compatible con todo tipo de cocinas incluyendo inducción. Tapas de vidrio templado. Fácil limpieza.',
    images: [
      'https://images.unsplash.com/photo-1584990347449-a5d9f800a783?w=600&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'COC-OLL-004',
    active: true,
    featured: true,
  },
  {
    id: 'p5',
    name: 'Lámpara de mesa cerámica blanca',
    category: 'decoracion',
    subcategory: 'Lámparas',
    price: 34.99,
    stock: 14,
    description: 'Lámpara de mesa con base de cerámica artesanal en blanco mate. Pantalla de lino natural de 25cm de diámetro. Casquillo E27. Aporta una luz cálida y envolvente a cualquier espacio. Cable textil de 1,8m.',
    images: [
      'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600&h=600&fit=crop&auto=format',
      'https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'DEC-LAM-005',
    active: true,
    featured: false,
  },
  {
    id: 'p6',
    name: 'Organizador de cajones extensible',
    category: 'cocina',
    subcategory: 'Organización',
    price: 15.99,
    stock: 27,
    description: 'Organizador extensible para cajones de cocina. Se adapta a cajones de 25–50 cm de ancho. Material de bambú natural. Incluye 5 compartimentos de diferentes tamaños. Respetuoso con el medio ambiente.',
    images: [
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'COC-ORG-006',
    active: true,
    featured: false,
  },
  {
    id: 'p7',
    name: 'Tabla para picar de bambú grande',
    category: 'cocina',
    subcategory: 'Utensilios',
    price: 22.50,
    stock: 20,
    description: 'Tabla para picar de bambú orgánico certificado. Medidas: 38×28×2 cm. Superficie lisa antibacteriana natural. Incluye ranura para recoger jugos y asas a los lados. Lavado a mano recomendado.',
    images: [
      'https://images.unsplash.com/photo-1607051978930-07d6d23022b6?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'COC-TAB-007',
    active: true,
    featured: false,
  },
  {
    id: 'p8',
    name: 'Cucharón de acero inoxidable',
    category: 'cocina',
    subcategory: 'Utensilios',
    price: 8.99,
    stock: 55,
    description: 'Cucharón profesional de acero inoxidable 18/10. Capacidad de 120 ml. Mango largo de 30 cm con gancho para colgar. Resistente al calor, apto para lavavajillas. Acabado espejo.',
    images: [
      'https://images.unsplash.com/photo-1564894809611-1742fc40ed80?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'COC-CUC-008',
    active: true,
    featured: false,
  },
  {
    id: 'p9',
    name: 'Toalla de baño 100% algodón',
    category: 'bano',
    subcategory: 'Toallas',
    price: 14.99,
    stock: 30,
    description: 'Toalla de baño de algodón egipcio 600 g/m². Medidas: 70×140 cm. Suave, absorbente y duradera. Mantiene sus colores después de múltiples lavados. Disponible en color natural y blanco.',
    images: [
      'https://images.unsplash.com/photo-1583845112203-29329902332e?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'BAN-TOA-009',
    active: true,
    featured: false,
  },
  {
    id: 'p10',
    name: 'Dispensador de jabón cerámico',
    category: 'bano',
    subcategory: 'Accesorios',
    price: 24.99,
    originalPrice: 34.99,
    stock: 16,
    description: 'Dispensador de jabón líquido en cerámica esmaltada blanca. Capacidad 350 ml. Bomba de dosificación de acero inoxidable anti-óxido. Fondo antideslizante. Diseño minimalista para baño o cocina.',
    images: [
      'https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'BAN-DIS-010',
    active: true,
    featured: true,
  },
  {
    id: 'p11',
    name: 'Set 6 vasos de cristal soplado',
    category: 'comedor',
    subcategory: 'Cristalería',
    price: 29.99,
    stock: 12,
    description: 'Set de 6 vasos de cristal soplado artesanalmente. Capacidad 350 ml cada uno. Ligeras variaciones en forma y burbuja de aire caracterizan cada pieza. Aptos para lavavajillas en ciclo delicado.',
    images: [
      'https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'COM-VAS-011',
    active: true,
    featured: false,
  },
  {
    id: 'p12',
    name: 'Cafetera eléctrica de goteo 1.5 L',
    category: 'electrodomesticos',
    subcategory: 'Cafeteras',
    price: 49.99,
    originalPrice: 69.99,
    stock: 7,
    description: 'Cafetera de goteo con jarra de vidrio de 1,5 litros (12 tazas). Placa calefactora para mantener el café caliente. Filtro permanente lavable incluido. Potencia 900W. Indicador de nivel de agua. Garantía 2 años.',
    images: [
      'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'ELE-CAF-012',
    active: true,
    featured: true,
  },
  {
    id: 'p13',
    name: 'Almohada viscoelástica memory foam',
    category: 'dormitorio',
    subcategory: 'Descanso',
    price: 38.99,
    stock: 22,
    description: 'Almohada ergonómica de memory foam con efecto frío. Funda exterior 100% bambú extraíble y lavable. Adaptación perfecta al cuello y hombros. Altura: 12 cm. Ideal para dormir boca arriba y de lado.',
    images: [
      'https://images.unsplash.com/photo-1605117882932-f9e32b03fea9?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'DOR-ALM-013',
    active: true,
    featured: false,
  },
  {
    id: 'p14',
    name: 'Set 3 velas aromáticas de soja',
    category: 'decoracion',
    subcategory: 'Plantas decorativas',
    price: 19.99,
    stock: 40,
    description: 'Set de 3 velas de cera de soja natural con fragancias: vainilla y sándalo, cedro y musgo, lavanda y romero. Envases de cristal reutilizables. Mecha de algodón sin plomo. Duración 35 horas c/u.',
    images: [
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'DEC-VEL-014',
    active: true,
    featured: false,
  },
  {
    id: 'p15',
    name: 'Pinzas de cocina de acero 30 cm',
    category: 'cocina',
    subcategory: 'Utensilios',
    price: 7.50,
    stock: 60,
    description: 'Pinzas de cocina en acero inoxidable con puntas de silicona. Longitud 30 cm. Sistema de bloqueo para almacenamiento. No rayan superficies antiadherentes. Soportan hasta 200°C. Aptas para lavavajillas.',
    images: [
      'https://images.unsplash.com/photo-1611532736597-de2d4265fba3?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'COC-PIN-015',
    active: true,
    featured: false,
  },
  {
    id: 'p16',
    name: 'Set de cuchillos profesionales 6 piezas',
    category: 'cocina',
    subcategory: 'Cuchillería',
    price: 54.99,
    originalPrice: 79.99,
    stock: 11,
    description: 'Set de 6 cuchillos de cocina con hoja de acero inoxidable alemán de alta calidad. Incluye: cuchillo chef 20 cm, cuchillo pan, cuchillo deshuesador, cuchillo para verduras, pelador y tijeras. Mango ergonómico antideslizante. Bloque de madera incluido.',
    images: [
      'https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'COC-CUC-016',
    active: true,
    featured: true,
  },
  {
    id: 'p17',
    name: 'Mantel de lino natural 140×180 cm',
    category: 'comedor',
    subcategory: 'Mantelería',
    price: 28.99,
    stock: 19,
    description: 'Mantel de lino 100% natural lavado a la piedra. Medidas: 140×180 cm. Acabado arrugado que no requiere planchado. Color natural con venas características del lino. Borde remallado. Lavable a máquina.',
    images: [
      'https://images.unsplash.com/photo-1589834390005-5d4d9d2ef577?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'COM-MAN-017',
    active: true,
    featured: false,
  },
  {
    id: 'p18',
    name: 'Cesto organizador de mimbre natural',
    category: 'decoracion',
    subcategory: 'Cuadros',
    price: 32.50,
    stock: 15,
    description: 'Cesto tejido a mano de mimbre natural. Medidas: 35×25×20 cm. Con asas de cuero genuino. Ideal para organizar ropa, libros, juguetes o accesorios de baño. Interior forrado en tela de algodón natural.',
    images: [
      'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'DEC-CES-018',
    active: true,
    featured: false,
  },
  {
    id: 'p19',
    name: 'Difusor de aromas ultrasónico',
    category: 'bano',
    subcategory: 'Accesorios',
    price: 26.99,
    stock: 8,
    description: 'Difusor de aceites esenciales ultrasónico de 300 ml. 7 colores LED suaves configurables. Temporizador de 1 y 3 horas. Apagado automático cuando se acaba el agua. Diseño de cerámica blanca mate. Silencioso.',
    images: [
      'https://images.unsplash.com/photo-1608248597279-f99d160bfcbc?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'BAN-DIF-019',
    active: true,
    featured: false,
  },
  {
    id: 'p20',
    name: 'Sábanas microfibra King extra suaves',
    category: 'dormitorio',
    subcategory: 'Ropa de cama',
    price: 35.99,
    originalPrice: 48.99,
    stock: 24,
    description: 'Juego de sábanas King en microfibra de alta densidad. Suavidad extrema, secado rápido y resistencia a las arrugas. Incluye sábana encimera, bajera con elástico reforzado y 2 fundas. Color blanco roto.',
    images: [
      'https://images.unsplash.com/photo-1613977257363-707ba9578f43?w=600&h=600&fit=crop&auto=format',
    ],
    sku: 'DOR-SAB-020',
    active: true,
    featured: true,
  },
];

export const presetProductsBySubcategory: Record<string, Record<string, Array<{ name: string; description: string; suggestedPrice: number; sku: string }>>> = {
  cocina: {
    Utensilios: [
      { name: 'Espátula de silicona', description: 'Espátula resistente al calor para cocinar sin rayar superficies antiadherentes.', suggestedPrice: 12.99, sku: 'COC-ESP-' },
      { name: 'Cucharón de acero inoxidable', description: 'Cucharón resistente de acero inoxidable apto para lavavajillas.', suggestedPrice: 8.99, sku: 'COC-CUC-' },
      { name: 'Pinzas de cocina', description: 'Pinzas multiuso con puntas de silicona para cocinar sin rayar.', suggestedPrice: 7.50, sku: 'COC-PIN-' },
      { name: 'Tabla para picar de bambú', description: 'Tabla de bambú antibacteriana con ranura para jugos.', suggestedPrice: 22.50, sku: 'COC-TAB-' },
      { name: 'Batidor de varillas manual', description: 'Batidor de acero inoxidable 30 cm, ideal para salsas y batidos.', suggestedPrice: 9.99, sku: 'COC-BAT-' },
      { name: 'Pelador de verduras giratorio', description: 'Pelador de acero con mango ergonómico antideslizante.', suggestedPrice: 5.50, sku: 'COC-PEL-' },
    ],
    Organización: [
      { name: 'Organizador de cajones extensible', description: 'Organizador de bambú extensible para cajones de 25–50 cm.', suggestedPrice: 15.99, sku: 'COC-ORG-' },
      { name: 'Portautensilios de cerámica', description: 'Portautensilios cilíndrico de cerámica blanca para mesada.', suggestedPrice: 18.99, sku: 'COC-POR-' },
      { name: 'Estante especiero de bambú', description: 'Estante giratorio para especias con capacidad para 12 frascos.', suggestedPrice: 24.99, sku: 'COC-ESP-' },
    ],
    Cocción: [
      { name: 'Sartén antiadherente 24 cm', description: 'Sartén de aluminio con revestimiento antiadherente de granito.', suggestedPrice: 29.99, sku: 'COC-SAR-' },
      { name: 'Olla de acero inoxidable 4L', description: 'Olla de alta durabilidad compatible con inducción.', suggestedPrice: 45.99, sku: 'COC-OLL-' },
      { name: 'Cazuela de cerámica con tapa', description: 'Cazuela de cerámica apta para horno hasta 220°C.', suggestedPrice: 39.99, sku: 'COC-CAZ-' },
      { name: 'Set de ollas antiadherentes 5 piezas', description: 'Juego completo de ollas y sartenes con tapas de vidrio.', suggestedPrice: 89.99, sku: 'COC-SET-' },
    ],
    Almacenamiento: [
      { name: 'Set de recipientes herméticos 10 piezas', description: 'Recipientes de borosilicato con tapa hermética. Aptos para microondas y congelador.', suggestedPrice: 34.99, sku: 'COC-REC-' },
      { name: 'Bote cerámico con tapa madera', description: 'Bote de cerámica para café, azúcar o harina. Capacidad 800 ml.', suggestedPrice: 19.99, sku: 'COC-BOT-' },
    ],
    Cuchillería: [
      { name: 'Set de cuchillos 6 piezas', description: 'Juego de cuchillos de acero alemán con bloque de madera.', suggestedPrice: 54.99, sku: 'COC-CUC-' },
      { name: 'Cuchillo chef 20 cm', description: 'Cuchillo de chef profesional de acero inoxidable forjado.', suggestedPrice: 24.99, sku: 'COC-CHE-' },
      { name: 'Piedra de afilar doble cara', description: 'Piedra de afilar #1000/#3000 para mantener el filo de tus cuchillos.', suggestedPrice: 18.99, sku: 'COC-PIE-' },
    ],
    'Textil para cocina': [
      { name: 'Set 3 paños de cocina de lino', description: 'Paños de cocina 100% lino natural, absorbentes y resistentes.', suggestedPrice: 16.99, sku: 'COC-PAN-' },
      { name: 'Delantal de cocina ajustable', description: 'Delantal de algodón canvas con bolsillos y tiras ajustables.', suggestedPrice: 22.99, sku: 'COC-DEL-' },
      { name: 'Manoplas para horno 2 piezas', description: 'Manoplas de algodón y silicona resistentes hasta 250°C.', suggestedPrice: 12.99, sku: 'COC-MAN-' },
    ],
  },
  dormitorio: {
    'Ropa de cama': [
      { name: 'Sábanas percal algodón Queen', description: 'Juego de sábanas 200 hilos, suaves desde el primer uso.', suggestedPrice: 45.99, sku: 'DOR-SAB-' },
      { name: 'Funda nórdica reversible', description: 'Funda nórdica doble cara, 100% algodón. 200×220 cm.', suggestedPrice: 59.99, sku: 'DOR-FUN-' },
      { name: 'Protector de colchón impermeable', description: 'Protector transpirable e impermeable con ajuste de 30 cm.', suggestedPrice: 29.99, sku: 'DOR-PRO-' },
      { name: 'Edredón de fibra 400 gr/m²', description: 'Edredón sintético hipoalergénico para todo el año.', suggestedPrice: 49.99, sku: 'DOR-EDR-' },
    ],
    'Organización y decoración': [
      { name: 'Cojín decorativo bouclé', description: 'Cojín 45×45 cm con funda de bouclé texturizado y relleno incluido.', suggestedPrice: 18.50, sku: 'DOR-COJ-' },
      { name: 'Organizador bajo cama', description: 'Caja de tela con ventana y asa para almacenamiento bajo la cama.', suggestedPrice: 14.99, sku: 'DOR-ORG-' },
    ],
    Muebles: [
      { name: 'Mesita de noche flotante', description: 'Mesita de noche de madera maciza con cajón y estante abierto.', suggestedPrice: 89.99, sku: 'DOR-MES-' },
    ],
    Descanso: [
      { name: 'Almohada viscoelástica memory foam', description: 'Almohada ergonómica con efecto frío. Funda de bambú lavable.', suggestedPrice: 38.99, sku: 'DOR-ALM-' },
      { name: 'Antifaz para dormir de seda', description: 'Antifaz de seda natural 100% que bloquea la luz completamente.', suggestedPrice: 14.99, sku: 'DOR-ANT-' },
    ],
  },
  bano: {
    Toallas: [
      { name: 'Toalla de baño algodón egicio', description: 'Toalla 70×140 cm, 600 g/m². Absorbente y duradera.', suggestedPrice: 14.99, sku: 'BAN-TOA-' },
      { name: 'Set toallas 4 piezas', description: 'Set: 2 toallas de baño + 2 toallas de mano. Algodón 500 g/m².', suggestedPrice: 34.99, sku: 'BAN-SET-' },
    ],
    Accesorios: [
      { name: 'Dispensador de jabón cerámico', description: 'Dispensador cerámico 350 ml con bomba de acero inoxidable.', suggestedPrice: 24.99, sku: 'BAN-DIS-' },
      { name: 'Difusor de aromas ultrasónico', description: 'Difusor 300 ml con LED y apagado automático.', suggestedPrice: 26.99, sku: 'BAN-DIF-' },
      { name: 'Bandeja de baño de madera', description: 'Bandeja extensible de bambú para bañera, de 65 a 90 cm.', suggestedPrice: 32.99, sku: 'BAN-BAN-' },
    ],
    Dispensadores: [
      { name: 'Portarrollos de papel adhesivo', description: 'Portarrollos sin obra de acero inoxidable mate.', suggestedPrice: 18.99, sku: 'BAN-POR-' },
    ],
    'Cortinas de baño': [
      { name: 'Cortina de baño de lino', description: 'Cortina 180×200 cm en lino lavado. Incluye anillas.', suggestedPrice: 29.99, sku: 'BAN-COR-' },
    ],
  },
  electrodomesticos: {
    Cafeteras: [
      { name: 'Cafetera de goteo 1.5 L', description: 'Cafetera 12 tazas, 900W con placa calefactora.', suggestedPrice: 49.99, sku: 'ELE-CAF-' },
      { name: 'Cafetera espresso manual', description: 'Cafetera espresso 15 bares con vaporizador de leche.', suggestedPrice: 79.99, sku: 'ELE-ESP-' },
    ],
    Microondas: [
      { name: 'Microondas 20L con grill', description: 'Microondas 700W con función grill y 5 niveles de potencia.', suggestedPrice: 89.99, sku: 'ELE-MIC-' },
    ],
    Aspiradoras: [
      { name: 'Aspiradora robot inteligente', description: 'Robot aspirador con mapeo por LiDAR y app móvil.', suggestedPrice: 99.99, sku: 'ELE-ROB-' },
    ],
    Planchas: [
      { name: 'Plancha de vapor 2400W', description: 'Plancha de vapor con suela de cerámica y golpe de vapor.', suggestedPrice: 34.99, sku: 'ELE-PLA-' },
    ],
  },
  comedor: {
    Vajillas: [
      { name: 'Vajilla de cerámica 16 piezas', description: 'Vajilla para 4 personas: platos llanos, hondos, postre y tazas.', suggestedPrice: 64.99, sku: 'COM-VAJ-' },
    ],
    Cristalería: [
      { name: 'Set 6 vasos de cristal soplado', description: '6 vasos de cristal artesanal, 350 ml c/u.', suggestedPrice: 29.99, sku: 'COM-VAS-' },
      { name: 'Set 4 copas de vino', description: 'Copas de vino tinto de cristal de borosilicato, 450 ml.', suggestedPrice: 24.99, sku: 'COM-COP-' },
    ],
    Mantelería: [
      { name: 'Mantel de lino 140×180 cm', description: 'Mantel 100% lino natural lavado a la piedra, sin necesidad de plancha.', suggestedPrice: 28.99, sku: 'COM-MAN-' },
      { name: 'Set 6 servilletas de lino', description: 'Servilletas 40×40 cm de lino natural.', suggestedPrice: 19.99, sku: 'COM-SER-' },
    ],
    Cubiertos: [
      { name: 'Set cubiertos 24 piezas acero', description: 'Cubiertos para 6 personas en acero inoxidable 18/10.', suggestedPrice: 44.99, sku: 'COM-CUB-' },
    ],
  },
  decoracion: {
    Cojines: [
      { name: 'Cojín decorativo arena bouclé', description: 'Cojín 45×45 cm textura bouclé, relleno incluido.', suggestedPrice: 18.50, sku: 'DEC-COJ-' },
      { name: 'Cojín macramé circular', description: 'Cojín redondo 40 cm en macramé de algodón natural.', suggestedPrice: 22.99, sku: 'DEC-MAC-' },
    ],
    Lámparas: [
      { name: 'Lámpara de mesa cerámica', description: 'Lámpara de cerámica artesanal con pantalla de lino.', suggestedPrice: 34.99, sku: 'DEC-LAM-' },
      { name: 'Lámpara de pie trípode', description: 'Lámpara de pie de madera de roble con pantalla de lino.', suggestedPrice: 89.99, sku: 'DEC-PIE-' },
    ],
    Cuadros: [
      { name: 'Cuadro abstracto moderno 40×60', description: 'Lienzo enmarcado con arte abstracto en tonos tierra.', suggestedPrice: 39.99, sku: 'DEC-CUA-' },
      { name: 'Set 3 cuadros minimalistas', description: 'Tríptico de fotos en blanco y negro con marco de madera.', suggestedPrice: 54.99, sku: 'DEC-TRI-' },
    ],
    Alfombras: [
      { name: 'Alfombra de yute natural 140×200', description: 'Alfombra de yute natural tejida a mano. Textura natural.', suggestedPrice: 79.99, sku: 'DEC-ALF-' },
    ],
    'Plantas decorativas': [
      { name: 'Set 3 velas aromáticas de soja', description: 'Velas de soja natural con fragancias: vainilla, cedro, lavanda.', suggestedPrice: 19.99, sku: 'DEC-VEL-' },
      { name: 'Macetero de cerámica con platillo', description: 'Macetero 15 cm de cerámica artesanal con acabado mate.', suggestedPrice: 16.99, sku: 'DEC-MAC-' },
    ],
  },
  exteriores: {
    'Muebles de jardín': [
      { name: 'Silla plegable de bambú', description: 'Silla plegable resistente a la intemperie con cojín incluido.', suggestedPrice: 59.99, sku: 'EXT-SIL-' },
    ],
    Plantas: [
      { name: 'Maceta de terracota 20 cm', description: 'Maceta clásica de terracota con platillo. Pack de 3 unidades.', suggestedPrice: 14.99, sku: 'EXT-MAC-' },
    ],
    Herramientas: [
      { name: 'Set herramientas de jardín 5 piezas', description: 'Set con paleta, rastrillo, cavador, pala y cepillo de acero.', suggestedPrice: 29.99, sku: 'EXT-HER-' },
    ],
    BBQ: [
      { name: 'Barbacoa de carbón portátil', description: 'Barbacoa compacta de acero inoxidable con tapa y bandeja.', suggestedPrice: 49.99, sku: 'EXT-BBQ-' },
    ],
  },
  tecnologia: {
    'Smart Home': [
      { name: 'Enchufe inteligente WiFi', description: 'Enchufe con control por app, compatible con Alexa y Google Home.', suggestedPrice: 18.99, sku: 'TEC-ENC-' },
    ],
    Audio: [
      { name: 'Altavoz Bluetooth inalámbrico', description: 'Altavoz portátil 10W, resistente al agua IPX5, 12h de batería.', suggestedPrice: 39.99, sku: 'TEC-ALT-' },
    ],
    'Iluminación inteligente': [
      { name: 'Bombilla LED inteligente RGB', description: 'Bombilla E27 9W RGB+CCT, control por app y voz.', suggestedPrice: 14.99, sku: 'TEC-BOM-' },
    ],
    Seguridad: [
      { name: 'Cámara de seguridad WiFi interior', description: 'Cámara 1080p con visión nocturna, detección de movimiento y almacenamiento en nube.', suggestedPrice: 44.99, sku: 'TEC-CAM-' },
    ],
  },
};

export const sampleOrders: Order[] = [
  {
    id: 'o1',
    number: 'NID-10045',
    customer: 'María González',
    email: 'maria.gonzalez@email.com',
    items: [
      { productName: 'Sábanas percal algodón Queen', quantity: 1, price: 45.99 },
      { productName: 'Cojín decorativo arena', quantity: 2, price: 18.50 },
    ],
    total: 82.99,
    status: 'enviado',
    paymentMethod: 'card',
    date: '2026-09-27',
    address: 'Calle 45 #12-34, Bogotá',
  },
  {
    id: 'o2',
    number: 'NID-10044',
    customer: 'Carlos Pérez',
    email: 'carlos.perez@email.com',
    items: [
      { productName: 'Set de ollas antiadherentes 5 piezas', quantity: 1, price: 79.99 },
    ],
    total: 79.99,
    status: 'pendiente',
    paymentMethod: 'transfer',
    date: '2026-09-28',
    address: 'Av. Siempre Viva 742, Medellín',
    hasComprobante: true,
  },
  {
    id: 'o3',
    number: 'NID-10043',
    customer: 'Laura Martínez',
    email: 'laura.m@email.com',
    items: [
      { productName: 'Lámpara de mesa cerámica blanca', quantity: 1, price: 34.99 },
      { productName: 'Set 3 velas aromáticas de soja', quantity: 1, price: 19.99 },
    ],
    total: 54.98,
    status: 'entregado',
    paymentMethod: 'card',
    date: '2026-09-22',
    address: 'Carrera 15 #80-12, Cali',
  },
  {
    id: 'o4',
    number: 'NID-10042',
    customer: 'Andrés Ruiz',
    email: 'andres.ruiz@email.com',
    items: [
      { productName: 'Cafetera eléctrica de goteo 1.5 L', quantity: 1, price: 49.99 },
    ],
    total: 49.99,
    status: 'pagado',
    paymentMethod: 'transfer',
    date: '2026-09-25',
    address: 'Transversal 56 #90-11, Barranquilla',
    hasComprobante: true,
  },
  {
    id: 'o5',
    number: 'NID-10041',
    customer: 'Valentina Torres',
    email: 'valen.torres@email.com',
    items: [
      { productName: 'Dispensador de jabón cerámico', quantity: 2, price: 24.99 },
      { productName: 'Toalla de baño 100% algodón', quantity: 3, price: 14.99 },
    ],
    total: 94.95,
    status: 'cancelado',
    paymentMethod: 'card',
    date: '2026-09-20',
    address: 'Calle 100 #45-67, Bucaramanga',
  },
  {
    id: 'o6',
    number: 'NID-10040',
    customer: 'Diego Herrera',
    email: 'dherrera@email.com',
    items: [
      { productName: 'Set de cuchillos profesionales 6 piezas', quantity: 1, price: 54.99 },
    ],
    total: 54.99,
    status: 'pendiente',
    paymentMethod: 'transfer',
    date: '2026-09-29',
    address: 'Cra 7 #13-45, Bogotá',
    hasComprobante: false,
  },
];

export const sampleDiscounts: Discount[] = [
  {
    id: 'd1',
    code: 'VERANO20',
    type: 'percent',
    value: 20,
    appliesTo: 'category',
    targetId: 'decoracion',
    targetName: 'Decoración y muebles',
    startDate: '2026-09-01',
    endDate: '2026-09-30',
    active: true,
  },
  {
    id: 'd2',
    type: 'fixed',
    value: 10,
    appliesTo: 'store',
    startDate: '2026-09-15',
    endDate: '2026-10-15',
    active: true,
  },
  {
    id: 'd3',
    code: 'COCINA15',
    type: 'percent',
    value: 15,
    appliesTo: 'category',
    targetId: 'cocina',
    targetName: 'Cocina',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    active: false,
  },
];

export function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}

export function getDiscount(product: Product): number | null {
  if (!product.originalPrice) return null;
  return Math.round((1 - product.price / product.originalPrice) * 100);
}
