-- Fase 1 · Semilla de categorías y plantillas de productos comunes.
-- Generada a partir de prototipos/cliente/src/data/index.ts (`categories` y
-- `presetProductsBySubcategory`). Idempotente: se puede ejecutar varias veces.
-- No incluye productos, pedidos, descuentos ni imágenes del prototipo (son de ejemplo).

-- Categorías de primer nivel (el slug es el id del prototipo)
insert into public.categories (nombre, slug, orden) values
  ('Electrodomésticos', 'electrodomesticos', 1),
  ('Tecnología', 'tecnologia', 2),
  ('Baño', 'bano', 3),
  ('Dormitorio', 'dormitorio', 4),
  ('Comedor', 'comedor', 5),
  ('Cocina', 'cocina', 6),
  ('Exteriores', 'exteriores', 7),
  ('Decoración y muebles', 'decoracion', 8)
on conflict (slug) do nothing;

-- Subcategorías: (slug del padre, nombre, slug propio, orden)
insert into public.categories (parent_id, nombre, slug, orden)
select p.id, s.nombre, s.slug, s.orden
from (values
  ('electrodomesticos', 'Lavadoras', 'electrodomesticos-lavadoras', 1),
  ('electrodomesticos', 'Refrigeradores', 'electrodomesticos-refrigeradores', 2),
  ('electrodomesticos', 'Microondas', 'electrodomesticos-microondas', 3),
  ('electrodomesticos', 'Aspiradoras', 'electrodomesticos-aspiradoras', 4),
  ('electrodomesticos', 'Cafeteras', 'electrodomesticos-cafeteras', 5),
  ('electrodomesticos', 'Planchas', 'electrodomesticos-planchas', 6),
  ('tecnologia', 'Smart Home', 'tecnologia-smart-home', 1),
  ('tecnologia', 'Audio', 'tecnologia-audio', 2),
  ('tecnologia', 'Iluminación inteligente', 'tecnologia-iluminacion-inteligente', 3),
  ('tecnologia', 'Seguridad', 'tecnologia-seguridad', 4),
  ('bano', 'Toallas', 'bano-toallas', 1),
  ('bano', 'Accesorios', 'bano-accesorios', 2),
  ('bano', 'Dispensadores', 'bano-dispensadores', 3),
  ('bano', 'Cortinas de baño', 'bano-cortinas-de-bano', 4),
  ('dormitorio', 'Ropa de cama', 'dormitorio-ropa-de-cama', 1),
  ('dormitorio', 'Organización y decoración', 'dormitorio-organizacion-y-decoracion', 2),
  ('dormitorio', 'Muebles', 'dormitorio-muebles', 3),
  ('dormitorio', 'Descanso', 'dormitorio-descanso', 4),
  ('comedor', 'Vajillas', 'comedor-vajillas', 1),
  ('comedor', 'Cristalería', 'comedor-cristaleria', 2),
  ('comedor', 'Mantelería', 'comedor-manteleria', 3),
  ('comedor', 'Cubiertos', 'comedor-cubiertos', 4),
  ('cocina', 'Utensilios', 'cocina-utensilios', 1),
  ('cocina', 'Organización', 'cocina-organizacion', 2),
  ('cocina', 'Cocción', 'cocina-coccion', 3),
  ('cocina', 'Almacenamiento', 'cocina-almacenamiento', 4),
  ('cocina', 'Cuchillería', 'cocina-cuchilleria', 5),
  ('cocina', 'Textil para cocina', 'cocina-textil-para-cocina', 6),
  ('exteriores', 'Muebles de jardín', 'exteriores-muebles-de-jardin', 1),
  ('exteriores', 'Plantas', 'exteriores-plantas', 2),
  ('exteriores', 'Herramientas', 'exteriores-herramientas', 3),
  ('exteriores', 'BBQ', 'exteriores-bbq', 4),
  ('decoracion', 'Cuadros', 'decoracion-cuadros', 1),
  ('decoracion', 'Cojines', 'decoracion-cojines', 2),
  ('decoracion', 'Lámparas', 'decoracion-lamparas', 3),
  ('decoracion', 'Alfombras', 'decoracion-alfombras', 4),
  ('decoracion', 'Plantas decorativas', 'decoracion-plantas-decorativas', 5)
) as s(padre, nombre, slug, orden)
join public.categories p on p.slug = s.padre and p.parent_id is null
on conflict (slug) do nothing;

