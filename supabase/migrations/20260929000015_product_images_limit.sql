-- Imágenes de productos y de categorías: 4 MB como máximo (límite de las funciones de Vercel).
--
-- La subida pasa por una acción de servidor (cuerpo máximo ~4,5 MB en Vercel) y el navegador reduce
-- las fotos antes de enviarlas. El bucket lo vuelve a limitar por si algo se saltara esos pasos.
-- Tipos admitidos: JPG, PNG y WebP (ya definidos al crear el bucket).
update storage.buckets set file_size_limit = 4194304 where id = 'product-images';
