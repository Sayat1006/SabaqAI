/** Телефон мен планшетте нәтиже форманың астында қалады — генерация басталғанда соған жылжимыз. */
export function scrollToResult() {
  if (window.innerWidth >= 1024) return;
  window.setTimeout(() => document.getElementById("result")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
}
