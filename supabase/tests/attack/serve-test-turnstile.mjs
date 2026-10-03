// Arranca `next start` (producción local) con la clave de PRUEBA de Turnstile de Cloudflare, que acepta
// cualquier token. Solo para las pruebas de ataque: así login, registro, recuperación y contacto se pueden
// ejercitar sin un navegador. La clave es la que Cloudflare publica para pruebas; no protege nada real.
//
//   node supabase/tests/attack/serve-test-turnstile.mjs        (puerto 3101; PORT=... para cambiarlo)
//
// El servidor "estricto" (sin clave, como producción sin configurar) es simplemente `npm run start`.
process.env.TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";
process.argv = [process.argv[0], "next", "start", "-p", process.env.PORT ?? "3101"];
await import("next/dist/bin/next");
