-- Fase 1 · Semilla de categorías y plantillas de productos comunes.
-- Idempotente: se puede ejecutar varias veces sin duplicar datos.
-- Las subcategorías de Cocina y Dormitorio vienen del CLAUDE.md; las demás son una
-- propuesta inicial a confirmar con el cliente (se editan luego desde el dashboard).

-- ---------------------------------------------------------------------------
-- Categorías de primer nivel
-- ---------------------------------------------------------------------------
insert into public.categories (nombre, slug, orden) values
  ('Electrodomésticos',    'electrodomesticos',    1),
  ('Tecnología',           'tecnologia',           2),
  ('Baño',                 'bano',                 3),
  ('Dormitorio',           'dormitorio',           4),
  ('Comedor',              'comedor',              5),
  ('Cocina',               'cocina',               6),
  ('Exteriores',           'exteriores',           7),
  ('Decoración y muebles', 'decoracion-y-muebles', 8)
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Subcategorías: (slug del padre, nombre, slug propio, orden)
-- ---------------------------------------------------------------------------
insert into public.categories (parent_id, nombre, slug, orden)
select p.id, s.nombre, s.slug, s.orden
from (values
  ('electrodomesticos', 'Cocina pequeña',     'electrodomesticos-cocina-pequena',   1),
  ('electrodomesticos', 'Lavado y planchado', 'electrodomesticos-lavado-planchado', 2),
  ('electrodomesticos', 'Climatización',      'electrodomesticos-climatizacion',    3),
  ('electrodomesticos', 'Cuidado personal',   'electrodomesticos-cuidado-personal', 4),

  ('tecnologia', 'Audio',                   'tecnologia-audio',           1),
  ('tecnologia', 'Iluminación inteligente', 'tecnologia-iluminacion',     2),
  ('tecnologia', 'Accesorios',              'tecnologia-accesorios',      3),
  ('tecnologia', 'Hogar conectado',         'tecnologia-hogar-conectado', 4),

  ('bano', 'Organización', 'bano-organizacion', 1),
  ('bano', 'Textil de baño', 'bano-textil',     2),
  ('bano', 'Accesorios',   'bano-accesorios',   3),
  ('bano', 'Limpieza',     'bano-limpieza',     4),

  ('dormitorio', 'Ropa de cama',              'dormitorio-ropa-de-cama', 1),
  ('dormitorio', 'Organización y decoración', 'dormitorio-organizacion', 2),
  ('dormitorio', 'Muebles',                   'dormitorio-muebles',      3),
  ('dormitorio', 'Descanso',                  'dormitorio-descanso',     4),

  ('comedor', 'Vajilla',       'comedor-vajilla',     1),
  ('comedor', 'Cristalería',   'comedor-cristaleria', 2),
  ('comedor', 'Cubiertos',     'comedor-cubiertos',   3),
  ('comedor', 'Mesa y textil', 'comedor-mesa-textil', 4),

  ('cocina', 'Utensilios',         'cocina-utensilios',     1),
  ('cocina', 'Organización',       'cocina-organizacion',   2),
  ('cocina', 'Cocción',            'cocina-coccion',        3),
  ('cocina', 'Almacenamiento',     'cocina-almacenamiento', 4),
  ('cocina', 'Cuchillería',        'cocina-cuchilleria',    5),
  ('cocina', 'Textil para cocina', 'cocina-textil',         6),

  ('exteriores', 'Jardín',               'exteriores-jardin',      1),
  ('exteriores', 'Terraza y patio',      'exteriores-terraza',     2),
  ('exteriores', 'Iluminación exterior', 'exteriores-iluminacion', 3),
  ('exteriores', 'Limpieza exterior',    'exteriores-limpieza',    4),

  ('decoracion-y-muebles', 'Decoración de pared',  'decoracion-pared',       1),
  ('decoracion-y-muebles', 'Iluminación',          'decoracion-iluminacion', 2),
  ('decoracion-y-muebles', 'Alfombras y cortinas', 'decoracion-alfombras',   3),
  ('decoracion-y-muebles', 'Muebles auxiliares',   'decoracion-muebles',     4)
) as s(padre, nombre, slug, orden)
join public.categories p on p.slug = s.padre and p.parent_id is null
on conflict (slug) do nothing;