-- Plantillas (65): (slug de la subcategoría, nombre, descripción, precio sugerido, prefijo SKU)
insert into public.product_templates (category_id, nombre, descripcion_base, precio_sugerido, prefijo_sku)
select c.id, t.nombre, t.descripcion, t.precio, t.prefijo
from (values
  ('cocina-utensilios', 'Espátula de silicona', 'Espátula resistente al calor para cocinar sin rayar superficies antiadherentes.', 12.99, 'COC-ESP-'),
  ('cocina-utensilios', 'Cucharón de acero inoxidable', 'Cucharón resistente de acero inoxidable apto para lavavajillas.', 8.99, 'COC-CUC-'),
  ('cocina-utensilios', 'Pinzas de cocina', 'Pinzas multiuso con puntas de silicona para cocinar sin rayar.', 7.50, 'COC-PIN-'),
  ('cocina-utensilios', 'Tabla para picar de bambú', 'Tabla de bambú antibacteriana con ranura para jugos.', 22.50, 'COC-TAB-'),
  ('cocina-utensilios', 'Batidor de varillas manual', 'Batidor de acero inoxidable 30 cm, ideal para salsas y batidos.', 9.99, 'COC-BAT-'),
  ('cocina-utensilios', 'Pelador de verduras giratorio', 'Pelador de acero con mango ergonómico antideslizante.', 5.50, 'COC-PEL-'),
  ('cocina-organizacion', 'Organizador de cajones extensible', 'Organizador de bambú extensible para cajones de 25–50 cm.', 15.99, 'COC-ORG-'),
  ('cocina-organizacion', 'Portautensilios de cerámica', 'Portautensilios cilíndrico de cerámica blanca para mesada.', 18.99, 'COC-POR-'),
  ('cocina-organizacion', 'Estante especiero de bambú', 'Estante giratorio para especias con capacidad para 12 frascos.', 24.99, 'COC-ESP-'),
  ('cocina-coccion', 'Sartén antiadherente 24 cm', 'Sartén de aluminio con revestimiento antiadherente de granito.', 29.99, 'COC-SAR-'),
  ('cocina-coccion', 'Olla de acero inoxidable 4L', 'Olla de alta durabilidad compatible con inducción.', 45.99, 'COC-OLL-'),
  ('cocina-coccion', 'Cazuela de cerámica con tapa', 'Cazuela de cerámica apta para horno hasta 220°C.', 39.99, 'COC-CAZ-'),
  ('cocina-coccion', 'Set de ollas antiadherentes 5 piezas', 'Juego completo de ollas y sartenes con tapas de vidrio.', 89.99, 'COC-SET-'),
  ('cocina-almacenamiento', 'Set de recipientes herméticos 10 piezas', 'Recipientes de borosilicato con tapa hermética. Aptos para microondas y congelador.', 34.99, 'COC-REC-'),
  ('cocina-almacenamiento', 'Bote cerámico con tapa madera', 'Bote de cerámica para café, azúcar o harina. Capacidad 800 ml.', 19.99, 'COC-BOT-'),
  ('cocina-cuchilleria', 'Set de cuchillos 6 piezas', 'Juego de cuchillos de acero alemán con bloque de madera.', 54.99, 'COC-CUC-'),
  ('cocina-cuchilleria', 'Cuchillo chef 20 cm', 'Cuchillo de chef profesional de acero inoxidable forjado.', 24.99, 'COC-CHE-'),
  ('cocina-cuchilleria', 'Piedra de afilar doble cara', 'Piedra de afilar #1000/#3000 para mantener el filo de tus cuchillos.', 18.99, 'COC-PIE-'),
  ('cocina-textil-para-cocina', 'Set 3 paños de cocina de lino', 'Paños de cocina 100% lino natural, absorbentes y resistentes.', 16.99, 'COC-PAN-'),
  ('cocina-textil-para-cocina', 'Delantal de cocina ajustable', 'Delantal de algodón canvas con bolsillos y tiras ajustables.', 22.99, 'COC-DEL-'),
  ('cocina-textil-para-cocina', 'Manoplas para horno 2 piezas', 'Manoplas de algodón y silicona resistentes hasta 250°C.', 12.99, 'COC-MAN-'),
  ('dormitorio-ropa-de-cama', 'Sábanas percal algodón Queen', 'Juego de sábanas 200 hilos, suaves desde el primer uso.', 45.99, 'DOR-SAB-'),
  ('dormitorio-ropa-de-cama', 'Funda nórdica reversible', 'Funda nórdica doble cara, 100% algodón. 200×220 cm.', 59.99, 'DOR-FUN-'),
  ('dormitorio-ropa-de-cama', 'Protector de colchón impermeable', 'Protector transpirable e impermeable con ajuste de 30 cm.', 29.99, 'DOR-PRO-'),
  ('dormitorio-ropa-de-cama', 'Edredón de fibra 400 gr/m²', 'Edredón sintético hipoalergénico para todo el año.', 49.99, 'DOR-EDR-'),
  ('dormitorio-organizacion-y-decoracion', 'Cojín decorativo bouclé', 'Cojín 45×45 cm con funda de bouclé texturizado y relleno incluido.', 18.50, 'DOR-COJ-'),
  ('dormitorio-organizacion-y-decoracion', 'Organizador bajo cama', 'Caja de tela con ventana y asa para almacenamiento bajo la cama.', 14.99, 'DOR-ORG-'),
  ('dormitorio-muebles', 'Mesita de noche flotante', 'Mesita de noche de madera maciza con cajón y estante abierto.', 89.99, 'DOR-MES-'),
  ('dormitorio-descanso', 'Almohada viscoelástica memory foam', 'Almohada ergonómica con efecto frío. Funda de bambú lavable.', 38.99, 'DOR-ALM-'),
  ('dormitorio-descanso', 'Antifaz para dormir de seda', 'Antifaz de seda natural 100% que bloquea la luz completamente.', 14.99, 'DOR-ANT-'),
  ('bano-toallas', 'Toalla de baño algodón egicio', 'Toalla 70×140 cm, 600 g/m². Absorbente y duradera.', 14.99, 'BAN-TOA-'),
  ('bano-toallas', 'Set toallas 4 piezas', 'Set: 2 toallas de baño + 2 toallas de mano. Algodón 500 g/m².', 34.99, 'BAN-SET-'),
  ('bano-accesorios', 'Dispensador de jabón cerámico', 'Dispensador cerámico 350 ml con bomba de acero inoxidable.', 24.99, 'BAN-DIS-'),
  ('bano-accesorios', 'Difusor de aromas ultrasónico', 'Difusor 300 ml con LED y apagado automático.', 26.99, 'BAN-DIF-'),
  ('bano-accesorios', 'Bandeja de baño de madera', 'Bandeja extensible de bambú para bañera, de 65 a 90 cm.', 32.99, 'BAN-BAN-'),
  ('bano-dispensadores', 'Portarrollos de papel adhesivo', 'Portarrollos sin obra de acero inoxidable mate.', 18.99, 'BAN-POR-'),
  ('bano-cortinas-de-bano', 'Cortina de baño de lino', 'Cortina 180×200 cm en lino lavado. Incluye anillas.', 29.99, 'BAN-COR-'),
  ('electrodomesticos-cafeteras', 'Cafetera de goteo 1.5 L', 'Cafetera 12 tazas, 900W con placa calefactora.', 49.99, 'ELE-CAF-'),
  ('electrodomesticos-cafeteras', 'Cafetera espresso manual', 'Cafetera espresso 15 bares con vaporizador de leche.', 79.99, 'ELE-ESP-'),
  ('electrodomesticos-microondas', 'Microondas 20L con grill', 'Microondas 700W con función grill y 5 niveles de potencia.', 89.99, 'ELE-MIC-'),
  ('electrodomesticos-aspiradoras', 'Aspiradora robot inteligente', 'Robot aspirador con mapeo por LiDAR y app móvil.', 99.99, 'ELE-ROB-'),
  ('electrodomesticos-planchas', 'Plancha de vapor 2400W', 'Plancha de vapor con suela de cerámica y golpe de vapor.', 34.99, 'ELE-PLA-'),
  ('comedor-vajillas', 'Vajilla de cerámica 16 piezas', 'Vajilla para 4 personas: platos llanos, hondos, postre y tazas.', 64.99, 'COM-VAJ-'),
  ('comedor-cristaleria', 'Set 6 vasos de cristal soplado', '6 vasos de cristal artesanal, 350 ml c/u.', 29.99, 'COM-VAS-'),
  ('comedor-cristaleria', 'Set 4 copas de vino', 'Copas de vino tinto de cristal de borosilicato, 450 ml.', 24.99, 'COM-COP-'),
  ('comedor-manteleria', 'Mantel de lino 140×180 cm', 'Mantel 100% lino natural lavado a la piedra, sin necesidad de plancha.', 28.99, 'COM-MAN-'),
  ('comedor-manteleria', 'Set 6 servilletas de lino', 'Servilletas 40×40 cm de lino natural.', 19.99, 'COM-SER-'),
  ('comedor-cubiertos', 'Set cubiertos 24 piezas acero', 'Cubiertos para 6 personas en acero inoxidable 18/10.', 44.99, 'COM-CUB-'),
  ('decoracion-cojines', 'Cojín decorativo arena bouclé', 'Cojín 45×45 cm textura bouclé, relleno incluido.', 18.50, 'DEC-COJ-'),
  ('decoracion-cojines', 'Cojín macramé circular', 'Cojín redondo 40 cm en macramé de algodón natural.', 22.99, 'DEC-MAC-'),
  ('decoracion-lamparas', 'Lámpara de mesa cerámica', 'Lámpara de cerámica artesanal con pantalla de lino.', 34.99, 'DEC-LAM-'),
  ('decoracion-lamparas', 'Lámpara de pie trípode', 'Lámpara de pie de madera de roble con pantalla de lino.', 89.99, 'DEC-PIE-'),
  ('decoracion-cuadros', 'Cuadro abstracto moderno 40×60', 'Lienzo enmarcado con arte abstracto en tonos tierra.', 39.99, 'DEC-CUA-'),
  ('decoracion-cuadros', 'Set 3 cuadros minimalistas', 'Tríptico de fotos en blanco y negro con marco de madera.', 54.99, 'DEC-TRI-'),
  ('decoracion-alfombras', 'Alfombra de yute natural 140×200', 'Alfombra de yute natural tejida a mano. Textura natural.', 79.99, 'DEC-ALF-'),
  ('decoracion-plantas-decorativas', 'Set 3 velas aromáticas de soja', 'Velas de soja natural con fragancias: vainilla, cedro, lavanda.', 19.99, 'DEC-VEL-'),
  ('decoracion-plantas-decorativas', 'Macetero de cerámica con platillo', 'Macetero 15 cm de cerámica artesanal con acabado mate.', 16.99, 'DEC-MAC-'),
  ('exteriores-muebles-de-jardin', 'Silla plegable de bambú', 'Silla plegable resistente a la intemperie con cojín incluido.', 59.99, 'EXT-SIL-'),
  ('exteriores-plantas', 'Maceta de terracota 20 cm', 'Maceta clásica de terracota con platillo. Pack de 3 unidades.', 14.99, 'EXT-MAC-'),
  ('exteriores-herramientas', 'Set herramientas de jardín 5 piezas', 'Set con paleta, rastrillo, cavador, pala y cepillo de acero.', 29.99, 'EXT-HER-'),
  ('exteriores-bbq', 'Barbacoa de carbón portátil', 'Barbacoa compacta de acero inoxidable con tapa y bandeja.', 49.99, 'EXT-BBQ-'),
  ('tecnologia-smart-home', 'Enchufe inteligente WiFi', 'Enchufe con control por app, compatible con Alexa y Google Home.', 18.99, 'TEC-ENC-'),
  ('tecnologia-audio', 'Altavoz Bluetooth inalámbrico', 'Altavoz portátil 10W, resistente al agua IPX5, 12h de batería.', 39.99, 'TEC-ALT-'),
  ('tecnologia-iluminacion-inteligente', 'Bombilla LED inteligente RGB', 'Bombilla E27 9W RGB+CCT, control por app y voz.', 14.99, 'TEC-BOM-'),
  ('tecnologia-seguridad', 'Cámara de seguridad WiFi interior', 'Cámara 1080p con visión nocturna, detección de movimiento y almacenamiento en nube.', 44.99, 'TEC-CAM-')
) as t(subcategoria, nombre, descripcion, precio, prefijo)
join public.categories c on c.slug = t.subcategoria
on conflict (category_id, nombre) do nothing;
