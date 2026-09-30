// Núcleo del carrito del navegador, SIN React ni `window` ni acciones de servidor: recibe el
// almacenamiento y la API por parámetro, así se prueba con node:test (ver cart-core.test.ts).
// `cart-store.ts` lo conecta con localStorage y con las acciones de servidor reales.
//
// Reglas:
//  - Invitado: el carrito vive en localStorage.
//  - Con sesión: el carrito vive en la base de datos. La vista se actualiza al instante
//    (optimista) y se corrige con la respuesta del servidor. Se conserva al cerrar sesión.
//  - Al iniciar sesión, la copia local del invitado se fusiona con la de la cuenta (en el
//    servidor) y luego se borra.
//  - Al cerrar sesión se limpian la vista y la copia local, pero NO se llama al servidor:
//    nada se borra de la cuenta.
//  - Mientras no se sepa quién es el usuario (`pending`) no se muestra ni se modifica nada,
//    así nunca se ve, ni un instante, el carrito de otro.

import {
  EMPTY_ITEMS,
  addLine,
  parseGuestCart,
  removeLine,
  serializeGuestCart,
  setLine,
  type CartItem,
} from "./cart-logic.ts";

export type CartApiResult =
  | { ok: true; userId: string; items: CartItem[] }
  /** No hay sesión de cliente. */
  | { ok: false; code: "login" }
  /** La sesión actual es de otro usuario (p. ej. otra pestaña inició sesión con otra cuenta). */
  | { ok: false; code: "session"; userId: string; items: CartItem[] }
  | { ok: false; code: "error"; error: string };

/** Acciones de servidor. `expected` es el usuario que la pantalla cree tener: el servidor lo verifica. */
export interface CartApi {
  get(expected: string): Promise<CartApiResult>;
  add(expected: string, productId: string, cantidad: number): Promise<CartApiResult>;
  set(expected: string, productId: string, cantidad: number): Promise<CartApiResult>;
  remove(expected: string, productId: string): Promise<CartApiResult>;
  clear(expected: string): Promise<CartApiResult>;
  merge(expected: string, local: CartItem[]): Promise<CartApiResult>;
}

export interface CartStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

type View =
  | { status: "pending" }
  | { status: "guest"; items: CartItem[] }
  | { status: "user"; userId: string; items: CartItem[] };

const norm = (items: CartItem[]) => (items.length === 0 ? EMPTY_ITEMS : items);