-- ---------------------------------------------------------------------------
-- Plantillas de productos comunes: (slug de subcategoría, nombre, descripción, atributos)
-- Los atributos son los campos sugeridos; el dueño los completa al crear el producto.
-- ---------------------------------------------------------------------------
insert into public.product_templates (category_id, nombre, descripcion_base, atributos)
select c.id, t.nombre, t.descripcion, t.atributos::jsonb
from (values
  -- Cocina
  ('cocina-utensilios', 'Juego de utensilios de cocina', 'Set de utensilios de cocina resistentes al calor y fáciles de lavar.', '{"material":"","piezas":""}'),
  ('cocina-utensilios', 'Espátula', 'Espátula de cocina resistente al calor.', '{"material":"","largo_cm":""}'),
  ('cocina-utensilios', 'Rallador', 'Rallador multiuso de acero inoxidable.', '{"material":""}'),
  ('cocina-organizacion', 'Organizador de cajones', 'Organizador modular para cubiertos y utensilios.', '{"material":"","medidas":""}'),
  ('cocina-organizacion', 'Escurridor de platos', 'Escurridor con bandeja para encimera.', '{"material":"","medidas":""}'),
  ('cocina-coccion', 'Sartén antiadherente', 'Sartén con recubrimiento antiadherente, apta para cocinas a gas y eléctricas.', '{"diametro_cm":"","material":""}'),
  ('cocina-coccion', 'Olla con tapa', 'Olla con tapa de vidrio y asas resistentes.', '{"capacidad_l":"","material":""}'),
  ('cocina-almacenamiento', 'Set de recipientes herméticos', 'Recipientes con tapa hermética para conservar alimentos.', '{"piezas":"","material":""}'),
  ('cocina-almacenamiento', 'Frascos de vidrio', 'Frascos de vidrio con tapa para especias y granos.', '{"capacidad_ml":"","piezas":""}'),
  ('cocina-cuchilleria', 'Cuchillo de chef', 'Cuchillo de chef de hoja de acero inoxidable.', '{"largo_hoja_cm":"","material":""}'),
  ('cocina-cuchilleria', 'Tabla de cortar', 'Tabla de cortar resistente y fácil de limpiar.', '{"material":"","medidas":""}'),
  ('cocina-textil', 'Set de paños de cocina', 'Paños absorbentes de algodón.', '{"piezas":"","material":""}'),
  ('cocina-textil', 'Delantal', 'Delantal de cocina ajustable.', '{"material":"","color":""}'),

  -- Dormitorio
  ('dormitorio-ropa-de-cama', 'Juego de sábanas', 'Juego de sábanas suaves y transpirables.', '{"tamano":"","material":"","piezas":""}'),
  ('dormitorio-ropa-de-cama', 'Cobertor', 'Cobertor liviano para todo el año.', '{"tamano":"","material":""}'),
  ('dormitorio-ropa-de-cama', 'Almohada', 'Almohada de fibra hipoalergénica.', '{"medidas":"","relleno":""}'),
  ('dormitorio-organizacion', 'Organizador de closet', 'Organizador colgante para ropa y accesorios.', '{"material":"","compartimentos":""}'),
  ('dormitorio-organizacion', 'Caja organizadora', 'Caja con tapa para guardar ropa y objetos.', '{"material":"","medidas":""}'),
  ('dormitorio-muebles', 'Velador', 'Mesa de noche compacta.', '{"material":"","medidas":""}'),
  ('dormitorio-descanso', 'Protector de colchón', 'Protector impermeable y transpirable.', '{"tamano":"","material":""}'),
  ('dormitorio-descanso', 'Cojín decorativo', 'Cojín decorativo con funda removible.', '{"medidas":"","color":""}'),

  -- Electrodomésticos
  ('electrodomesticos-cocina-pequena', 'Licuadora', 'Licuadora con vaso resistente y varias velocidades.', '{"potencia_w":"","capacidad_l":""}'),
  ('electrodomesticos-cocina-pequena', 'Tostadora', 'Tostadora con control de tostado.', '{"potencia_w":"","ranuras":""}'),
  ('electrodomesticos-lavado-planchado', 'Plancha de vapor', 'Plancha de vapor con base antiadherente.', '{"potencia_w":""}'),
  ('electrodomesticos-climatizacion', 'Ventilador', 'Ventilador con varias velocidades.', '{"potencia_w":"","tipo":""}'),
  ('electrodomesticos-cuidado-personal', 'Secador de cabello', 'Secador con difusor y varias temperaturas.', '{"potencia_w":""}'),

  -- Tecnología
  ('tecnologia-audio', 'Parlante bluetooth', 'Parlante inalámbrico portátil.', '{"bateria_horas":"","conectividad":"bluetooth"}'),
  ('tecnologia-iluminacion', 'Foco LED inteligente', 'Foco LED de colores controlado desde el celular.', '{"potencia_w":"","conectividad":"wifi"}'),
  ('tecnologia-accesorios', 'Cargador USB', 'Cargador de pared con puertos USB.', '{"potencia_w":"","puertos":""}'),
  ('tecnologia-accesorios', 'Regleta multitoma', 'Regleta de tomas con protección.', '{"tomas":"","largo_m":""}'),

  -- Baño
  ('bano-organizacion', 'Organizador de baño', 'Estante organizador para ducha o lavamanos.', '{"material":"","medidas":""}'),
  ('bano-textil', 'Juego de toallas', 'Toallas suaves y absorbentes.', '{"piezas":"","material":""}'),
  ('bano-textil', 'Cortina de baño', 'Cortina impermeable con ganchos.', '{"medidas":"","material":""}'),
  ('bano-accesorios', 'Dispensador de jabón', 'Dispensador de jabón líquido.', '{"material":"","capacidad_ml":""}'),
  ('bano-limpieza', 'Escobilla de baño', 'Escobilla con soporte.', '{"material":""}'),

  -- Comedor
  ('comedor-vajilla', 'Juego de platos', 'Juego de platos resistentes para uso diario.', '{"piezas":"","material":""}'),
  ('comedor-cristaleria', 'Juego de vasos', 'Juego de vasos de vidrio.', '{"piezas":"","capacidad_ml":""}'),
  ('comedor-cubiertos', 'Juego de cubiertos', 'Cubiertos de acero inoxidable.', '{"piezas":"","material":""}'),
  ('comedor-mesa-textil', 'Mantel', 'Mantel resistente y lavable.', '{"medidas":"","material":""}'),
  ('comedor-mesa-textil', 'Individuales de mesa', 'Set de individuales.', '{"piezas":"","material":""}'),

  -- Exteriores
  ('exteriores-jardin', 'Maceta', 'Maceta con plato inferior.', '{"material":"","diametro_cm":""}'),
  ('exteriores-jardin', 'Manguera de jardín', 'Manguera flexible con conectores.', '{"largo_m":""}'),
  ('exteriores-terraza', 'Silla plegable', 'Silla plegable para exteriores.', '{"material":"","color":""}'),
  ('exteriores-iluminacion', 'Luz solar de jardín', 'Luz LED con carga solar.', '{"cantidad":""}'),
  ('exteriores-limpieza', 'Escoba para exteriores', 'Escoba de cerdas firmes.', '{"material":""}'),

  -- Decoración y muebles
  ('decoracion-pared', 'Espejo decorativo', 'Espejo de pared decorativo.', '{"medidas":"","marco":""}'),
  ('decoracion-pared', 'Reloj de pared', 'Reloj de pared silencioso.', '{"diametro_cm":""}'),
  ('decoracion-iluminacion', 'Lámpara de mesa', 'Lámpara de mesa con pantalla.', '{"tipo_foco":"","altura_cm":""}'),
  ('decoracion-alfombras', 'Alfombra', 'Alfombra antideslizante.', '{"medidas":"","material":""}'),
  ('decoracion-alfombras', 'Cortinas', 'Par de cortinas con ojales.', '{"medidas":"","material":""}'),
  ('decoracion-muebles', 'Mesa auxiliar', 'Mesa auxiliar para sala.', '{"material":"","medidas":""}')
) as t(subcategoria, nombre, descripcion, atributos)
join public.categories c on c.slug = t.subcategoria
on conflict (category_id, nombre) do nothing;
