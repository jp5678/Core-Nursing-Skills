// 해시 기반 라우터
const routes = [];

export function route(pattern, handler) {
  // pattern 예: "#/skills/:id"
  const names = [];
  const regex = new RegExp(
    "^" +
    pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
           .replace(/:(\w+)/g, (_, name) => { names.push(name); return "([^/]+)"; }) +
    "$"
  );
  routes.push({ regex, names, handler });
}

export function navigate(hash) {
  if (location.hash === hash) dispatch();
  else location.hash = hash;
}

export function dispatch() {
  const hash = location.hash || "#/";
  for (const { regex, names, handler } of routes) {
    const m = hash.match(regex);
    if (m) {
      const params = Object.fromEntries(names.map((n, i) => [n, decodeURIComponent(m[i + 1])]));
      handler(params);
      return;
    }
  }
  navigate("#/");
}

export function startRouter() {
  window.addEventListener("hashchange", dispatch);
  dispatch();
}