export function createCartStore(deps: {
  storage: CartStorage;
  api: CartApi;
  key?: string;
  pingKey?: string;
}) {
  const { storage, api } = deps;
  const key = deps.key ?? "mcs-cart-v1";
  const pingKey = deps.pingKey ?? "mcs-cart-ping";

  let view: View = { status: "pending" };
  let mergingFor: string | null = null;
  let pendingOps = 0;
  let queue: Promise<void> = Promise.resolve();
  let pingCount = 0;
  const listeners = new Set<() => void>();

  const attempt = (fn: () => void) => {
    try {
      fn();
    } catch {
      // localStorage bloqueado (modo privado): el carrito local no se puede guardar.
    }
  };
  const readLocal = (): CartItem[] => {
    try {
      return parseGuestCart(storage.getItem(key));
    } catch {
      return EMPTY_ITEMS;
    }
  };
  const writeLocal = (items: readonly CartItem[]) =>
    attempt(() => {
      const raw = serializeGuestCart(items);
      if (raw === null) storage.removeItem(key);
      else storage.setItem(key, raw);
    });
  // Avisa a las otras pestañas (el evento "storage" solo se dispara si el valor cambia).
  const ping = () => attempt(() => storage.setItem(pingKey, `${Date.now()}-${pingCount++}`));

  function setView(next: View) {
    view = next;
    listeners.forEach((l) => l());
  }

  // -------------------------------------------------------------------------
  // Lectura
  // -------------------------------------------------------------------------

  const getSnapshot = (): CartItem[] => (view.status === "pending" ? EMPTY_ITEMS : view.items);
  const isReady = () => view.status !== "pending";
  const currentUserId = () => (view.status === "user" ? view.userId : null);
  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  // -------------------------------------------------------------------------
  // Sesión
  // -------------------------------------------------------------------------

  /**
   * La llama el layout de la tienda con lo que el SERVIDOR ve: el usuario de la sesión (null =
   * invitado) y, si hay usuario, las líneas de su carrito en la base de datos.
   */
  function sync(userId: string | null, serverItems: CartItem[]) {
    if (userId === null) {
      mergingFor = null;
      setView({ status: "guest", items: norm(readLocal()) });
      return;
    }
    if (mergingFor === userId) return;

    const local = readLocal();
    if (local.length === 0) {
      setView({ status: "user", userId, items: norm(serverItems) });
      return;
    }

    // Se "reclama" la copia local antes de enviarla: si otra pestaña también acaba de iniciar
    // sesión, la encontrará vacía y no se suma dos veces.
    mergingFor = userId;
    attempt(() => storage.removeItem(key));
    setView({ status: "pending" });

    const finish = (res: CartApiResult) => {
      if (mergingFor !== userId) return; // se cerró la sesión mientras tanto
      mergingFor = null;
      if (res.ok) {
        setView({ status: "user", userId: res.userId, items: norm(res.items) });
      } else {
        // No se pudo fusionar: la copia local se devuelve (si nadie escribió otra) para no perderla.
        if (readLocal().length === 0) writeLocal(local);
        if (res.code === "login") setView({ status: "guest", items: norm(readLocal()) });
        else if (res.code === "session") setView({ status: "user", userId: res.userId, items: norm(res.items) });
        else setView({ status: "user", userId, items: norm(serverItems) });
      }
      ping();
    };
    api.merge(userId, local).then(finish, () => finish({ ok: false, code: "error", error: "network" }));
  }

  /** Al salir de la tienda se olvida el usuario: al volver hay que reconciliar de nuevo. */
  function release() {
    mergingFor = null;
    setView({ status: "pending" });
  }

  /**
   * "Salir": se limpian la vista y la copia local. El servidor NO se toca: el carrito de la
   * cuenta sigue ahí y reaparece al volver a entrar.
   */
  function signOut() {
    mergingFor = null;
    attempt(() => storage.removeItem(key));
    setView({ status: "guest", items: EMPTY_ITEMS });
    ping();
  }

  /** Tras crear un pedido: el servidor ya vació las líneas de la cuenta. */
  function afterOrder() {
    if (view.status === "user") setView({ status: "user", userId: view.userId, items: EMPTY_ITEMS });
    else if (view.status === "guest") {
      writeLocal([]);
      setView({ status: "guest", items: EMPTY_ITEMS });
    }
    ping();
  }

  // -------------------------------------------------------------------------
  // Servidor
  // -------------------------------------------------------------------------

  function applyResult(userId: string, res: CartApiResult, notifyOthers: boolean) {
    // Si mientras tanto se cerró la sesión o cambió de cuenta, esta respuesta ya no aplica.
    if (view.status !== "user" || view.userId !== userId) return;
    if (res.ok) {
      // Con más cambios en camino, la respuesta de esos últimos manda (evita parpadeos).
      if (pendingOps === 0) setView({ status: "user", userId: res.userId, items: norm(res.items) });
      if (notifyOthers) ping();
    } else if (res.code === "login") {
      setView({ status: "guest", items: norm(readLocal()) });
    } else if (res.code === "session") {
      setView({ status: "user", userId: res.userId, items: norm(res.items) });
    } else {
      refresh();
    }
  }

  /** Vuelve a leer el carrito de la cuenta (otra pestaña o dispositivo pudo cambiarlo). */
  function refresh() {
    if (view.status !== "user") return;
    const userId = view.userId;
    queue = queue.then(async () => {
      if (pendingOps > 0) return;
      let res: CartApiResult;
      try {
        res = await api.get(userId);
      } catch {
        return;
      }
      applyResult(userId, res, false);
    });
  }

  // -------------------------------------------------------------------------
  // Cambios (invitado: localStorage; con sesión: optimista + servidor)
  // -------------------------------------------------------------------------

  function mutate(
    optimistic: (items: CartItem[]) => CartItem[],
    call: (userId: string) => Promise<CartApiResult>,
  ) {
    if (view.status === "pending") return;
    if (view.status === "guest") {
      const items = optimistic(view.items);
      writeLocal(items);
      setView({ status: "guest", items: norm(items) });
      return;
    }
    const userId = view.userId;
    setView({ status: "user", userId, items: norm(optimistic(view.items)) });
    pendingOps++;
    queue = queue.then(async () => {
      let res: CartApiResult;
      try {
        res = await call(userId);
      } catch {
        res = { ok: false, code: "error", error: "network" };
      }
      pendingOps--;
      applyResult(userId, res, true);
    });
  }

  const add = (productId: string, cantidad: number, max: number) =>
    mutate(
      (items) => addLine(items, productId, cantidad, max),
      (u) => api.add(u, productId, cantidad),
    );
  const setQuantity = (productId: string, cantidad: number) =>
    mutate(
      (items) => setLine(items, productId, cantidad),
      (u) => api.set(u, productId, cantidad),
    );
  const remove = (productId: string) =>
    mutate(
      (items) => removeLine(items, productId),
      (u) => api.remove(u, productId),
    );
  const clear = () =>
    mutate(
      () => [],
      (u) => api.clear(u),
    );

  // -------------------------------------------------------------------------
  // Otras pestañas
  // -------------------------------------------------------------------------

  /** Evento "storage" de otra pestaña (key null = se vació todo el almacenamiento). */
  function onStorageEvent(eventKey: string | null) {
    if (eventKey !== null && eventKey !== key && eventKey !== pingKey) return;
    if (view.status === "guest") setView({ status: "guest", items: norm(readLocal()) });
    else if (view.status === "user") refresh();
  }

  return {
    subscribe,
    getSnapshot,
    isReady,
    currentUserId,
    sync,
    release,
    signOut,
    afterOrder,
    refresh,
    add,
    setQuantity,
    remove,
    clear,
    onStorageEvent,
    /** Espera a que terminen las llamadas al servidor en curso (para las pruebas). */
    idle: async () => {
      await queue;
      await Promise.resolve();
    },
  };
}

export type CartStore = ReturnType<typeof createCartStore>;
